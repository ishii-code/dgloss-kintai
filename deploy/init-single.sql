-- ディグロス勤怠 初期セットアップ（1文版：Vercel内蔵Query等の「複数文不可」対策）
-- 全体を1つのDOブロックに包み、テーブル・enum・index・FK・デモ従業員を作る。
-- 何度実行してもよい（初期セットアップのため既存を掃除して作り直す）。
DO $$
BEGIN
  DROP TABLE IF EXISTS "ImprovementRequest","MonthlyClosing","WorkDay","Stamp","EmploymentContract","Employee" CASCADE;
  DROP TYPE IF EXISTS "WorkSystem","OfficeDivision","EmploymentType","StampType","StampSource","DayType","LeaveType","ClosingStatus","ImprovementRequestStatus","ImprovementRequestCategory";

  CREATE TYPE "WorkSystem" AS ENUM ('fixed','flex','shift','discretionary');
  CREATE TYPE "OfficeDivision" AS ENUM ('headquarters','corporate_sales','personal_sales');
  CREATE TYPE "EmploymentType" AS ENUM ('regular','non_regular');
  CREATE TYPE "StampType" AS ENUM ('clock_in','clock_out','break_start','break_end','entry','exit','pc_login','pc_logout');
  CREATE TYPE "StampSource" AS ENUM ('manual','ic_card','pc_log','jinjer_api');
  CREATE TYPE "DayType" AS ENUM ('workday','legal_holiday','scheduled_holiday');
  CREATE TYPE "LeaveType" AS ENUM ('paid_full','paid_half','special','compensatory','absence');
  CREATE TYPE "ClosingStatus" AS ENUM ('open','closed');
  CREATE TYPE "ImprovementRequestStatus" AS ENUM ('open','planned','in_progress','done','rejected');
  CREATE TYPE "ImprovementRequestCategory" AS ENUM ('feature','bug','other');

  CREATE TABLE "Employee" (
    "id" TEXT NOT NULL, "employeeCode" TEXT NOT NULL, "name" TEXT NOT NULL,
    "email" TEXT, "hiredOn" DATE NOT NULL, "retiredOn" DATE,
    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id"));

  CREATE TABLE "EmploymentContract" (
    "id" TEXT NOT NULL, "employeeId" TEXT NOT NULL,
    "employmentType" "EmploymentType" NOT NULL, "workSystem" "WorkSystem" NOT NULL,
    "office" "OfficeDivision" NOT NULL, "isManagerialEmployee" BOOLEAN NOT NULL,
    "basicSalary" INTEGER NOT NULL, "annualScheduledWorkingHours" DOUBLE PRECISION NOT NULL,
    "fixedOvertimeAllowance" INTEGER NOT NULL, "coverageOvertime" BOOLEAN NOT NULL,
    "coverageOvertimeOver60" BOOLEAN NOT NULL, "coverageHoliday" BOOLEAN NOT NULL,
    "coverageNight" BOOLEAN NOT NULL,
    CONSTRAINT "EmploymentContract_pkey" PRIMARY KEY ("id"));

  CREATE TABLE "Stamp" (
    "id" TEXT NOT NULL, "employeeId" TEXT NOT NULL, "type" "StampType" NOT NULL,
    "stampedAt" TIMESTAMP(3) NOT NULL, "source" "StampSource" NOT NULL, "note" TEXT,
    CONSTRAINT "Stamp_pkey" PRIMARY KEY ("id"));

  CREATE TABLE "WorkDay" (
    "id" TEXT NOT NULL, "employeeId" TEXT NOT NULL, "date" DATE NOT NULL,
    "dayType" "DayType" NOT NULL, "scheduledStart" TEXT, "scheduledEnd" TEXT,
    "actualWorkedMinutes" INTEGER NOT NULL, "breakMinutes" INTEGER NOT NULL,
    "absenceMinutes" INTEGER NOT NULL, "leave" "LeaveType",
    "nonStatutoryOvertimeMinutes" INTEGER NOT NULL, "statutoryOvertimeMinutes" INTEGER NOT NULL,
    "legalHolidayMinutes" INTEGER NOT NULL, "scheduledHolidayMinutes" INTEGER NOT NULL,
    "nightMinutes" INTEGER NOT NULL,
    CONSTRAINT "WorkDay_pkey" PRIMARY KEY ("id"));

  CREATE TABLE "MonthlyClosing" (
    "id" TEXT NOT NULL, "employeeId" TEXT NOT NULL, "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL, "status" "ClosingStatus" NOT NULL,
    "totalWorkedMinutes" INTEGER NOT NULL, "nonStatutoryOvertimeMinutes" INTEGER NOT NULL,
    "statutoryOvertimeMinutes" INTEGER NOT NULL, "legalHolidayMinutes" INTEGER NOT NULL,
    "scheduledHolidayMinutes" INTEGER NOT NULL, "nightMinutes" INTEGER NOT NULL,
    "overtimeAllowance" INTEGER NOT NULL, "overtimeOver60Allowance" INTEGER NOT NULL,
    "holidayAllowance" INTEGER NOT NULL, "nightAllowance" INTEGER NOT NULL,
    "premiumTotal" INTEGER NOT NULL, "fixedOvertimeAdditionalPayment" INTEGER NOT NULL,
    "latenessDeduction" INTEGER NOT NULL, "closedAt" TIMESTAMP(3),
    CONSTRAINT "MonthlyClosing_pkey" PRIMARY KEY ("id"));

  CREATE UNIQUE INDEX "Employee_employeeCode_key" ON "Employee"("employeeCode");
  CREATE INDEX "Employee_employeeCode_idx" ON "Employee"("employeeCode");
  CREATE UNIQUE INDEX "EmploymentContract_employeeId_key" ON "EmploymentContract"("employeeId");
  CREATE INDEX "Stamp_employeeId_stampedAt_idx" ON "Stamp"("employeeId","stampedAt");
  CREATE INDEX "WorkDay_employeeId_date_idx" ON "WorkDay"("employeeId","date");
  CREATE UNIQUE INDEX "WorkDay_employeeId_date_key" ON "WorkDay"("employeeId","date");
  CREATE INDEX "MonthlyClosing_employeeId_year_month_idx" ON "MonthlyClosing"("employeeId","year","month");
  CREATE UNIQUE INDEX "MonthlyClosing_employeeId_year_month_key" ON "MonthlyClosing"("employeeId","year","month");

  CREATE TABLE "ImprovementRequest" (
    "id" TEXT NOT NULL, "createdByEmployeeId" TEXT NOT NULL,
    "category" "ImprovementRequestCategory" NOT NULL, "title" TEXT NOT NULL,
    "body" TEXT NOT NULL, "status" "ImprovementRequestStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL, "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ImprovementRequest_pkey" PRIMARY KEY ("id"));
  CREATE INDEX "ImprovementRequest_status_idx" ON "ImprovementRequest"("status");
  CREATE INDEX "ImprovementRequest_createdAt_idx" ON "ImprovementRequest"("createdAt");

  ALTER TABLE "EmploymentContract" ADD CONSTRAINT "EmploymentContract_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE "Stamp" ADD CONSTRAINT "Stamp_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE "WorkDay" ADD CONSTRAINT "WorkDay_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE "MonthlyClosing" ADD CONSTRAINT "MonthlyClosing_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

  INSERT INTO "Employee"(id,"employeeCode",name,email,"hiredOn") VALUES
    ('emp_0001','0001','山田 太郎',NULL,'2020-04-01'),
    ('emp_0002','0002','佐藤 花子',NULL,'2021-04-01'),
    ('emp_0003','0003','鈴木 一郎',NULL,'2018-10-01'),
    ('emp_0004','0004','田中 みどり',NULL,'2023-06-01');

  INSERT INTO "EmploymentContract"(id,"employeeId","employmentType","workSystem",office,"isManagerialEmployee","basicSalary","annualScheduledWorkingHours","fixedOvertimeAllowance","coverageOvertime","coverageOvertimeOver60","coverageHoliday","coverageNight") VALUES
    ('ctr_0001','emp_0001','regular','fixed','headquarters',false,300000,1900,0,false,false,false,false),
    ('ctr_0002','emp_0002','regular','flex','corporate_sales',false,320000,1900,45000,true,true,true,false),
    ('ctr_0003','emp_0003','regular','shift','personal_sales',true,450000,1900,0,false,false,false,false),
    ('ctr_0004','emp_0004','non_regular','fixed','headquarters',false,220000,1900,0,false,false,false,false);
END $$;
