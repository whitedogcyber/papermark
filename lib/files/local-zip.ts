/**
 * Self-hosted replacement for Papermark's bulk-download AWS Lambda.
 *
 * Papermark builds dataroom ZIP archives by invoking an AWS Lambda whose
 * source is not part of this repository. On self-hosted installs (MinIO,
 * Kubernetes, etc.) there is no such Lambda, so `getLambdaClient*` returns
 * the client below instead. It accepts the same InvokeCommand payload,
 * streams the requested files from S3 into a ZIP, uploads the ZIP to the
 * archive bucket and answers with a Lambda-shaped response containing a
 * presigned `downloadUrl`, so every existing caller keeps working unchanged.
 *
 * No extra dependencies: the ZIP writer below stores files uncompressed
 * (documents are already compressed) and streams with constant memory.
 *
 * Env:
 *   NEXT_PRIVATE_LAMBDA_FUNCTION_NAME  unset -> local zipping is used
 *   PAPERMARK_LOCAL_ZIP=true           force local zipping even if set
 *   NEXT_PRIVATE_ZIP_PUBLIC_ENDPOINT   optional public S3 endpoint used only
 *                                      for signing download links, when the
 *                                      app reaches S3 on an internal address
 */
import type { StorageConfig } from "@/whitedog/storage/config";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { PassThrough, type Readable } from "node:stream";
import zlib from "node:zlib";

const MAX_PRESIGN_SECONDS = 7 * 24 * 60 * 60;
const ZIP32_LIMIT = 0xffffffff;

type FolderStructure = Record<
  string,
  {
    name: string;
    path: string;
    files: {
      name: string;
      key: string;
      type?: string;
      needsWatermark?: boolean;
    }[];
  }
>;

interface ZipPayload {
  sourceBucket: string;
  fileKeys: string[];
  folderStructure: FolderStructure;
  watermarkConfig?: { enabled?: boolean };
  dataroomName?: string;
  zipFileName?: string;
  expirationHours?: number;
}

export function shouldUseLocalZip(
  config: Pick<StorageConfig, "lambdaFunctionName">,
) {
  return (
    process.env.PAPERMARK_LOCAL_ZIP === "true" || !config.lambdaFunctionName
  );
}

