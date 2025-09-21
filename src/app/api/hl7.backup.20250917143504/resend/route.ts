// app/api/hl7/resend/route.ts
import { NextResponse } from 'next/server';
import HL7Message from '../../../../models/HL7Message';
import { Socket } from 'net';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureDB() {
  const mongoMod: any = await import('../../../../lib/mongo');
  const connect = mongoMod.connectToDB || mongoMod.default || mongoMod.getMongo || mongoMod.getDb;
  if (typeof connect === 'function') await connect();
}

function sendViaMLLP(host: string, port: number, payload: string, timeoutMs = 6000): Promise<string> {
  return new Promise((resolve, reject) => {
    const SB = '\x0b', EB = '\x1c', CR = '\x0d';
    const frame = SB + payload + EB + CR;

    let buf = '';
    let settled = false;

    const socket = new Socket();
    const done = (err?: Error) => {
      if (!settled) {
        settled = true;
        if (err) reject(err);
        else resolve(buf);
      }
      socket.destroy();
    };

    socket.setTimeout(timeoutMs, () => done(new Error('MLLP timeout')));
    socket.on('connect', () => socket.write(frame));
    socket.on('data', (chunk) => {
      buf += chunk.toString('utf8');
      // ACK ends with EB CR
      if (buf.includes('\x1c\r')) done();
    });
    socket.on('error', (err) => done(err));
    socket.on('close', () => {
      if (!settled) {
        // if we got some data, treat it as ACK; otherwise error
        if (buf) done();
        else done(new Error('Connection closed without ACK'));
      }
    });

    socket.connect(port, host);
  });
}

function parseAck(ack: string) {
  // naive parse: find MSA|<code>|<controlId>
  const segs = ack.split(/\r|\n/).filter(Boolean);
  const msa = segs.find((s) => s.startsWith('MSA|'));
  if (!msa) return { ackCode: null, ackControlId: null };
  const parts = msa.split('|');
  return { ackCode: parts[1] ?? null, ackControlId: parts[2] ?? null };
}

export async function POST(req: Request) {
  try {
    const { id, host, port } = await req.json();
    if (!id || !host || !port) {
      return NextResponse.json({ error: 'Missing id/host/port' }, { status: 400 });
    }

    await ensureDB();
    const doc: any = await HL7Message.findById(id).lean();
    if (!doc?.rawHL7) {
      return NextResponse.json({ error: 'Message not found or missing rawHL7' }, { status: 404 });
    }

    const ackRaw = await sendViaMLLP(host, Number(port), doc.rawHL7);
    const { ackCode, ackControlId } = parseAck(ackRaw);

    // mark as resent (optional)
    await HL7Message.updateOne({ _id: id }, { $set: { status: 'resent', resentAt: new Date() } });

    return NextResponse.json({ ackCode: ackCode ?? 'AA', ackControlId: ackControlId ?? null, ackRaw });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Resend failed' }, { status: 500 });
  }
}
