import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import HL7Message from '../../../../models/HL7Message';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// helps prove which module is actually serving
const ROUTE_TOKEN = 'messages-route-' + new Date().toISOString();

async function ensureMongo() {
  // 1 = connected, 2 = connecting
  if (mongoose.connection.readyState === 1 || mongoose.connection.readyState === 2) return;

  // ✅ prefer IM DB; fallback to generic MONGO_URI
  const uri = process.env.MONGO_IM_URI || process.env.MONGO_URI;
  if (!uri) throw new Error('Missing MONGO_IM_URI or MONGO_URI');

  // one connect per process
  if (!(global as any).__MONGO_CONN_PROMISE__) {
    (global as any).__MONGO_CONN_PROMISE__ = mongoose.connect(uri);
  }
  await (global as any).__MONGO_CONN_PROMISE__;
}

export async function GET(req: Request) {
  const url = new URL(req.url);

  // ✅ sanity: show which file is serving
  if (url.searchParams.has('whoami')) {
    return NextResponse.json({
      who: 'hl7/messages',
      token: ROUTE_TOKEN,
      moduleUrl: (import.meta as any).url || null,
    });
  }

  try {
    await ensureMongo();

    // ✅ quick DB debug
    if (url.searchParams.has('debug')) {
      const conn = mongoose.connection as any;
      const nativeDb = conn.db;
      const cols = nativeDb ? await nativeDb.listCollections().toArray() : [];
      return NextResponse.json({
        dbName: conn?.name ?? nativeDb?.databaseName ?? null,
        collections: cols.map((c: any) => c.name),
        usingModelCollection: (HL7Message as any)?.collection?.name ?? null,
        mongoImUriPresent: !!process.env.MONGO_IM_URI,
        mongoUriPresent: !!process.env.MONGO_URI,
      });
    }

    const limit = Math.min(Number(url.searchParams.get('limit') ?? 25) || 25, 500);

    // ✅ exclude the correct large field ("raw"), not "rawHL7"
    const docs = await HL7Message.find({}, { raw: 0 })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const rows = docs.map((d: any) => {
      const meta = {
        messageType: d?.meta?.messageType ?? d?.parsed?.msh?.messageType ?? null,
        event:       d?.meta?.event       ?? d?.parsed?.msh?.triggerEvent ?? null,
        controlId:   d?.meta?.controlId   ?? d?.parsed?.msh?.controlId ?? null,
      };
      const firstObx = d?.firstObx
        ? d.firstObx
        : (Array.isArray(d?.parsed?.obx) && d.parsed.obx[0])
            ? { value: d.parsed.obx[0]?.value ?? null, units: d.parsed.obx[0]?.units ?? null }
            : null;

      return {
        _id: String(d._id),
        receivedAt: d.createdAt ?? d.receivedAt ?? null,
        meta,
        firstObx,
      };
    });

    return NextResponse.json(rows);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Failed to list messages' }, { status: 500 });
  }
}
