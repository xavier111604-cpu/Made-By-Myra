import { headers } from "next/headers";
import { db } from "./db";

/**
 * Fixed-window rate limiter stored in Postgres, so it works across serverless instances
 * without an extra service. Returns true when the request is allowed.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowSeconds * 1000);
  try {
    const existing = await db.rateLimit.findUnique({ where: { key } });
    if (!existing || existing.windowStart < windowStart) {
      await db.rateLimit.upsert({
        where: { key },
        update: { count: 1, windowStart: now },
        create: { key, count: 1, windowStart: now },
      });
      return true;
    }
    if (existing.count >= limit) return false;
    await db.rateLimit.update({ where: { key }, data: { count: { increment: 1 } } });
    return true;
  } catch (err) {
    // Never block customers because the limiter itself failed
    console.error("rateLimit error", err);
    return true;
  }
}

export async function clientIp() {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] || h.get("x-real-ip") || "unknown").trim();
}

export async function limitByIp(bucket: string, limit: number, windowSeconds: number) {
  return rateLimit(`${bucket}:${await clientIp()}`, limit, windowSeconds);
}
