import net from "net";
import { buildAck } from "../lib/ack";
import { persistHL7 } from "../services/persistHl7";

const VT = 0x0b;  // <SB>
const FS = 0x1c;  // <FS>
const CR = 0x0d;  // <CR>

function deframe(buffer: Buffer): string[] {
  // Extract one or more MLLP-framed messages from a chunk
  const msgs: string[] = [];
  let start = buffer.indexOf(VT);
  while (start !== -1) {
    const end = buffer.indexOf(FS, start + 1);
    if (end === -1) break; // wait for more data
    const cr = buffer[end + 1];
    const payload = buffer.slice(start + 1, end); // exclusive of FS
    if (cr === CR) msgs.push(payload.toString("utf8"));
    start = buffer.indexOf(VT, end + 2);
  }
  return msgs;
}

function frameAck(ack: string): Buffer {
  return Buffer.concat([Buffer.from([VT]), Buffer.from(ack, "utf8"), Buffer.from([FS, CR])]);
}

export function startMllpListener(port: number, host = "0.0.0.0") {
  const server = net.createServer((socket) => {
    let stash = Buffer.alloc(0);

    socket.on("data", (chunk) => {
      stash = Buffer.concat([stash, chunk]);
      const messages = deframe(stash);

      // If we found at least one full message, we’ll try to trim processed bytes.
      // For simplicity, rebuild stash from any trailing incomplete remainder:
      const lastFs = stash.lastIndexOf(FS);
      if (lastFs >= 0 && stash[lastFs + 1] === CR) {
        const nextStart = stash.indexOf(VT, lastFs + 2);
        stash = nextStart >= 0 ? stash.slice(nextStart) : Buffer.alloc(0);
      }

      for (const raw of messages) {
        // 1) Build ACK right away
        const ack = buildAck(raw, "AA");
        // 2) Send ACK (non-blocking)
        socket.write(frameAck(ack));

        // 3) Persist in the background; log errors but don't impact ACK
        (async () => {
          try {
            await persistHL7(raw);
          } catch (err) {
            console.error("[MLLP] Persist error (non-fatal):", (err as Error).message);
          }
        })();
      }
    });

    socket.on("error", (e) => console.error("[MLLP] socket error:", e));
  });

  server.on("error", (e) => console.error("[MLLP] server error:", e));
  server.listen(port, host, () => {
    console.log(`[MLLP] listening on ${host}:${port}`);
  });

  return server;
}
