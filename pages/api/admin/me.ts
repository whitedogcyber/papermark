import { NextApiRequest, NextApiResponse } from "next";

import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { getServerSession } from "next-auth/next";

import { isPlatformAdminEmail } from "@/lib/editions-server/admin";
import { CustomUser } from "@/lib/types";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const session = await getServerSession(req, res, authOptions);
  const email = (session?.user as CustomUser | undefined)?.email;
  return res.status(200).json({ isAdmin: isPlatformAdminEmail(email) });
}
