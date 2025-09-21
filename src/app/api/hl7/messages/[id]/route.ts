import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import HL7Message from '../../../../../models/HL7Message';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureMongo() {
  if (mongoose.connection.readyState === 1 || mongoose.connection.readyState === 2) return;
  const uri = process.env.MONGO_IM_URI || process.env.MONGO_URI;
  if (!uri) throw new Error('No Mongo URI (MONGO_IM_URI or MONGO_URI)');
  if (!(global as any).__MONGO_CONN_PROMISE__) {
    (global as any).__MONGO_CONN_PROMISE__ = mongoose.connect(uri);
  }
  await (global as any).__MONGO_CONN_PROMISE__;
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await ensureMongo();

    // IMPORTANT: do NOT exclude the HL7; and select common field names just in case
    const doc: any = await HL7Message.findById(params.id)
      .select('+raw +rawHL7 +rawMessage')
      .lean();

    if (!doc) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Normalize: always return a string _id and a "raw" field for HL7 text
    const payload = {
      ...doc,
      _id: String(doc._id),
      raw: doc.raw ?? doc.rawHL7 ?? doc.rawMessage ?? null,
    };

    return NextResponse.json(payload);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? 'Failed to fetch message' },
      { status: 500 }
    );
  }
}
