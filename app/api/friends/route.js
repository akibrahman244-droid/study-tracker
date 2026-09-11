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

  const myEmail = session.user.email;
  // আমার ডাটা নিয়ে আসছি
  const myData = await redis.get(`studyTracker:${myEmail}`) || {};
  
  const friends = myData.friends || [];
  const friendRequests = myData.friendRequests || [];

  // আমার যারা বন্ধু (Accepted friends), তাদের আসল কোর্স ডাটাগুলো নিয়ে আসবো
  const friendsActualData = [];
  for (const friendEmail of friends) {
    const fData = await redis.get(`studyTracker:${friendEmail}`);
    if (fData) {
      friendsActualData.push({
        email: friendEmail,
        courses: fData.myCourses || [], 
      });
    }
  }

  return Response.json({ 
    friends, 
    friendRequests, 
    friendsActualData 
  });
}

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const myEmail = session.user.email;
  const { action, targetEmail } = await req.json();

  if (!targetEmail || targetEmail === myEmail) {
    return Response.json({ error: "Invalid email" }, { status: 400 });
  }

  const myData = await redis.get(`studyTracker:${myEmail}`) || {};
  const targetData = await redis.get(`studyTracker:${targetEmail}`) || {};

  // ১. ফ্রেন্ড রিকোয়েস্ট পাঠানো
  if (action === "send_request") {
    if (!targetData.friendRequests) targetData.friendRequests = [];
    
    // যদি আগে থেকেই রিকোয়েস্ট না পাঠানো থাকে বা অলরেডি ফ্রেন্ড না হয়
    if (!targetData.friendRequests.includes(myEmail) && !(targetData.friends || []).includes(myEmail)) {
      targetData.friendRequests.push(myEmail);
      await redis.set(`studyTracker:${targetEmail}`, targetData);
    }
    return Response.json({ ok: true, message: "Friend request sent!" });
  }

  // ২. রিকোয়েস্ট অ্যাকসেপ্ট করা
  if (action === "accept_request") {
    // আমার ফ্রেন্ড লিস্টে তাকে অ্যাড করবো
    if (!myData.friends) myData.friends = [];
    if (!myData.friends.includes(targetEmail)) myData.friends.push(targetEmail);
    
    // আমার রিকোয়েস্ট লিস্ট থেকে তাকে রিমুভ করবো
    myData.friendRequests = (myData.friendRequests || []).filter(e => e !== targetEmail);
    await redis.set(`studyTracker:${myEmail}`, myData);

    // তার ফ্রেন্ড লিস্টেও আমাকে অ্যাড করে দিবো
    if (!targetData.friends) targetData.friends = [];
    if (!targetData.friends.includes(myEmail)) targetData.friends.push(myEmail);
    await redis.set(`studyTracker:${targetEmail}`, targetData);

    return Response.json({ ok: true, message: "Request accepted!" });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}