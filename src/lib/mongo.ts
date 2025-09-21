import mongoose from "mongoose";

let cached: { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null } = {
  conn: null,
  promise: null,
};

export async function connectIMMongo(uri = process.env.MONGO_IM_URI as string) {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose.connect(uri, {
      autoIndex: true,
    }).then((m) => m);
  }
  cached.conn = await cached.promise;
  return cached.conn;
}
