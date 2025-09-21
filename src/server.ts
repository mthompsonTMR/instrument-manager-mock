// src/server.ts
import dotenv from "dotenv";
dotenv.config();

import express, { Request, Response } from "express";
import cors from "cors";

import { connectIMMongo } from "./lib/mongo";
import HL7Message from "./models/HL7Message";
import { sendMLLP } from "./lib/mllpClient";
import { startMllpListener } from "./lib/mllpServer";

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: false }));

// Health check
app.get("/ping", async (_req: Request, res: Response) => {
  try {
    await connectIMMongo();
    res.json({
      status: "ok",
      mongo: "connected",
      db: process.env.MONGO_IM_URI,
    });
  } catch (err: any) {
    res.status(500).json({ status: "error", error: err.message });
  }
});

// GET /api/hl7/messages?limit=N → list recent (no raw in list)
app.get("/api/hl7/messages", async (req, res) => {
  try {
    await connectIMMongo();
    const limit = Math.min(parseInt(String(req.query.limit || 50), 10) || 50, 200);
    const q: any = {};
    if (req.query.controlId) q["meta.controlId"] = String(req.query.controlId);
    if (req.query.type)      q["meta.messageType"] = String(req.query.type);
    if (req.query.event)     q["meta.event"] = String(req.query.event);

    const docs = await HL7Message.find(q, { raw: 0 })
      .sort({ receivedAt: -1 })
      .limit(limit)
      .lean();
    res.json(docs);
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Server error" });
  }
});


// GET /api/hl7/messages/:id → retrieve one (includes raw)
app.get("/api/hl7/messages/:id", async (req: Request, res: Response) => {
  try {
    await connectIMMongo();
    const doc = await HL7Message.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ error: "Not found" });
    res.json(doc);
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Server error" });
  }
});

// POST /api/hl7/resend { id, host, port } → resend stored message via MLLP
app.post("/api/hl7/resend", async (req: Request, res: Response) => {
  try {
    await connectIMMongo();
    const { id, host, port } = req.body || {};
    if (!id || !host || !port) return res.status(400).json({ error: "id, host, port required" });

    const doc = await HL7Message.findById(id);
    if (!doc) return res.status(404).json({ error: "Message not found" });

    const { ackRaw } = await sendMLLP({ host, port: Number(port), message: doc.raw });

    const msa = (ackRaw.split("\r").find(l => l.startsWith("MSA|")) || "").split("|");
    const ackCode = msa[1] || "";
    const ackControlId = msa[2] || "";

    res.json({ ackCode, ackControlId, ackRaw });
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Resend failed" });
  }
});
// DELETE /api/hl7/messages/:id → delete one
app.delete("/api/hl7/messages/:id", async (req: Request, res: Response) => {
  try {
    await connectIMMongo();
    const r = await HL7Message.deleteOne({ _id: req.params.id });
    if (!r.deletedCount) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true, deleted: 1, id: req.params.id });
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Delete failed" });
  }
});

// Start HTTP API
const port = Number(process.env.PORT || 5001);
app.listen(port, () => {
  console.log(`[IM-Mock API] running at http://localhost:${port}`);
});

// Start MLLP listener (toggle with MLLP_ENABLED)
if (process.env.MLLP_ENABLED !== "false") {
  const mllpPort = Number(process.env.MLLP_PORT || 2575);
  startMllpListener(mllpPort);
  console.log(`[IM-Mock MLLP] listening on port ${mllpPort}`);
} else {
  console.log(`[IM-Mock MLLP] disabled via MLLP_ENABLED=false`);
}

