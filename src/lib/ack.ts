// src/lib/ack.ts

const VT = 0x0b;  // <SB>
const FS = 0x1c;  // <FS>
const CR = 0x0d;  // <CR>

// Build a minimal HL7 ACK
export function buildAck(hl7: string, ackCode: "AA" | "AE" | "AR" = "AA") {
  const lines = hl7.trim().split(/\r?\n|\r/);
  const msh = lines.find(l => l.startsWith("MSH")) || "";
  const f = msh.split("|");

  const sendingApp = f[2] || "UNKNOWN";
  const sendingFac = f[3] || "UNKNOWN";
  const receivingApp = f[4] || "IM";
  const receivingFac = f[5] || "LAB";
  const ctrlId = f[9] || "1";
  const version = f[11] || "2.5.1";

  const msgType = f[8] || "ACK^A01";
  const trigger = msgType.includes("^") ? msgType.split("^")[1] : "";
  const ackType = trigger ? `ACK^${trigger}` : "ACK";

  const now = new Date();
  const ts = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,"0")}${String(now.getDate()).padStart(2,"0")}${String(now.getHours()).padStart(2,"0")}${String(now.getMinutes()).padStart(2,"0")}${String(now.getSeconds()).padStart(2,"0")}`;

  const MSH = [
    "MSH", "^~\\&", receivingApp, receivingFac, sendingApp, sendingFac,
    ts, "", ackType, `${ctrlId}.ACK`, "P", version
  ].join("|") + "\r";

  const MSA = ["MSA", ackCode, ctrlId].join("|") + "\r";

  return MSH + MSA;
}

// ✅ wrap HL7 message into MLLP frame <VT> ... <FS><CR>
export function mllpWrap(msg: string) {
  return Buffer.concat([
    Buffer.from([VT]),
    Buffer.from(msg, "utf8"),
    Buffer.from([FS, CR]),
  ]);
}
