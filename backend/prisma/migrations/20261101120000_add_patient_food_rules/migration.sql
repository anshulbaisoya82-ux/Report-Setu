-- AlterTable: doctor-set food rules for each patient (nullable JSON, no data change)
ALTER TABLE "PatientProfile" ADD COLUMN "foodRules" JSONB;
