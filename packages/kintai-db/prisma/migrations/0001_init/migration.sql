-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "WorkSystem" AS ENUM ('fixed', 'flex', 'shift', 'discretionary');

-- CreateEnum
CREATE TYPE "OfficeDivision" AS ENUM ('headquarters', 'corporate_sales', 'personal_sales');

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('regular', 'non_regular');

-- CreateEnum
CREATE TYPE "StampType" AS ENUM ('clock_in', 'clock_out', 'break_start', 'break_end', 'entry', 'exit', 'pc_login', 'pc_logout');

-- CreateEnum
CREATE TYPE "StampSource" AS ENUM ('manual', 'ic_card', 'pc_log', 'jinjer_api');

-- CreateEnum
CREATE TYPE "DayType" AS ENUM ('workday', 'legal_holiday', 'scheduled_holiday');

-- CreateEnum
CREATE TYPE "LeaveType" AS ENUM ('paid_full', 'paid_half', 'special', 'compensatory', 'absence');

-- CreateEnum
CREATE TYPE "ClosingStatus" AS ENUM ('open', 'closed');

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "employeeCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "hiredOn" DATE NOT NULL,
    "retiredOn" DATE,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmploymentContract" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "employmentType" "EmploymentType" NOT NULL,
    "workSystem" "WorkSystem" NOT NULL,
    "office" "OfficeDivision" NOT NULL,
    "isManagerialEmployee" BOOLEAN NOT NULL,
    "basicSalary" INTEGER NOT NULL,
    "annualScheduledWorkingHours" DOUBLE PRECISION NOT NULL,
    "fixedOvertimeAllowance" INTEGER NOT NULL,
    "coverageOvertime" BOOLEAN NOT NULL,
    "coverageOvertimeOver60" BOOLEAN NOT NULL,
    "coverageHoliday" BOOLEAN NOT NULL,
    "coverageNight" BOOLEAN NOT NULL,

    CONSTRAINT "EmploymentContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Stamp" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" "StampType" NOT NULL,
    "stampedAt" TIMESTAMP(3) NOT NULL,
    "source" "StampSource" NOT NULL,
    "note" TEXT,

    CONSTRAINT "Stamp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkDay" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "dayType" "DayType" NOT NULL,
    "scheduledStart" TEXT,
    "scheduledEnd" TEXT,
    "actualWorkedMinutes" INTEGER NOT NULL,
    "breakMinutes" INTEGER NOT NULL,
    "absenceMinutes" INTEGER NOT NULL,
    "leave" "LeaveType",
    "nonStatutoryOvertimeMinutes" INTEGER NOT NULL,
    "statutoryOvertimeMinutes" INTEGER NOT NULL,
    "legalHolidayMinutes" INTEGER NOT NULL,
    "scheduledHolidayMinutes" INTEGER NOT NULL,
    "nightMinutes" INTEGER NOT NULL,

    CONSTRAINT "WorkDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyClosing" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "status" "ClosingStatus" NOT NULL,
    "totalWorkedMinutes" INTEGER NOT NULL,
    "nonStatutoryOvertimeMinutes" INTEGER NOT NULL,
    "statutoryOvertimeMinutes" INTEGER NOT NULL,
    "legalHolidayMinutes" INTEGER NOT NULL,
    "scheduledHolidayMinutes" INTEGER NOT NULL,
    "nightMinutes" INTEGER NOT NULL,
    "overtimeAllowance" INTEGER NOT NULL,
    "overtimeOver60Allowance" INTEGER NOT NULL,
    "holidayAllowance" INTEGER NOT NULL,
    "nightAllowance" INTEGER NOT NULL,
    "premiumTotal" INTEGER NOT NULL,
    "fixedOvertimeAdditionalPayment" INTEGER NOT NULL,
    "latenessDeduction" INTEGER NOT NULL,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "MonthlyClosing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Employee_employeeCode_key" ON "Employee"("employeeCode");

-- CreateIndex
CREATE INDEX "Employee_employeeCode_idx" ON "Employee"("employeeCode");

-- CreateIndex
CREATE UNIQUE INDEX "EmploymentContract_employeeId_key" ON "EmploymentContract"("employeeId");

-- CreateIndex
CREATE INDEX "Stamp_employeeId_stampedAt_idx" ON "Stamp"("employeeId", "stampedAt");

-- CreateIndex
CREATE INDEX "WorkDay_employeeId_date_idx" ON "WorkDay"("employeeId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "WorkDay_employeeId_date_key" ON "WorkDay"("employeeId", "date");

-- CreateIndex
CREATE INDEX "MonthlyClosing_employeeId_year_month_idx" ON "MonthlyClosing"("employeeId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyClosing_employeeId_year_month_key" ON "MonthlyClosing"("employeeId", "year", "month");

-- AddForeignKey
ALTER TABLE "EmploymentContract" ADD CONSTRAINT "EmploymentContract_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stamp" ADD CONSTRAINT "Stamp_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkDay" ADD CONSTRAINT "WorkDay_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyClosing" ADD CONSTRAINT "MonthlyClosing_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

