import { kv } from "@vercel/kv";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const data = await kv.get(`studyTracker:${session.user.email}`);
  return Response.json(data || null);
}

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  await kv.set(`studyTracker:${session.user.email}`, body);
  return Response.json({ ok: true });
}