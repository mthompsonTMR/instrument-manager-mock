import net from "net";

const VT = 0x0b, FS = 0x1c, CR = 0x0d;

function frameHL7(msg: string) {
  return Buffer.concat([Buffer.from([VT]), Buffer.from(msg, "utf8"), Buffer.from([FS, CR])]);
}

export async function sendMLLP(opts: { host: string; port: number; message: string; timeoutMs?: number }) {
  const { host, port, message, timeoutMs = 8000 } = opts;
  return new Promise<{ ackRaw: string }>((resolve, reject) => {
    const socket = new net.Socket();
    let buf = Buffer.alloc(0);
    let done = false;

    const finish = (err?: Error, ack?: string) => {
      if (done) return;
      done = true;
      socket.destroy();
      if (err) reject(err);
      else resolve({ ackRaw: ack! });
    };

    const timer = setTimeout(() => finish(new Error("ACK timeout")), timeoutMs);

    socket.on("data", (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      const fsIdx = buf.indexOf(FS);
      if (fsIdx >= 0 && buf[fsIdx + 1] === CR) {
        const vtIdx = buf.indexOf(VT);
        const payload = buf.slice(vtIdx + 1, fsIdx).toString("utf8");
        clearTimeout(timer);
        finish(undefined, payload);
      }
    });

    socket.on("error", (e) => { clearTimeout(timer); finish(e as Error); });
    socket.on("close", () => { clearTimeout(timer); if (!done) finish(new Error("Socket closed without ACK")); });

    socket.connect(port, host, () => socket.write(frameHL7(message)));
  });
}
