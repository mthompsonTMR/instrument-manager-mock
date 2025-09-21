// CHANGE THESE TWO LINES ↓
import HL7Message from "../models/HL7Message";
import { parseMetaFromMSH, parseFirstOBX } from "../lib/Hl7";

export async function persistHL7(raw: string) {
  const meta = parseMetaFromMSH(raw);
  const firstObx = parseFirstOBX(raw);
  const doc = await HL7Message.create({ raw, meta, firstObx, receivedAt: new Date() });
  return doc;
}
