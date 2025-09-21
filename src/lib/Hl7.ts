export type ParsedMeta = {
  messageType?: string;
  event?: string;
  controlId?: string;
  version?: string;
  sendingApp?: string;
  sendingFacility?: string;
};

export function splitSegments(hl7: string): string[] {
  return hl7
    .replace(/\r\n/g, "\r")
    .replace(/\n/g, "\r")
    .split("\r")
    .filter(Boolean);
}

export function parseMetaFromMSH(hl7: string): ParsedMeta {
  const segs = splitSegments(hl7);
  const msh = segs.find(s => s.startsWith("MSH"));
  if (!msh) return {};
  const fields = msh.split("|");
  const msgType = (fields[8] || "").split("^");
  return {
    messageType: msgType[0],
    event: msgType[1],
    controlId: fields[9],
    version: fields[11],
    sendingApp: fields[2],
    sendingFacility: fields[3],
  };
}

export function parseFirstOBX(hl7: string) {
  const segs = splitSegments(hl7);
  const obx = segs.find(s => s.startsWith("OBX|"));
  if (!obx) return undefined;
  const f = obx.split("|");
  return {
    setId: f[1],
    valueType: f[2],
    value: f[5],
    units: (f[6] || "").split("^")[0] || undefined,
    refRange: f[7],
    abnormalFlags: f[8],
  };
}