function s3ClientFor(
  config: StorageConfig,
  endpoint?: string,
  region?: string,
) {
  const ep = endpoint || config.endpoint || undefined;
  return new S3Client({
    endpoint: ep,
    forcePathStyle: !!ep,
    region: region || config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

/** Client used only to sign download URLs that browsers will open. */
export function getPresignClient(config: StorageConfig, region?: string) {
  return s3ClientFor(
    config,
    process.env.NEXT_PRIVATE_ZIP_PUBLIC_ENDPOINT || undefined,
    region,
  );
}

/** Drop-in stand-in for LambdaClient: only `send(InvokeCommand)` is used. */
export function createLocalZipClient(config: StorageConfig) {
  return {
    async send(command: { input?: { Payload?: unknown } }) {
      const raw = command?.input?.Payload;
      const text =
        typeof raw === "string"
          ? raw
          : raw instanceof Uint8Array
            ? new TextDecoder().decode(raw)
            : "";
      if (!text) throw new Error("Local zip: missing invoke payload");

      const downloadUrl = await buildZip(config, JSON.parse(text));
      const body = JSON.stringify({ downloadUrl });
      return {
        StatusCode: 200,
        Payload: new TextEncoder().encode(
          JSON.stringify({ statusCode: 200, body }),
        ),
      };
    },
    destroy() {},
  };
}

async function buildZip(config: StorageConfig, p: ZipPayload): Promise<string> {
  if (!p?.sourceBucket || !Array.isArray(p.fileKeys) || !p.folderStructure) {
    throw new Error("Local zip: invalid payload");
  }

  const wanted = new Set(p.fileKeys);
  const entries: { key: string; name: string }[] = [];
  const used = new Set<string>();
  // Every folder becomes a directory entry, so empty folders are kept.
  const directories = new Set<string>();

  for (const [path, folder] of Object.entries(p.folderStructure)) {
    const dir = displayPath(path, p.folderStructure);
    if (dir) {
      const parts = dir.split("/");
      for (let i = 1; i <= parts.length; i++) {
        directories.add(parts.slice(0, i).join("/"));
      }
    }
    for (const file of folder.files ?? []) {
      if (!file.key || !wanted.has(file.key)) continue;
      if (p.watermarkConfig?.enabled && file.needsWatermark) {
        throw new Error(
          "Watermarked bulk downloads are not supported on this self-hosted instance. Turn off watermarking on the link, or download files one at a time.",
        );
      }
      const fileName = withExtension(clean(file.name) || "file", file.key);
      entries.push({
        key: file.key,
        name: unique(dir ? `${dir}/${fileName}` : fileName, used),
      });
    }
  }

  if (entries.length === 0 && directories.size === 0) {
    throw new Error("There are no files or folders to download.");
  }

  const s3 = s3ClientFor(config);
  const bucket =
    (config as { archiveBucket?: string }).archiveBucket ||
    process.env.NEXT_PRIVATE_ARCHIVE_BUCKET ||
    config.bucket;
  const baseName =
    clean(p.zipFileName || "") ||
    `${clean(p.dataroomName || "") || "dataroom"}-${new Date()
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "")}`;
  const key = `bulk-downloads/${randomUUID()}/${baseName}.zip`;

  const out = new PassThrough();
  const upload = new Upload({
    client: s3,
    params: {
      Bucket: bucket,
      Key: key,
      Body: out,
      ContentType: "application/zip",
    },
    queueSize: 2,
    partSize: 8 * 1024 * 1024,
  });
  const uploaded = upload.done();
  // Avoid an unhandled rejection if the producer fails first.
  uploaded.catch(() => {});

  try {
    const zip = new ZipWriter(out);
    for (const dir of [...directories].sort()) {
      await zip.addDirectory(dir);
    }
    for (const entry of entries) {
      const obj = await s3.send(
        new GetObjectCommand({ Bucket: p.sourceBucket, Key: entry.key }),
      );
      if (!obj.Body) throw new Error(`Local zip: empty object ${entry.key}`);
      await zip.addFile(entry.name, obj.Body as Readable);
    }
    await zip.finish();
    out.end();
  } catch (error) {
    out.destroy(error as Error);
    await upload.abort().catch(() => {});
    throw error;
  }

  await uploaded;

  const expiresIn = Math.min(
    Math.max(1, Math.round((p.expirationHours ?? 72) * 3600)),
    MAX_PRESIGN_SECONDS,
  );
  return getSignedUrl(
    getPresignClient(config),
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ResponseContentDisposition: `attachment; filename="${encodeURIComponent(`${baseName}.zip`)}"`,
    }),
    { expiresIn },
  );
}

// ---------------------------------------------------------------- names

function displayPath(path: string, fs: FolderStructure): string {
  const segments = path.split("/").filter(Boolean);
  const names: string[] = [];
  let prefix = "";
  for (const seg of segments) {
    prefix += `/${seg}`;
    names.push(clean(fs[prefix]?.name || seg) || seg);
  }
  return names.join("/");
}

function clean(name: string): string {
  return name
    .replace(/[\u0000-\u001f<>:"|?*\\/]/g, "_")
    .replace(/^\.+$/, "_")
    .trim()
    .slice(0, 200);
}

function withExtension(name: string, key: string): string {
  const last = key.split("/").pop() || "";
  const dot = last.lastIndexOf(".");
  if (dot <= 0) return name;
  const ext = last.slice(dot).toLowerCase();
  if (!/^\.[a-z0-9]{1,8}$/.test(ext)) return name;
  return name.toLowerCase().endsWith(ext) ? name : `${name}${ext}`;
}

function unique(name: string, used: Set<string>): string {
  let candidate = name;
  let n = 2;
  while (used.has(candidate.toLowerCase())) {
    const dot = name.lastIndexOf(".");
    const slash = name.lastIndexOf("/");
    candidate =
      dot > slash + 1
        ? `${name.slice(0, dot)} (${n})${name.slice(dot)}`
        : `${name} (${n})`;
    n++;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

// ---------------------------------------------------------------- zip

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

const nativeCrc32 = (
  zlib as unknown as {
    crc32?: (data: Uint8Array, value?: number) => number;
  }
).crc32;

function crc32(data: Uint8Array, prev: number): number {
  if (nativeCrc32) return nativeCrc32(data, prev);
  let c = (prev ^ 0xffffffff) >>> 0;
  for (let i = 0; i < data.length; i++) {
    c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function dosDateTime(d = new Date()) {
  const time =
    (d.getHours() << 11) |
    (d.getMinutes() << 5) |
    Math.floor(d.getSeconds() / 2);
  const date =
    ((Math.max(d.getFullYear(), 1980) - 1980) << 9) |
    ((d.getMonth() + 1) << 5) |
    d.getDate();
  return { time, date };
}

/**
 * Minimal streaming ZIP writer (STORE method, UTF-8 names, data
 * descriptors). Archives are limited to 4 GB; larger requests fail with a
 * clear error instead of producing a corrupt file.
 */
export class ZipWriter {
  private offset = 0;
  private central: Buffer[] = [];
  private count = 0;
  private stamp = dosDateTime();

  constructor(private out: NodeJS.WritableStream) {}

  private async write(buf: Buffer) {
    this.offset += buf.length;
    if (this.offset >= ZIP32_LIMIT) {
      throw new Error(
        "The archive is larger than 4 GB. Download smaller folders instead.",
      );
    }
    if (!this.out.write(buf)) await once(this.out as never, "drain");
  }

  /** Add an (empty) directory entry, e.g. "Folder/Sub". */
  async addDirectory(name: string) {
    const nameBuf = Buffer.from(name.replace(/\/+$/, "") + "/", "utf8");
    const headerOffset = this.offset;
    const flags = 0x0800; // UTF-8 names

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(flags, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(this.stamp.time, 10);
    local.writeUInt16LE(this.stamp.date, 12);
    local.writeUInt16LE(nameBuf.length, 26);
    await this.write(local);
    await this.write(nameBuf);

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(0x031e, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(flags, 8);
    cd.writeUInt16LE(0, 10);
    cd.writeUInt16LE(this.stamp.time, 12);
    cd.writeUInt16LE(this.stamp.date, 14);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt32LE(((0o40755 << 16) | 0x10) >>> 0, 38); // drwxr-xr-x + DOS dir
    cd.writeUInt32LE(headerOffset, 42);
    this.central.push(cd, nameBuf);
    this.count++;
  }

  async addFile(name: string, body: AsyncIterable<Uint8Array>) {
    const nameBuf = Buffer.from(name, "utf8");
    const headerOffset = this.offset;
    const flags = 0x0808; // data descriptor + UTF-8 names

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(flags, 6);
    local.writeUInt16LE(0, 8); // STORE
    local.writeUInt16LE(this.stamp.time, 10);
    local.writeUInt16LE(this.stamp.date, 12);
    // crc / sizes are zero here and follow in the data descriptor
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    await this.write(local);
    await this.write(nameBuf);

    let crc = 0;
    let size = 0;
    for await (const chunk of body) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      crc = crc32(buf, crc);
      size += buf.length;
      await this.write(buf);
    }

    const desc = Buffer.alloc(16);
    desc.writeUInt32LE(0x08074b50, 0);
    desc.writeUInt32LE(crc >>> 0, 4);
    desc.writeUInt32LE(size, 8);
    desc.writeUInt32LE(size, 12);
    await this.write(desc);

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(0x031e, 4); // made by: UNIX, 3.0
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(flags, 8);
    cd.writeUInt16LE(0, 10);
    cd.writeUInt16LE(this.stamp.time, 12);
    cd.writeUInt16LE(this.stamp.date, 14);
    cd.writeUInt32LE(crc >>> 0, 16);
    cd.writeUInt32LE(size, 20);
    cd.writeUInt32LE(size, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt32LE((0o100644 << 16) >>> 0, 38); // -rw-r--r--
    cd.writeUInt32LE(headerOffset, 42);
    this.central.push(cd, nameBuf);
    this.count++;
  }

  async finish() {
    if (this.count > 0xffff) {
      throw new Error("Too many files for one archive (max 65535).");
    }
    const cdOffset = this.offset;
    for (const buf of this.central) await this.write(buf);
    const cdSize = this.offset - cdOffset;

    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(this.count, 8);
    end.writeUInt16LE(this.count, 10);
    end.writeUInt32LE(cdSize, 12);
    end.writeUInt32LE(cdOffset, 16);
    await this.write(end);
  }
}
