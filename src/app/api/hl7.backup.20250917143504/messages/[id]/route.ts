// app/api/hl7/messages/[id]/route.ts
import { NextResponse } from 'next/server';
import HL7Message from '../../../../../models/HL7Message';  // +1 .. compared to messages/route.ts

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureDB() {
  const mongoMod: any = await import('../../../../../lib/mongo');
  const connect = mongoMod.connectToDB || mongoMod.default || mongoMod.getMongo || mongoMod.getDb;
  if (typeof connect === 'function') await connect();
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await ensureDB();
    const doc = await HL7Message.findById(params.id).lean();
    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ...doc, _id: String(doc._id) });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Failed to fetch' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    await ensureDB();
    const r = await HL7Message.deleteOne({ _id: params.id });
    if (!r.deletedCount) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Failed to delete' }, { status: 500 });
  }
}
