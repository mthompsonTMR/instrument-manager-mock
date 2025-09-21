// src/lib/mllpServer.ts
import net from "net";

type OnMessage = (hl7: string, socket: net.Socket) => Promise<void> | void;

const VT = 0x0b; // <VT>
const FS = 0x1c; // <FS>
const CR = 0x0d; // <CR>

export class MLLPServer {
  private server: net.Server | null = null;
  private bufMap = new Map<net.Socket, Buffer>();
  public running = false;

  constructor(
    private host = "0.0.0.0",
    private port = 6000,
    private onMessage?: OnMessage
  ) {}

  start() {
    if (this.running) return;
    this.server = net.createServer((socket) => {
      this.bufMap.set(socket, Buffer.alloc(0));

      socket.on("data", async (chunk) => {
        const prev = this.bufMap.get(socket) ?? Buffer.alloc(0);
        let data = Buffer.concat([prev, chunk]);

        // consume all complete MLLP frames: <VT> ... <FS><CR>
        while (true) {
          const start = data.indexOf(VT);
          const end = data.indexOf(FS);
          const cr = end >= 0 ? data.indexOf(CR, end) : -1;

          if (start === -1 || end === -1 || cr !== end + 1) {
            // incomplete frame -> keep buffering
            this.bufMap.set(socket, data);
            break;
          }

          const frame = data.slice(start + 1, end).toString("utf8");
          data = data.slice(cr + 1); // remaining bytes

          try {
            await this.onMessage?.(frame, socket);
          } catch {
            // keep socket alive even if handler fails
          }
        }
      });

      socket.on("close", () => this.bufMap.delete(socket));
      socket.on("error", () => this.bufMap.delete(socket));
    });

    this.server.listen(this.port, this.host);
    this.running = true;
  }

  stop() {
    if (!this.server) return;
    this.server.close();
    this.server = null;
    this.running = false;
    this.bufMap.clear();
  }

  status() {
    return { host: this.host, port: this.port, running: this.running };
  }
}

// ✅ build a minimal HL7 ACK (MSH/MSA) for a received message
export function buildAck(hl7: string, ackCode: "AA" | "AE" | "AR" = "AA") {
  const CR = "\r";
  const lines = hl7.trim().split(/\r?\n|\r/);
  const msh = lines.find((l) => l.startsWith("MSH"));
  const FS = "|";
  const SEP = "^~\\&";
  const now = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);

  let origSendingApp = "UNKNOWN";
  let origSendingFac = "UNKNOWN";
  let origReceivingApp = "IM";
  let origReceivingFac = "LAB";
  let ctrlId = "1";
  let version = "2.5.1";
  let trigger = "";

  if (msh) {
    const f = msh.split(FS);
    origSendingApp = f[2] || origSendingApp;   // MSH-3
    origSendingFac = f[3] || origSendingFac;   // MSH-4
    origReceivingApp = f[4] || origReceivingApp; // MSH-5
    origReceivingFac = f[5] || origReceivingFac; // MSH-6
    ctrlId = f[9] || ctrlId;                   // MSH-10 control ID
    version = f[11] || version;                // MSH-12
    const msgType = f[8] || "";                // MSH-9
    if (msgType.includes("^")) {
      const parts = msgType.split("^");
      trigger = parts[1] || "";
    }
  }

  // ACK MSH swaps sending/receiving
  const ackSendingApp = origReceivingApp;
  const ackSendingFac = origReceivingFac;
  const ackRecvApp = origSendingApp;
  const ackRecvFac = origSendingFac;
  const ackType = trigger ? `ACK^${trigger}` : "ACK";

  const MSH =
    ["MSH", SEP, ackSendingApp, ackSendingFac, ackRecvApp, ackRecvFac,
     now, "", ackType, `${ctrlId}.ACK`, "P", version].join(FS) + CR;

  const MSA = ["MSA", ackCode, ctrlId].join(FS) + CR;

  return MSH + MSA;
}

// ✅ wrap a plain HL7 string in MLLP <VT> ... <FS><CR>
export function mllpWrap(s: string) {
  return Buffer.concat([Buffer.from([VT]), Buffer.from(s, "utf8"), Buffer.from([FS, CR])]);
}

// Optional helper used by server.ts or a singleton
export function startMllpListener(port: number, host = "0.0.0.0") {
  const handler: OnMessage = async (hl7, socket) => {
    try {
      // dynamic import to avoid circular deps for UI builds
      const { persistHL7 } = await import("../services/persistHl7");
      await persistHL7(hl7);
    } catch {
      // ignore persist errors to not block ACK
    } finally {
      const ack = buildAck(hl7, "AA");
      socket.write(mllpWrap(ack));
    }
  };

  const mllp = new MLLPServer(host, port, handler);
  mllp.start();
  return mllp;
}
