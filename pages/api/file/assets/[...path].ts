import type { NextApiRequest, NextApiResponse } from "next";
import { Readable } from "node:stream";

import { GetObjectCommand } from "@aws-sdk/client-s3";

import { getS3Client } from "@/lib/files/aws-client";
import { ASSET_KEY_PREFIX } from "@/lib/files/image-assets";

// Public read access to branding/profile images stored under assets/ in the
// upload bucket. Logos must be visible to anonymous link viewers. Nothing
// outside the assets/ prefix can be read through this route.

export const config = {
  api: { responseLimit: false },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", ["GET", "HEAD"]);
    return res.status(405).end();
  }

  const parts = ([] as string[]).concat(req.query.path ?? []);
  if (
    parts.length === 0 ||
    parts.some((p) => !p || p === "." || p === ".." || p.includes("\\"))
  ) {
    return res.status(400).end();
  }

  const bucket = process.env.NEXT_PRIVATE_UPLOAD_BUCKET;
  if (!bucket) return res.status(500).end();

  try {
    const obj = await getS3Client().send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: ASSET_KEY_PREFIX + parts.join("/"),
      }),
    );

    const contentType = obj.ContentType || "application/octet-stream";
    res.setHeader("Content-Type", contentType);
    if (obj.ContentLength != null) {
      res.setHeader("Content-Length", String(obj.ContentLength));
    }
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("X-Content-Type-Options", "nosniff");
    if (contentType.includes("svg")) {
      // Never let an uploaded SVG run scripts when opened directly.
      res.setHeader(
        "Content-Security-Policy",
        "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      );
    }

    if (req.method === "HEAD" || !obj.Body) return res.status(200).end();
    (obj.Body as Readable).pipe(res);
  } catch (error: any) {
    const status =
      error?.name === "NoSuchKey" || error?.$metadata?.httpStatusCode === 404
        ? 404
        : 500;
    if (status === 500) console.error("Asset read failed:", error);
    return res.status(status).end();
  }
}
