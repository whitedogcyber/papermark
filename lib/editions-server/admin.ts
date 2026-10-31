import { NextApiRequest, NextApiResponse } from "next";

import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { getServerSession } from "next-auth/next";

import { CustomUser } from "@/lib/types";

/**
 * Platform admins manage editions for every team. Set
 * PLATFORM_ADMIN_EMAILS to a comma-separated list of emails.
 */
export function platformAdminEmails(): string[] {
  return (process.env.PLATFORM_ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isPlatformAdminEmail(email?: string | null): boolean {
  return !!email && platformAdminEmails().includes(email.toLowerCase());
}

/** Returns the admin user, or null after sending 401/403. */
export async function requirePlatformAdmin(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<CustomUser | null> {
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  const user = session.user as CustomUser;
  if (!isPlatformAdminEmail(user.email)) {
    res.status(403).json({ error: "Forbidden" });
    return null;
  }
  return user;
}
