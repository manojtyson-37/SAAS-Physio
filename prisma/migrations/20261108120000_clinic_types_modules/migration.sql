-- CreateEnum
CREATE TYPE "ClinicType" AS ENUM ('PHYSIOTHERAPY', 'DENTAL', 'GENERAL', 'ORTHO', 'HOSPITAL');

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "clinicType" "ClinicType" NOT NULL DEFAULT 'PHYSIOTHERAPY',
ADD COLUMN     "enabledModules" TEXT[] DEFAULT ARRAY[]::TEXT[];


-- Every clinic that exists today had every module, so keep it that way: nothing disappears on upgrade.
UPDATE "Tenant"
SET "enabledModules" = ARRAY['opd','appointments','billing','packages','attendance','marketing','ratings']
WHERE cardinality("enabledModules") = 0;
