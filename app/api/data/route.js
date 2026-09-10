import { Redis } from "@upstash/redis";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";

const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const data = await redis.get(`studyTracker:${session.user.email}`);
  return Response.json(data || null);
}

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  await redis.set(`studyTracker:${session.user.email}`, body);
  return Response.json({ ok: true });
}
