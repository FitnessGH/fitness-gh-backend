-- CreateIndex
CREATE INDEX "payments_membershipId_status_createdAt_idx" ON "payments"("membershipId", "status", "createdAt");
