import { NextApiRequest, NextApiResponse } from "next";

import { generateTriggerPublicAccessToken } from "@/lib/utils/generate-trigger-auth-token";

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { documentVersionId } = req.query;

  if (!documentVersionId || typeof documentVersionId !== "string") {
    return res.status(400).json({ error: "Document version ID is required" });
  }

  try {
    const publicAccessToken = await generateTriggerPublicAccessToken(
      `version:${documentVersionId}`,
    );
    // Tell the browser which Trigger.dev API issued the token (self-hosted).
    const baseURL = process.env.TRIGGER_API_URL || undefined;
    return res.status(200).json({ publicAccessToken, baseURL });
  } catch (error) {
    console.error("Error generating token:", error);
    return res.status(500).json({ error: "Failed to generate token" });
  }
}
