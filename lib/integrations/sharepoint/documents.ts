import { Upload } from "@aws-sdk/lib-storage";
import { DocumentStorageType } from "@prisma/client";
import slugify from "@sindresorhus/slugify";
import path from "node:path";
import { Readable } from "node:stream";

import { processDocument } from "@/lib/api/documents/process-document";
import { SUPPORTED_DOCUMENT_MIME_TYPES } from "@/lib/constants";
import { getTeamS3ClientAndConfig } from "@/lib/files/aws-client";
import { newId } from "@/lib/id-helper";
import prisma from "@/lib/prisma";
import {
  convertCadToPdfTask,
  convertFilesToPdfTask,
  convertKeynoteToPdfTask,
} from "@/lib/trigger/convert-files";
import { processVideo } from "@/lib/trigger/optimize-video-files";
import { convertPdfToImageRoute } from "@/lib/trigger/pdf-to-image-route";
import { getSupportedContentType } from "@/lib/utils/get-content-type";
import { conversionQueueName } from "@/lib/utils/trigger-utils";

import { GraphDriveItem, downloadItem } from "./graph";

// Extension fallback for when SharePoint reports a generic mime type.
const EXT_MIME: Record<string, string> = {
  pdf: "application/pdf",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xlsm: "application/vnd.ms-excel.sheet.macroEnabled.12",
  csv: "text/csv",
  tsv: "text/tab-separated-values",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  odt: "application/vnd.oasis.opendocument.text",
  rtf: "application/rtf",
  txt: "text/plain",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  odp: "application/vnd.oasis.opendocument.presentation",
  key: "application/vnd.apple.keynote",
  dwg: "image/vnd.dwg",
  dxf: "image/vnd.dxf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  zip: "application/zip",
  mp4: "video/mp4",
  mov: "video/quicktime",
  avi: "video/x-msvideo",
  webm: "video/webm",
  ogg: "video/ogg",
  m4a: "audio/mp4",
  mp3: "audio/mpeg",
  kml: "application/vnd.google-earth.kml+xml",
  kmz: "application/vnd.google-earth.kmz",
  msg: "application/vnd.ms-outlook",
};

export const SHAREPOINT_DOCS_FOLDER_PATH = "/sharepoint";

export function maxFileBytes(): number {
  const mb = Number(process.env.SHAREPOINT_MAX_FILE_MB || 500);
  return (Number.isFinite(mb) && mb > 0 ? mb : 500) * 1024 * 1024;
}

/** Mime type Papermark can handle for this item, or null to skip it. */
export function resolveContentType(item: GraphDriveItem): string | null {
  if (item.name.startsWith("~$")) return null; // Office lock files
  const reported = item.file?.mimeType;
  if (reported && SUPPORTED_DOCUMENT_MIME_TYPES.includes(reported)) {
    return reported;
  }
  const ext = path.extname(item.name).slice(1).toLowerCase();
  return EXT_MIME[ext] ?? null;
}

async function copyToStorage({
  teamId,
  driveId,
  item,
  contentType,
}: {
  teamId: string;
  driveId: string;
  item: GraphDriveItem;
  contentType: string;
}): Promise<{ key: string; size: number }> {
  const { client, config } = await getTeamS3ClientAndConfig(teamId);
  const { name, ext } = path.parse(item.name);
  const key = `${teamId}/${newId("doc")}/${slugify(name) || "file"}${ext.toLowerCase()}`;

  const res = await downloadItem(driveId, item.id);
  const upload = new Upload({
    client,
    params: {
      Bucket: config.bucket,
      Key: key,
      Body: Readable.fromWeb(res.body as any),
      ContentType: contentType,
    },
  });
  await upload.done();
  return {
    key,
    size: item.size ?? Number(res.headers.get("content-length") || 0),
  };
}

