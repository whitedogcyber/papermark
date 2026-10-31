/**
 * S3 storage settings, read from the environment.
 *
 *   NEXT_PRIVATE_UPLOAD_BUCKET, NEXT_PRIVATE_UPLOAD_REGION,
 *   NEXT_PRIVATE_UPLOAD_ACCESS_KEY_ID, NEXT_PRIVATE_UPLOAD_SECRET_ACCESS_KEY,
 *   NEXT_PRIVATE_UPLOAD_ENDPOINT (optional, S3-compatible stores),
 *   NEXT_PRIVATE_UPLOAD_DISTRIBUTION_HOST (+ _KEY_ID / _KEY_CONTENTS for
 *   signed CloudFront URLs), NEXT_PRIVATE_ADVANCED_UPLOAD_BUCKET and
 *   NEXT_PRIVATE_ADVANCED_UPLOAD_DISTRIBUTION_HOST (advanced Excel),
 *   NEXT_PRIVATE_LAMBDA_FUNCTION_NAME (optional; zipping runs in-app without it)
 *
 * WhiteDog Share uses one storage location for every team.
 */
export type StorageConfig = {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint?: string;
  distributionHost?: string;
  distributionKeyId?: string;
  distributionKeyContents?: string;
  advancedBucket?: string;
  advancedDistributionHost?: string;
  lambdaFunctionName?: string;
};

const opt = (name: string) => process.env[name]?.trim() || undefined;

function req(name: string): string {
  const value = opt(name);
  if (!value) throw new Error(`Storage is not configured: ${name} is missing`);
  return value;
}

/** `_storageRegion` is accepted for call-site compatibility and ignored. */
export function getStorageConfig(_storageRegion?: string): StorageConfig {
  return {
    bucket: req("NEXT_PRIVATE_UPLOAD_BUCKET"),
    region: opt("NEXT_PRIVATE_UPLOAD_REGION") ?? "us-east-1",
    accessKeyId: req("NEXT_PRIVATE_UPLOAD_ACCESS_KEY_ID"),
    secretAccessKey: req("NEXT_PRIVATE_UPLOAD_SECRET_ACCESS_KEY"),
    endpoint: opt("NEXT_PRIVATE_UPLOAD_ENDPOINT"),
    distributionHost: opt("NEXT_PRIVATE_UPLOAD_DISTRIBUTION_HOST"),
    distributionKeyId: opt("NEXT_PRIVATE_UPLOAD_DISTRIBUTION_KEY_ID"),
    distributionKeyContents: opt(
      "NEXT_PRIVATE_UPLOAD_DISTRIBUTION_KEY_CONTENTS",
    ),
    advancedBucket: opt("NEXT_PRIVATE_ADVANCED_UPLOAD_BUCKET"),
    advancedDistributionHost: opt(
      "NEXT_PRIVATE_ADVANCED_UPLOAD_DISTRIBUTION_HOST",
    ),
    lambdaFunctionName: opt("NEXT_PRIVATE_LAMBDA_FUNCTION_NAME"),
  };
}

export async function getTeamStorageConfigById(
  _teamId: string,
): Promise<StorageConfig> {
  return getStorageConfig();
}
