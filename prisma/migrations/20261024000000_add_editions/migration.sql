-- CreateTable
CREATE TABLE "UpgradeRequest" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'edition',
    "requestedEdition" TEXT,
    "requestedSeats" INTEGER,
    "currentPlan" TEXT NOT NULL,
    "message" TEXT,
    "trigger" TEXT,
    "requestedById" TEXT,
    "requestedByEmail" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UpgradeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanChange" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "fromPlan" TEXT NOT NULL,
    "toPlan" TEXT NOT NULL,
    "fromLimits" JSONB,
    "toLimits" JSONB,
    "changedById" TEXT,
    "changedByEmail" TEXT,
    "reason" TEXT,
    "requestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UpgradeRequest_teamId_idx" ON "UpgradeRequest"("teamId");

-- CreateIndex
CREATE INDEX "UpgradeRequest_status_idx" ON "UpgradeRequest"("status");

-- CreateIndex
CREATE INDEX "PlanChange_teamId_idx" ON "PlanChange"("teamId");

-- AddForeignKey
ALTER TABLE "UpgradeRequest" ADD CONSTRAINT "UpgradeRequest_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanChange" ADD CONSTRAINT "PlanChange_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
