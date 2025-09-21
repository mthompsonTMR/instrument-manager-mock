// src/models/HL7Message.ts
import mongoose, { Schema, Model } from 'mongoose';

export interface FirstObx {
  setId?: string;
  valueType?: string;
  value?: string;
  units?: string;
  refRange?: string;
  abnormalFlags?: string;
}

export interface HL7MessageDoc {
  raw: string;
  meta?: {
    messageType?: string;
    event?: string;
    controlId?: string;     // no inline index here
    version?: string;
    sendingApp?: string;
    sendingFacility?: string;
  };
  firstObx?: FirstObx;
  receivedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const FirstObxSchema = new Schema<FirstObx>(
  {
    setId: String,
    valueType: String,
    value: String,
    units: String,
    refRange: String,
    abnormalFlags: String,
  },
  { _id: false }
);

const HL7MessageSchema = new Schema<HL7MessageDoc>(
  {
    raw: { type: String, required: true },
    meta: {
      messageType: String,
      event: String,
      controlId: String, // <- removed { index: true } to avoid duplicate index
      version: String,
      sendingApp: String,
      sendingFacility: String,
    },
    firstObx: FirstObxSchema,
    receivedAt: { type: Date, default: Date.now },
  },
  {
    collection: 'hl7messages', // match Atlas
    timestamps: true,
    versionKey: false,         // hides __v automatically
  }
);

// Make _id a string when serializing
HL7MessageSchema.set('toJSON', {
  virtuals: false,
  transform: (_doc: any, ret: any) => {
    if (ret?._id) ret._id = String(ret._id);
    return ret;
  },
});

// Unique (sparse) by controlId when present
HL7MessageSchema.index({ 'meta.controlId': 1 }, { unique: true, sparse: true });

// Fast recent-first listing
HL7MessageSchema.index({ receivedAt: -1 });

const HL7Message: Model<HL7MessageDoc> =
  mongoose.models.HL7Message ||
  mongoose.model<HL7MessageDoc>('HL7Message', HL7MessageSchema);

export default HL7Message;
