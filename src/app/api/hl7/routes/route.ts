// src/app/api/hl7/messages/route.ts
import { NextResponse } from 'next/server';
import HL7Message from '../../../../models/HL7Message'; // path: app/api/hl7/messages -> models

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    // Connect using your existing lib/mongo export (name may be connectToDB or default)
    const mongoMod: any = await import('../../../../lib/mongo'); // path: app/api/hl7/messages -> lib
    const connect =
      mongoMod.connectToDB || mongoMod.default || mongoMod.getMongo || mongoMod.getDb;
    if (typeof connect === 'function') {
      await connect(); // initializes Mongoose connection
    }

    const url = new URL(req.url);
    const limit = Math.min(Number(url.searchParams.get('limit') ?? 25) || 25, 500);

    // Use your Mongoose model; exclude large rawHL7
    const docs = await HL7Message.find({}, '-rawHL7')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    // Normalize per-row shape without importing extra helpers
    const rows = docs.map((d: any) => {
      const meta = {
        messageType: d?.meta?.messageType ?? d?.parsed?.msh?.messageType ?? null,
        event: d?.meta?.event ?? d?.parsed?.msh?.triggerEvent ?? null,
        controlId: d?.meta?.controlId ?? d?.parsed?.msh?.controlId ?? null,
      };
      const firstObx = d?.firstObx
        ? d.firstObx
        : Array.isArray(d?.parsed?.obx) && d.parsed.obx[0]
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
    return NextResponse.json(
      { error: err?.message ?? 'Failed to list messages' },
      { status: 500 }
    );
  }
}
