import type { NextApiRequest, NextApiResponse } from "next";

import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getServerSession } from "next-auth/next";

import { getS3Client } from "@/lib/files/aws-client";
import { ASSET_KEY_PREFIX, assetUrlForKey } from "@/lib/files/image-assets";
import { nanoid } from "@/lib/utils";

import { authOptions } from "../auth/[...nextauth]";

// Self-hosted replacement for /api/file/image-upload (Vercel Blob).
// Same upload types and limits; stores the image in S3 under assets/.

const uploadConfig = {
  profile: {
    allowedContentTypes: ["image/png", "image/jpg", "image/jpeg"],
    maximumSizeInBytes: 2 * 1024 * 1024, // 2MB
  },
  assets: {
    allowedContentTypes: [
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/svg+xml",
      "image/x-icon",
      "image/ico",
      "image/vnd.microsoft.icon",
      "image/webp",
      "image/gif",
    ],
    maximumSizeInBytes: 5 * 1024 * 1024, // 5MB
  },
} as const;

export const config = {
  api: { bodyParser: { sizeLimit: "8mb" } }, // base64 of a 5MB image
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const type = Array.isArray(req.query.type)
    ? req.query.type[0]
    : req.query.type;
  if (!type || !(type in uploadConfig)) {
    return res.status(400).json({ error: "Invalid upload type specified." });
  }
  const limits = uploadConfig[type as keyof typeof uploadConfig];

  const { filename, contentType, data } = (req.body ?? {}) as {
    filename?: string;
    contentType?: string;
    data?: string; // base64
  };

  if (!filename || !contentType || !data) {
    return res.status(400).json({ error: "Missing file" });
  }
  if (!(limits.allowedContentTypes as readonly string[]).includes(contentType)) {
    return res.status(400).json({ error: "File type not allowed" });
  }

  const body = Buffer.from(data, "base64");
  if (body.length === 0 || body.length > limits.maximumSizeInBytes) {
    return res.status(400).json({ error: "File is empty or too large" });
  }

  const bucket = process.env.NEXT_PRIVATE_UPLOAD_BUCKET;
  if (!bucket) {
    return res.status(500).json({ error: "Storage is not configured" });
  }

  const safeName =
    filename
      .split(/[\\/]/)
      .pop()!
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .slice(0, 100) || "image";
  const key = `${ASSET_KEY_PREFIX}${type}/${nanoid()}/${safeName}`;

  try {
    await getS3Client().send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
  } catch (error) {
    console.error("Image upload to S3 failed:", error);
    return res.status(500).json({ error: "Upload failed" });
  }

  return res.status(200).json({ url: assetUrlForKey(key) });
}
