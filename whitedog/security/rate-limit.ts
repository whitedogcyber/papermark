import { ratelimit } from "@/lib/redis";

/** Sign-in attempts per IP: 10 per minute. Fails open if Redis is down. */
const signInLimiter = ratelimit(10, "1 m");

export async function allowSignInAttempt(ip: string): Promise<boolean> {
  try {
    const { success } = await signInLimiter.limit(`signin:${ip}`);
    return success;
  } catch (error) {
    console.error("Sign-in rate limit check failed:", error);
    return true;
  }
}
