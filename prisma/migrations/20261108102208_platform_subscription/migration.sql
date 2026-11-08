-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'ONBOARDING';

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "paidThrough" TIMESTAMP(3),
ADD COLUMN     "plan" TEXT,
ADD COLUMN     "selfServiceModules" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "subscriptionNote" TEXT,
ADD COLUMN     "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "trialEndsAt" TIMESTAMP(3),
ADD COLUMN     "trialStartedAt" TIMESTAMP(3);
