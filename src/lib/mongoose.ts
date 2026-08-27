import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error("MONGODB_URI is not set. Add it to .env.local (see README).");
}

interface Cached {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

const globalForMongoose = globalThis as unknown as { __mongoose?: Cached };

const cached: Cached =
  globalForMongoose.__mongoose ?? { conn: null, promise: null };
globalForMongoose.__mongoose = cached;

/** Cached serverless-safe Mongo connection. */
export async function connectDB() {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI as string, {
      dbName: "ajaia-docs",
      serverSelectionTimeoutMS: 10000,
    });
  }
  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }
  return cached.conn;
}
