// src/app/api/hl7/resend/route.ts
import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import HL7Message from '../../../../models/HL7Message';
import net from 'net';

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

function frameMLLP(s: string) {
  return Buffer.concat([Buffer.from([0x0b]), Buffer.from(s, 'utf8'), Buffer.from([0x1c, 0x0d])]);
}
function unframeMLLP(buf: Buffer) {
  // strip leading 0x0b and trailing 0x1c 0x0d if present
  let start = 0;
  let end = buf.length;
  if (buf[0] === 0x0b) start = 1;
  if (end >= 2 && buf[end - 2] === 0x1c && buf[end - 1] === 0x0d) end -= 2;
  return buf.subarray(start, end).toString('utf8');
}

function parseAck(hl7: string) {
  // very simple MSA parser
  const segs = hl7.split(/\r\n?|\n/);
  const msa = segs.find(s => s.startsWith('MSA|'));
  if (!msa) return { ackCode: null, ackControlId: null };
  const f = msa.split('|');
  return {
    ackCode: f[1] || null,
    ackControlId: f[2] || null,
  };
}

export async function POST(req: Request) {
  try {
    await ensureMongo();
    const body = await req.json().catch(() => ({}));
    const id = body?.id as string;
    const host = String(body?.host || '127.0.0.1');
    const port = Number(body?.port || 2576); // default to your ACK port

    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    // fetch full doc (no projection) so we can get raw/rawHL7
    const doc: any = await HL7Message.findById(id).lean();
    if (!doc) {
      return NextResponse.json({ error: 'Message not found', id }, { status: 404 });
    }

    const candidateRaw = doc.raw ?? doc.rawHL7;
    let toSend = candidateRaw;

    if (!toSend) {
      // Build a minimal message if raw is missing (for debugging only)
      const mshControlId = doc?.meta?.controlId || `CTRL-${String(doc._id).slice(-6)}`;
      const now = new Date();
      const ts = now.toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
      const obxVal = doc?.firstObx?.value ?? 'PING';
      const obxUnits = doc?.firstObx?.units ?? '';
      toSend = [
        `MSH|^~\\&|IM|LAB|ACKAPP|ACKFAC|${ts}||ORU^R01|${mshControlId}|P|2.5.1`,
        `PID|||00000001||DOE^JOHN`,
        `OBR|1||A1|TEST^Demo`,
        `OBX|1|TX|NOTE^Note||${obxVal} ${obxUnits}|`,
      ].join('\r') + '\r';
    }

    const framed = frameMLLP(toSend);

    const debug: any = {
      target: { host, port },
      id,
      hasRaw: !!candidateRaw,
      payloadPreview: toSend.slice(0, 120),
      bytes: framed.length,
      startedAt: new Date().toISOString(),
    };

    const ack = await new Promise<Buffer>((resolve, reject) => {
      const sock = new net.Socket();
      let chunks: Buffer[] = [];
      let gotAck = false;

      sock.setTimeout(5000);
      sock.on('timeout', () => {
        sock.destroy();
        reject(new Error('Timeout waiting for ACK'));
      });

      sock.on('error', (e) => {
        reject(e);
      });

      sock.connect(port, host, () => {
        sock.write(framed);
      });

      sock.on('data', (d) => {
        chunks.push(d);
        // check if we saw the MLLP trailer
        const combined = Buffer.concat(chunks);
        if (combined.length >= 2 && combined[combined.length - 2] === 0x1c && combined[combined.length - 1] === 0x0d) {
          gotAck = true;
          sock.end();
        }
      });

      sock.on('close', () => {
        if (!gotAck && chunks.length === 0) {
          reject(new Error('Socket closed before ACK'));
        } else {
          resolve(Buffer.concat(chunks));
        }
      });
    });

    const ackText = unframeMLLP(ack);
    const parsed = parseAck(ackText);

    debug.finishedAt = new Date().toISOString();
    debug.ackBytes = ack.length;
    debug.ackPreview = ackText.slice(0, 200);
    debug.parsed = parsed;

    return NextResponse.json({
      ok: true,
      ...debug,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}