async function ensureTeamFolder(teamId: string) {
  await prisma.folder.upsert({
    where: { teamId_path: { teamId, path: SHAREPOINT_DOCS_FOLDER_PATH } },
    create: { teamId, name: "SharePoint", path: SHAREPOINT_DOCS_FOLDER_PATH },
    update: {},
  });
}

/** New Papermark document from a SharePoint file. */
export async function createDocumentFromItem({
  teamId,
  teamPlan,
  userId,
  driveId,
  item,
  contentType,
}: {
  teamId: string;
  teamPlan: string;
  userId?: string;
  driveId: string;
  item: GraphDriveItem;
  contentType: string;
}): Promise<string> {
  await ensureTeamFolder(teamId);
  const { key, size } = await copyToStorage({
    teamId,
    driveId,
    item,
    contentType,
  });
  const type = getSupportedContentType(contentType)!;

  const document = await processDocument({
    documentData: {
      name: item.name,
      key,
      storageType: DocumentStorageType.S3_PATH,
      contentType,
      supportedFileType: type,
      fileSize: size,
      // PDFs get their page count from the conversion task.
      numPages: type === "pdf" ? undefined : 1,
      enableExcelAdvancedMode: false,
    },
    teamId,
    teamPlan,
    userId,
    folderPathName: SHAREPOINT_DOCS_FOLDER_PATH.slice(1),
  });
  return document.id;
}

/** New primary version of an existing document, same as a manual re-upload. */
export async function createVersionFromItem({
  teamId,
  teamPlan,
  documentId,
  driveId,
  item,
  contentType,
}: {
  teamId: string;
  teamPlan: string;
  documentId: string;
  driveId: string;
  item: GraphDriveItem;
  contentType: string;
}): Promise<void> {
  const { key, size } = await copyToStorage({
    teamId,
    driveId,
    item,
    contentType,
  });
  const type = getSupportedContentType(contentType)!;

  const latest = await prisma.documentVersion.findFirst({
    where: { documentId },
    orderBy: { versionNumber: "desc" },
    select: { versionNumber: true },
  });

  const version = await prisma.$transaction(async (tx) => {
    const v = await tx.documentVersion.create({
      data: {
        documentId,
        file: key,
        originalFile: key,
        type,
        storageType: DocumentStorageType.S3_PATH,
        contentType,
        numPages: type === "pdf" ? null : 1,
        isPrimary: true,
        versionNumber: (latest?.versionNumber ?? 0) + 1,
        fileSize: size,
      },
    });
    await tx.documentVersion.updateMany({
      where: { documentId, id: { not: v.id } },
      data: { isPrimary: false },
    });
    return v;
  });

  const options = (suffix: string) => ({
    idempotencyKey: `${teamId}-${version.id}${suffix}`,
    tags: [`team_${teamId}`, `document_${documentId}`, `version:${version.id}`],
    queue: conversionQueueName(teamPlan),
    concurrencyKey: teamId,
  });
  const payload = { documentId, documentVersionId: version.id, teamId };

  if (
    type === "slides" &&
    (contentType === "application/vnd.apple.keynote" ||
      contentType === "application/x-iwork-keynote-sffkey")
  ) {
    await convertKeynoteToPdfTask.trigger(payload, options("-keynote"));
  } else if (type === "docs" || type === "slides") {
    await convertFilesToPdfTask.trigger(payload, options("-docs"));
  } else if (type === "cad") {
    await convertCadToPdfTask.trigger(payload, options("-cad"));
  } else if (
    type === "video" &&
    contentType !== "video/mp4" &&
    contentType.startsWith("video/")
  ) {
    await processVideo.trigger(
      {
        videoUrl: key,
        teamId,
        docId: key.split("/")[1],
        documentVersionId: version.id,
        fileSize: size,
      },
      options(""),
    );
  } else if (type === "pdf") {
    await convertPdfToImageRoute.trigger(
      { ...payload, versionNumber: version.versionNumber },
      options(""),
    );
  }
}
