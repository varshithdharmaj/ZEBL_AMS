# Zebl Attendance Manager

A lightweight attendance management web application built with Next.js 15, TypeScript, Tailwind CSS, shadcn/ui, Prisma, and SQLite.

## Features

- **Authentication** — Email/password login with admin and employee roles
- **Admin** — Dashboard, Excel upload, employee management, attendance records, leave management
- **Employee** — Date-filtered dashboard, attendance history, leave requests with balances
- **Leave system** — EL / CL / SL with accrual, usage tracking, and HR balance adjustments

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Setup

```bash
npm install
npx prisma generate
npm run db:migrate-hr   # in-place migration for existing databases
npx prisma db push
npm run db:seed
npm run dev
```

### HR Module Migration

If upgrading from an older schema, run:

```bash
npm run db:migrate-hr
npx prisma db push --accept-data-loss
npm run db:seed
```

Open [http://localhost:3000](http://localhost:3000)

### Default Admin Login

- **Email:** hr@zebl.com
- **Password:** Hr@2026

## Leave Types & Balances

| Type | Name | Rules |
|------|------|-------|
| **EL** | Earned Leave | +0.5 days/month after 1 year of service |
| **CL** | Casual Leave | 12 days/year (auto-allocated) |
| **SL** | Sick Leave | 12 days/year (auto-allocated) |

Balances are stored per employee in `employee_leave_balances` (`el_balance`, `cl_balance`, `sl_balance`) with a full audit trail in `leave_transactions` (`accrual`, `deduction`, `manual_adjustment`).

### Employee Profile

Admin HR can manage each employee at `/admin/employees/[id]` with tabs:

- **Basic Information** — edit profile fields
- **Attendance Summary** — monthly stats with filter
- **Leave Balances** — view/adjust with transaction logging
- **Leave History** — full transaction audit trail

## Excel Upload Format

Required columns:

- Employee Code
- Employee Name
- Shift
- In Time
- Out Time
- Work Duration
- OT
- Status
- Remarks

Attendance rules:

- ≥ 480 minutes = Present
- < 480 minutes = Short Hours
- No check-in = Absent

## Tech Stack

- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS v4
- shadcn/ui components
- Prisma ORM
- SQLite

## Project Structure

```
src/
├── app/              # App Router pages
├── actions/          # Server Actions
├── components/       # UI components
└── lib/              # Utilities, auth, Prisma
prisma/
├── schema.prisma
├── seed.ts
└── attendance_manager.db
```
