import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { del } from "@vercel/blob";

import { getS3Client } from "./aws-client";

/**
 * Self-hosted image assets (logos, banners, avatars, link preview images).
 *
 * Upstream stores these in Vercel Blob. When NEXT_PUBLIC_UPLOAD_TRANSPORT is
 * "s3" they are stored in the upload bucket under `assets/` and served
 * publicly by /api/file/assets/[...path].
 */
export const ASSET_KEY_PREFIX = "assets/";
export const ASSET_ROUTE = "/api/file/assets/";

export function assetUrlForKey(key: string): string {
  const base = (
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    ""
  ).replace(/\/+$/, "");
  const path = key.slice(ASSET_KEY_PREFIX.length);
  return `${base}${ASSET_ROUTE}${path
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}

function assetKeyFromUrl(url: string): string | null {
  const idx = url.indexOf(ASSET_ROUTE);
  if (idx === -1) return null;
  const rest = url.slice(idx + ASSET_ROUTE.length).split("?")[0];
  const key = ASSET_KEY_PREFIX + rest.split("/").map(decodeURIComponent).join("/");
  return key.includes("..") ? null : key;
}

/**
 * Delete an image previously returned by uploadImage. Never throws: a failed
 * cleanup must not block saving or removing branding.
 */
export async function deleteImageAsset(url: string | null | undefined) {
  if (!url) return;
  try {
    const key = assetKeyFromUrl(url);
    if (key) {
      const bucket = process.env.NEXT_PRIVATE_UPLOAD_BUCKET;
      if (!bucket) return;
      await getS3Client().send(
        new DeleteObjectCommand({ Bucket: bucket, Key: key }),
      );
      return;
    }
    if (
      url.includes(".blob.vercel-storage.com") &&
      process.env.BLOB_READ_WRITE_TOKEN
    ) {
      await del(url);
    }
  } catch (error) {
    console.error("Failed to delete image asset:", url, error);
  }
}
