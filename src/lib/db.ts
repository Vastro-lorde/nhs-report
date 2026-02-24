/* ──────────────────────────────────────────
   Mongoose connection singleton (Next.js safe)
   ────────────────────────────────────────── */
import mongoose, { Connection } from "mongoose";
import { env } from "@/lib/env";

/* global cache so hot-reload doesn't open new connections */
interface MongooseCache {
  conn: Connection | null;
  promise: Promise<Connection> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var __mongooseCache: MongooseCache | undefined;
}

const cached: MongooseCache = global.__mongooseCache ?? {
  conn: null,
  promise: null,
};
global.__mongooseCache = cached;

export async function connectDB(): Promise<Connection> {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(env.MONGODB_URI(), {
        bufferCommands: false,
      })
      .then((m) => m.connection);
  }

  cached.conn = await cached.promise;
  return cached.conn;
}
