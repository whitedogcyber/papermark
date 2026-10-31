import { S3Store } from "@tus/s3-store";

import { getStorageConfig } from "./config";

/** tus datastore that writes resumable uploads to the upload bucket. */
export function createUploadStore(): S3Store {
  // Built at module load; don't crash the import if storage env is missing
  // (e.g. during the Next.js build). Uploads then fail with an S3 error.
  let config;
  try {
    config = getStorageConfig();
  } catch {
    config = {
      bucket: "unconfigured",
      region: "us-east-1",
      accessKeyId: "",
      secretAccessKey: "",
    } as ReturnType<typeof getStorageConfig>;
  }
  return new S3Store({
    partSize: 8 * 1024 * 1024,
    s3ClientConfig: {
      bucket: config.bucket,
      region: config.region,
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    },
  });
}
