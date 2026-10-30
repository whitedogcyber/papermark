-- CreateTable
CREATE TABLE "SharePointSync" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "dataroomId" TEXT NOT NULL,
    "dataroomFolderId" TEXT,
    "siteId" TEXT NOT NULL,
    "siteName" TEXT NOT NULL,
    "siteUrl" TEXT NOT NULL,
    "driveId" TEXT NOT NULL,
    "driveName" TEXT NOT NULL,
    "rootItemId" TEXT NOT NULL,
    "rootPath" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "lastError" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "needsSync" BOOLEAN NOT NULL DEFAULT true,
    "lockedUntil" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SharePointSync_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SharePointSyncItem" (
    "id" TEXT NOT NULL,
    "syncId" TEXT NOT NULL,
    "driveItemId" TEXT NOT NULL,
    "parentDriveItemId" TEXT,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cTag" TEXT,
    "documentId" TEXT,
    "dataroomDocumentId" TEXT,
    "dataroomFolderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SharePointSyncItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SharePointSubscription" (
    "id" TEXT NOT NULL,
    "driveId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SharePointSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SharePointSync_teamId_idx" ON "SharePointSync"("teamId");

-- CreateIndex
CREATE INDEX "SharePointSync_dataroomId_idx" ON "SharePointSync"("dataroomId");

-- CreateIndex
CREATE INDEX "SharePointSync_driveId_idx" ON "SharePointSync"("driveId");

-- CreateIndex
CREATE UNIQUE INDEX "SharePointSyncItem_syncId_driveItemId_key" ON "SharePointSyncItem"("syncId", "driveItemId");

-- CreateIndex
CREATE UNIQUE INDEX "SharePointSubscription_driveId_key" ON "SharePointSubscription"("driveId");

-- AddForeignKey
ALTER TABLE "SharePointSync" ADD CONSTRAINT "SharePointSync_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharePointSync" ADD CONSTRAINT "SharePointSync_dataroomId_fkey" FOREIGN KEY ("dataroomId") REFERENCES "Dataroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharePointSync" ADD CONSTRAINT "SharePointSync_dataroomFolderId_fkey" FOREIGN KEY ("dataroomFolderId") REFERENCES "DataroomFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharePointSyncItem" ADD CONSTRAINT "SharePointSyncItem_syncId_fkey" FOREIGN KEY ("syncId") REFERENCES "SharePointSync"("id") ON DELETE CASCADE ON UPDATE CASCADE;
