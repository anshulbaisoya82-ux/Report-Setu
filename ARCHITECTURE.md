# ReportSetu — End-to-End Architecture & Feature Documentation

> **ReportSetu** is a full-stack clinical lab-report management platform that bridges the gap between patients, their lab reports, and their doctors — powered by Gemini AI for intelligent analysis, plain-language summaries, and a grounded clinical chat agent.

---

## Table of Contents

1. [High-Level Architecture](#1-high-level-architecture)
2. [Technology Stack](#2-technology-stack)
3. [Project Structure](#3-project-structure)
4. [Database Schema (PostgreSQL + Prisma)](#4-database-schema-postgresql--prisma)
5. [Authentication System](#5-authentication-system)
6. [Report Upload & OCR Pipeline](#6-report-upload--ocr-pipeline)
7. [Clinical Evaluation Engine](#7-clinical-evaluation-engine)
8. [AI / Gemini Integration](#8-ai--gemini-integration)
9. [Doctor Portal Features](#9-doctor-portal-features)
10. [Patient Portal Features](#10-patient-portal-features)
11. [Doctor–Patient Connection System](#11-doctorpatient-connection-system)
12. [Patient Chat Agent (Ask Doctor)](#12-patient-chat-agent-ask-doctor)
13. [Notification System](#13-notification-system)
14. [Medication & Prescription Management](#14-medication--prescription-management)
15. [Appointment System](#15-appointment-system)
16. [Security & Privacy](#16-security--privacy)
17. [Real-Time (WebSockets)](#17-real-time-websockets)
18. [API Endpoint Reference](#18-api-endpoint-reference)
19. [How to Run](#19-how-to-run)
20. [End-to-End User Flows](#20-end-to-end-user-flows)

---

## 1. High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React + Vite)                   │
│  ┌────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │ Auth   │  │ Patient  │  │ Doctor   │  │ Zustand Global   │   │
│  │ Pages  │  │ Portal   │  │ Portal   │  │ State Store      │   │
│  └───┬────┘  └────┬─────┘  └────┬─────┘  └────────┬─────────┘   │
│      │            │             │                  │             │
│      └────────────┴──────┬──────┴──────────────────┘             │
│                          │  REST API calls (apiFetch)            │
│                          │  + Socket.IO for real-time            │
└──────────────────────────┼───────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│                    BACKEND (Express + TypeScript)                 │
│                                                                  │
│  ┌───────────┐  ┌────────────┐  ┌──────────────────────────┐    │
│  │ Auth      │  │ Report     │  │  AI Layer                │    │
│  │ Controller│  │ Controller │  │  ┌─────────────────────┐ │    │
│  └─────┬─────┘  └─────┬──────┘  │  │ Gemini LLM Provider │ │    │
│        │              │         │  │ (gemini-2.0-flash)   │ │    │
│  ┌─────┴─────┐  ┌─────┴──────┐ │  └─────────┬───────────┘ │    │
│  │ Auth      │  │ Report     │ │  ┌──────────┴──────────┐  │    │
│  │ Service   │  │ Service    │ │  │ Number Verifier     │  │    │
│  └─────┬─────┘  └─────┬──────┘ │  │ Medical Safety      │  │    │
│        │              │         │  │ Patient Context     │  │    │
│        ▼              ▼         │  └─────────────────────┘  │    │
│  ┌─────────────────────────┐   └──────────────────────────┘    │
│  │      PostgreSQL          │                                    │
│  │    (Prisma ORM)         │                                    │
│  └─────────────────────────┘                                    │
└──────────────────────────────────────────────────────────────────┘
```

**Data flow summary:**
1. Patient uploads a lab report (PDF/image) from the frontend.
2. Backend sends the file buffer to Gemini for OCR-based parameter extraction.
3. The Clinical Evaluator grades each parameter (Normal / Low / High / Critical).
4. If any parameter is Critical, connected doctors receive real-time notifications.
5. Doctor opens the report in their dashboard, views AI-generated key findings, and can generate a plain-language summary for the patient.
6. Patient reads the doctor-approved summary in English & Hindi from their portal.

---

## 2. Technology Stack

| Layer        | Technology                                                      |
| ------------ | --------------------------------------------------------------- |
| Frontend     | React 18, Vite, TypeScript, Tailwind CSS, Zustand, React Router |
| Backend      | Node.js, Express, TypeScript, Zod validation                    |
| Database     | PostgreSQL with Prisma ORM — fresh schema, no demo seed data    |
| AI Engine    | Google Gemini API (`gemini-2.0-flash`) via `@google/genai`       |
| Real-Time    | Socket.IO                                                        |
| Auth         | JWT (Access + Refresh tokens) with HTTP-only cookies              |
| Security     | Helmet, CORS, Rate Limiter, input validation, Audit Logging       |
| Docs         | Swagger / OpenAPI auto-generated                                  |
| Containerize | Docker Compose (backend + frontend + mongo)                       |

---

## 3. Project Structure

```
Report-Setu/
├── backend/
│   └── src/
│       ├── config/          # Environment vars, DB connection, Swagger setup
│       ├── controllers/     # Route handlers (auth, reports, AI, chat, etc.)
│       ├── middlewares/     # Auth guard, rate limiter, error handler, logger
│       ├── domain/           # Shared domain types
│       ├── repositories.ts   # Typed Prisma repositories
│       ├── prisma/           # PostgreSQL schema and migrations
│       ├── prompts/         # Gemini LLM prompt templates
│       ├── routes/          # Express route definitions + integration tests
│       ├── seeders/          # Disabled by design; no demo records are created
│       ├── services/        # Business logic & AI integration layer
│       │   └── ai/          # Gemini provider, number verifier, safety guard
│       ├── types/           # TypeScript type declarations
│       └── utils/           # Logger, API response helpers, error classes
│
├── frontend/
│   └── src/
│       ├── api/             # REST client (apiFetch, all API method wrappers)
│       ├── components/      # Reusable UI components (Sidebar, Header, etc.)
│       ├── pages/
│       │   ├── auth/        # Login.tsx, SignUp.tsx
│       │   ├── doctor/      # 9 doctor portal pages
│       │   └── patient/     # 8 patient portal pages
│       ├── store/           # Zustand global state (useStore.ts)
│       └── types/           # Shared TypeScript interfaces
│
├── docker-compose.yml       # Multi-container orchestration
└── ARCHITECTURE.md          # ← This file
```

---

## 4. Database Schema (PostgreSQL + Prisma)

The target database is PostgreSQL and the canonical schema is
[`backend/prisma/schema.prisma`](./backend/prisma/schema.prisma). The initial
migration creates an empty schema and intentionally does not seed doctors,
patients, reports, medicines, or appointments.

All production services use Prisma repositories and PostgreSQL. Legacy
Mongoose models, MongoDB startup, and automatic demo seeding have been removed.
The Prisma relations below are the canonical application data model.

### 4.1 Core Models

| Model              | Purpose                                                      | Key Fields                                                                |
| ------------------ | ------------------------------------------------------------ | ------------------------------------------------------------------------- |
| **User**           | Authentication identity (shared by doctors & patients)        | `email`, `phone`, `passwordHash`, `role` (doctor/patient/admin)           |
| **DoctorProfile**  | Extended doctor information                                   | `userId`, `name`, `specialty`, `registrationId`, `clinicName`             |
| **PatientProfile** | Extended patient information                                  | `userId`, `name`, `phone`, `age`, `gender`, `bloodGroup`, `rsId`          |
| **Report**         | Lab report with extracted parameters and AI analysis          | `patientId`, `category`, `parameters[]`, `aiOverview`, `doctorSummary`    |
| **Connection**     | Doctor ↔ Patient relationship                                | `doctorId`, `patientId`, `status` (active/revoked), `consentSignature`    |
| **ConnectCode**    | Temporary 6-char code for secure pairing                      | `code`, `codeHash`, `patientId`, `expiresAt`                              |
| **ChatMessage**    | Patient ↔ AI / Doctor chat history                            | `patientId`, `sender`, `text`, `threadId`, `citations[]`                  |
| **Appointment**    | Scheduled patient-doctor meetings                             | `patientId`, `doctorId`, `date`, `time`, `status`, `notes`                |
| **Prescription**   | Doctor-issued prescriptions                                   | `patientId`, `doctorId`, `medicines[]`, `startDate`, `endDate`            |
| **MedicineSchedule**| Patient medication adherence tracking                        | `patientId`, `medicineName`, `dosage`, `frequency`, `adherenceLog[]`      |
| **Notification**   | In-app alerts (critical, appointment, connection)             | `userId`, `type`, `title`, `message`, `data{}`, `read`                    |
| **DoctorNote**     | Private clinical notes on a patient                           | `doctorId`, `patientId`, `note`, `tags[]`                                 |
| **AuditLog**       | HIPAA-grade audit trail of all sensitive operations           | `action`, `userId`, `userRole`, `details`, `ipAddress`, `userAgent`       |
| **Otp**            | OTP store for patient phone auth                              | `phone`, `otp`, `expiresAt`                                               |
| **RefreshToken**   | JWT refresh token rotation store                              | `userId`, `token`, `expiresAt`                                            |

### 4.2 Report Model — Deep Dive

The `Report` model is the most complex schema and the core of the application:

```
Report
├── patientId (ref → PatientProfile)
├── name, category (CBC | Diabetes | HbA1c | Lipid | LFT | KFT | Other)
├── labName, collectionDate, specimen
├── status: Critical | Unbalanced | Normal
├── reviewStatus: pending | in_review | approved
├── parameters[] ← Array of ILabParameter
│   ├── name, value, unit, referenceRange
│   ├── status: Normal | Low | High | Critical
│   ├── change, trendDirection (up/down/neutral)
│   ├── explanation, whatItMeans, pointsToConsider  ← Clinical knowledge
│   └── originalValue, correctedValue, isEdited     ← Doctor corrections
├── aiOverview ← Generated by Gemini
│   ├── summary (natural language paragraph)
│   ├── keyFindings[] (parameter, value, tag)
│   └── pointsToConsider[] (clinical suggestions)
├── doctorSummary ← Doctor-approved patient-facing summary
│   ├── text (English), hindiText (Hindi)
│   ├── tone: Plain language | More detail | Brief
│   ├── doctorName, approvedAt
│   ├── nextTestDate, medicinesStatus
│   └── sentVia: [App, SMS, Email]
└── rawFile { filename, mimeType, sizeBytes }
```

---

## 5. Authentication System

### 5.1 Doctor Login Flow

```
Doctor → POST /api/v1/auth/doctor/login { email, password }
       → Backend verifies bcrypt hash against User.passwordHash
       → Generates JWT access token (15 min) + refresh token (7 days)
       → Sets refreshToken in HTTP-only secure cookie
       → Returns { accessToken, user: { id, role, name, email } }
```

### 5.2 Patient Login Flow (OTP-based)

```
Patient → POST /api/v1/auth/patient/request-otp { phone }
        → Backend generates 6-digit OTP, stores in Otp collection (5 min TTL)
        → Returns { message: "OTP sent" }

Patient → POST /api/v1/auth/patient/verify-otp { phone, otp }
        → Backend verifies OTP against Otp collection
        → Creates or retrieves User + PatientProfile
        → Generates JWT tokens identical to doctor flow
        → Returns { accessToken, user, patientProfile }
```

### 5.3 Token Refresh

```
Client → POST /api/v1/auth/refresh (with HTTP-only cookie)
       → Backend rotates refresh token (one-time use)
       → Returns new { accessToken, refreshToken }
```

### 5.4 Auth Middleware

Every protected route passes through the `authGuard` middleware which:
1. Extracts `Bearer <token>` from the `Authorization` header.
2. Verifies JWT signature and expiry.
3. Attaches `req.user = { userId, role }` for downstream controllers.

---

## 6. Report Upload & OCR Pipeline

This is the most critical pipeline — converting a raw PDF/image of a lab report into structured, clinically evaluated data.

### Step-by-Step Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  1. UPLOAD                                                       │
│     Patient selects PDF/JPEG from phone → multipart/form-data    │
│     POST /api/v1/reports/upload                                  │
│     Max size: 10 MB                                              │
└───────────────────────┬─────────────────────────────────────────┘
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. GEMINI OCR EXTRACTION (reportAnalyzer.ts → mlClient.ts)      │
│     • Sends fileBuffer (base64) + structured prompt to Gemini    │
│     • Gemini returns JSON:                                       │
│       {                                                          │
│         report_date: "2025-03-15",                               │
│         lab_name: "Dr. Lal PathLabs",                            │
│         measurements: [                                          │
│           { test_name: "Hemoglobin", value: 11.2, unit: "g/dL",  │
│             ref_low: 12.0, ref_high: 15.5, flag: "low" },       │
│           ...                                                    │
│         ]                                                        │
│       }                                                          │
│     • Confidence scoring based on parameter count                │
└───────────────────────┬─────────────────────────────────────────┘
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. CLINICAL EVALUATION (clinicalEvaluator.ts)                   │
│     For each extracted parameter:                                │
│     • Parse reference range string → { low, high }               │
│     • Compare value against range → status:                      │
│       - Normal: within range                                     │
│       - Low: below range (≤30% deviation)                        │
│       - High: above range (≤30% deviation)                       │
│       - Critical: >30% deviation from range                      │
│     • Calculate percentageDiff for deviation magnitude            │
│     • Attach medical knowledge:                                  │
│       - explanation (what the reading means clinically)           │
│       - whatItMeans (plain-language parameter definition)         │
│       - pointsToConsider (lifestyle/follow-up guidance)           │
│     • Determine overall report status:                           │
│       - Critical if any parameter is Critical                    │
│       - Unbalanced if any parameter is High or Low               │
│       - Normal otherwise                                         │
└───────────────────────┬─────────────────────────────────────────┘
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. STORAGE & TRIAGE                                             │
│     • Report record saved to PostgreSQL with:                    │
│       - Extracted parameters + clinical evaluations              │
│       - reviewStatus = "pending"                                 │
│       - rawFile metadata (filename, mime, size)                  │
│     • If Critical → notifyConnectedDoctorsOfCriticalReport()     │
│       - Creates Notification for each active doctor connection   │
│       - Emits Socket.IO event for real-time push                 │
│     • Audit log entry recorded                                   │
└───────────────────────┬─────────────────────────────────────────┘
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│  5. CONFIRM / EDIT (Optional)                                    │
│     POST /api/v1/reports/:id/confirm                             │
│     • Patient or doctor can manually correct OCR-extracted values │
│     • Original values preserved as originalValue                 │
│     • Corrected values stored as correctedValue                  │
│     • isEdited flag set to true                                  │
│     • Re-runs clinical evaluation with corrected values          │
└─────────────────────────────────────────────────────────────────┘
```

### Lab Detection

The system recognizes major Indian lab chains by scanning extracted text:
- Dr. Lal PathLabs, Apollo Diagnostics, SRL/Agilus, Metropolis Healthcare
- Thyrocare, Quest Diagnostics, Max Lab, Tata 1mg, City Lab

---

## 7. Clinical Evaluation Engine

**File:** `services/clinicalEvaluator.ts`

The evaluator is a rule-based clinical grading system that operates entirely server-side without needing AI calls:

### Parameter Knowledge Base

The engine contains built-in medical knowledge for common lab parameters:

| Parameter     | whatItMeans                                                      | Points to Consider                                      |
| ------------- | ---------------------------------------------------------------- | ------------------------------------------------------- |
| Hemoglobin    | Carries oxygen from lungs to tissues                             | Discuss iron-rich nutrition, hydration                   |
| WBC           | Immune defense fighting infection                                | Report fever, persistent weakness                        |
| Platelets     | Blood cells for clotting and wound healing                       | Report unusual bruising, nosebleeds                      |
| HbA1c         | 2-3 month average blood sugar indicator                          | Glycemic monitoring, dietary moderation                  |
| Cholesterol   | Total lipids in bloodstream                                      | Heart-healthy diet, aerobic activity                     |
| LDL/HDL       | Bad/good cholesterol balance                                     | Exercise, healthy fats                                   |
| Triglycerides | Stored dietary fat                                               | Reduce sugar & refined carbs                             |
| Creatinine    | Kidney filtration waste product                                  | Review hydration, kidney function follow-up              |
| Bilirubin     | Liver processing efficiency indicator                            | Discuss liver function if elevated                       |
| TSH           | Thyroid regulation hormone                                       | Thyroid function panel follow-up                         |
| Vitamin D     | Bone health & immune function                                    | Sun exposure, supplementation                            |
| Iron          | Oxygen carrier, anemia marker                                    | Evaluate alongside ferritin and hemoglobin               |
| ESR/CRP       | Inflammation markers                                             | Further workup if persistently elevated                  |
| Uric Acid     | Purine metabolism product                                        | Dietary modification, hydration                          |

### Grading Rules

```
Value vs Reference Range:
  ┌──────────────────────────────────────────────────────────────┐
  │  value < ref_low:                                            │
  │    deviation ≤ 30%  → Low                                    │
  │    deviation > 30%  → Critical                               │
  │                                                              │
  │  value > ref_high:                                           │
  │    deviation ≤ 30%  → High                                   │
  │    deviation > 30%  → Critical                               │
  │                                                              │
  │  ref_low ≤ value ≤ ref_high → Normal                         │
  └──────────────────────────────────────────────────────────────┘
```

---

## 8. AI / Gemini Integration

### 8.1 Architecture

```
services/ai/
├── aiProvider.ts         # Factory: returns Gemini or fallback provider
├── numberVerifier.ts     # Post-processes Gemini output to verify numbers
├── medicalSafety.ts      # Guardrails for patient chat (emergency detection)
└── patientContextBuilder.ts  # Builds grounding context from patient history
```

### 8.2 Gemini-Powered Features

| Feature                    | Endpoint                              | What Gemini Does                                                    |
| -------------------------- | ------------------------------------- | ------------------------------------------------------------------- |
| **OCR Extraction**         | Internal (reportAnalyzer)             | Extracts lab parameters from PDF/image as structured JSON            |
| **AI Clinical Overview**   | `POST /reports/:id/ai-overview`       | Generates summary, key findings, and points-to-consider              |
| **Draft Patient Summary**  | `POST /reports/:id/draft-summary`     | Creates patient-facing summary in English + Hindi                    |
| **Patient Chat Agent**     | `POST /patient/chat`                  | Grounded clinical QA with safety guardrails                          |
| **Trend Analysis**         | Internal (trendService)               | Forecasts parameter trends across historical reports                 |

### 8.3 AI Safety Guardrails

The system enforces strict safety boundaries:

1. **Emergency Detection:** If the patient's message mentions chest pain, difficulty breathing, or suicidal ideation → immediate escalation response with emergency contacts.
2. **Medication Alteration Guard:** If the patient asks about changing dosages → response defers to the connected doctor, never provides dosage advice.
3. **Number Verification:** After Gemini generates any clinical text, the `numberVerifier` cross-checks all numeric values against the source report parameters to prevent hallucinated lab values.
4. **Grounded Context:** Chat responses are grounded against the patient's actual reports, prescriptions, and doctor notes — not general medical knowledge alone.

### 8.4 Number Verification Pipeline

```
Gemini Draft Summary → numberVerifier.verifyGeneratedClinicalNumbers()
  │
  ├── Extract all numbers from the generated text
  ├── Match each number against known report parameter values
  ├── Flag any number that doesn't correspond to actual data
  └── Return { verified: true/false, flaggedNumbers[], cleanText }
```

---

## 9. Doctor Portal Features

### 9.1 Dashboard (DoctorHome.tsx)

- **Stats Cards:** Total patients, pending reviews, critical alerts, today's appointments
- **Urgent Reports Inbox:** Reports flagged Critical or Unbalanced, sorted by priority
- **Recent Activity Feed:** Latest uploads, reviews, and chat messages
- **Quick Actions:** Navigate to patients, reports, appointments

### 9.2 Patient Directory (DoctorPatients.tsx)

- List of all connected patients with search & filter
- Each patient card shows: name, age, gender, last report date, active alerts
- Click to view detailed patient profile

### 9.3 Patient Detail (DoctorPatientDetail.tsx)

- **Profile Section:** Demographics, blood group, allergies, chronic conditions
- **Report History:** Chronological list of all reports for this patient
- **Parameter Trends:** Visual charts showing parameter changes over time
- **Prescriptions Tab:** Active and past prescriptions
- **Doctor Notes:** Private clinical notes (only visible to the doctor)

### 9.4 Report Review (DoctorReportDetail.tsx)

This is the most feature-rich page in the application:

```
┌─────────────────────────────────────────────────────────────────┐
│  REPORT HEADER                                                   │
│  Patient Name · Lab Name · Collection Date · Status Badge        │
├─────────────────────────────────────────────────────────────────┤
│  KEY FINDINGS (AI-Generated)                                     │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐                           │
│  │ HB: Low │ │ PLT:Crt │ │ WBC:Nml │  ... color-coded tags     │
│  └─────────┘ └─────────┘ └─────────┘                           │
├─────────────────────────────────────────────────────────────────┤
│  PARAMETER TABLE                                                 │
│  Name    │ Value │ Unit  │ Reference  │ Status │ Change          │
│  ────────┼───────┼───────┼────────────┼────────┼─────────        │
│  HB      │ 11.2  │ g/dL  │ 12.0-15.5 │ ↓ Low  │ -0.3 g/dL      │
│  PLT     │ 85K   │ /µL   │ 150K-400K │ ⚠ Crit │ -25K           │
│  ── doctor can inline-edit values (corrections tracked) ──       │
├─────────────────────────────────────────────────────────────────┤
│  AI OVERVIEW (generated by Gemini)                               │
│  "The report shows a mild decrease in hemoglobin levels..."      │
│  Points to Consider:                                             │
│  • Monitor platelet recovery with scheduled repeat hemogram      │
│  • Correlate hemoglobin with dietary iron intake                  │
├─────────────────────────────────────────────────────────────────┤
│  DRAFT SUMMARY FOR PATIENT                                       │
│  ┌────────────────────────────────┐                              │
│  │ Generate Draft (Plain/Detail/  │  ← Calls Gemini              │
│  │ Brief) with tone selection     │                              │
│  └────────────────────────────────┘                              │
│  English: "Your blood test shows..."                             │
│  Hindi: "आपकी रक्त जांच से पता चलता है..."                      │
│  [✓ Approve & Send to Patient]                                   │
├─────────────────────────────────────────────────────────────────┤
│  DOCTOR ACTIONS                                                  │
│  [Add Notes] [Set Next Test Date] [Mark as Reviewed]             │
└─────────────────────────────────────────────────────────────────┘
```

### 9.5 Patient Questions (DoctorPatientQuestions.tsx)

- View patient chat threads requiring doctor attention
- Messages flagged as medication-related are highlighted
- Doctor can write direct replies that appear in the patient's chat

### 9.6 Doctor Appointments (DoctorAppointments.tsx)

- Calendar view of upcoming appointments
- Create, reschedule, or cancel appointments
- Appointment notes and follow-up tracking

### 9.7 Add Patient (DoctorAddPatient.tsx)

- Enter patient's verification code (VCode) to establish a connection
- Search by patient RS-ID
- Connection request workflow with consent

### 9.8 Patient Medicines (DoctorPatientMedicines.tsx)

- View patient's current medication schedule
- Create or update prescriptions
- Track medication adherence percentage

---

## 10. Patient Portal Features

### 10.1 Dashboard (PatientHome.tsx)

- **Health Summary Cards:** Latest report status, medication adherence %, next appointment
- **Recent Reports:** Last 5 uploaded reports with status indicators
- **Connected Doctors:** List of actively linked doctors
- **Quick Upload:** One-tap report upload button

### 10.2 Upload Report (PatientUploadReport.tsx)

The most complex patient-facing page:

1. **File Selection:** Drag-and-drop or tap to select PDF/JPEG/PNG
2. **Upload Progress:** Real-time progress bar with status messages
3. **OCR Preview:** After upload, shows extracted parameters in an editable table
4. **Manual Corrections:** Patient can correct misread OCR values
5. **Confirm & Submit:** Finalizes the report and triggers clinical evaluation

### 10.3 My Reports (PatientMyReports.tsx)

- Chronological list of all uploaded reports
- Filter by category (CBC, Lipid, Diabetes, etc.)
- Status badges: Critical (red), Unbalanced (amber), Normal (green)
- Click to view detailed report with doctor's summary

### 10.4 Report Detail (PatientReportDetail.tsx)

- View extracted parameters with color-coded status
- See doctor-approved summary (English + Hindi)
- "What it means" explanations for each parameter
- Points to consider for lifestyle changes

### 10.5 Ask Doctor — AI Chat (PatientAskDoctor.tsx)

- Chat interface for health questions
- Messages grounded against patient's actual reports
- Safety guardrails for emergencies and medication queries
- Citations linking answers to specific report parameters
- Thread history maintained across sessions

### 10.6 Medicines (PatientMedicines.tsx)

- Current medication schedule with dose timing
- Mark doses as taken (adherence tracking)
- Missed dose alerts and reminders
- Adherence percentage visualization

### 10.7 Appointments (PatientAppointments.tsx)

- Upcoming appointments with doctor details
- Request new appointment slots
- Appointment status tracking (scheduled, completed, cancelled)

### 10.8 Settings (PatientSettings.tsx)

- **Profile Management:** Update personal details
- **Generate Connection Code:** Create a 6-character code for doctor pairing
- **Connected Doctors:** View and manage doctor connections
- **Privacy Controls:** Revoke doctor access, data export

---

## 11. Doctor–Patient Connection System

The connection system uses a secure, consent-based pairing mechanism:

### Connection Flow

```
┌──────────────┐                    ┌──────────────┐
│   PATIENT    │                    │   DOCTOR     │
│              │                    │              │
│ 1. Generate  │    6-char code     │ 2. Enter     │
│    Connect   │ ──────────────────→│    patient's │
│    Code      │   (e.g. "A3F9K2") │    code      │
│              │                    │              │
│ 3. Consent   │←───────────────────│ 3. Verify    │
│    prompt    │  connection        │    & connect │
│    [Accept]  │  request           │              │
│              │                    │              │
│ 4. Active    │←───────────────────│ 4. Access    │
│    connection│  bidirectional     │    patient   │
│              │  access            │    reports   │
└──────────────┘                    └──────────────┘
```

### Security Properties

- **Code is HMAC-SHA256 hashed** before storage (not stored in plaintext)
- **Codes expire after 15 minutes** — single use
- **Patient can revoke access** at any time from Settings
- **Audit log entry** created for every connection/disconnection
- **Constant-time comparison** to prevent timing attacks

---

## 12. Patient Chat Agent (Ask Doctor)

**File:** `controllers/patientChatController.ts`

### Architecture

```
Patient Message
       │
       ▼
┌─────────────────────┐
│ Medical Safety Gate  │  ← evaluateMedicalSafety()
│ • Emergency detect   │
│ • Medication guard   │
│ • Self-harm detect   │
└─────────┬───────────┘
          │ SAFE
          ▼
┌─────────────────────┐
│ Patient Context      │  ← buildPatientContext()
│ Builder              │
│ • Recent reports     │
│ • Prescriptions      │
│ • Doctor notes       │
│ • Health conditions  │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ Gemini LLM Call      │
│ • System prompt with │
│   patient context    │
│ • Chat history       │
│ • User question      │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ Response Processing  │
│ • Citation extraction│
│ • Number verification│
│ • Hindi translation  │
└─────────┬───────────┘
          │
          ▼
Patient receives grounded, safe response with citations
```

### Safety Categories

| Category          | Trigger Words                              | Response                                          |
| ----------------- | ------------------------------------------ | ------------------------------------------------- |
| Emergency         | chest pain, can't breathe, suicide         | "Please call 112 immediately" + connected doctor alert |
| Medication Change | "should I stop", "increase dose"           | "Please consult your doctor before changing medications" |
| Diagnosis Request | "do I have cancer", "am I diabetic"        | "Only your doctor can provide a diagnosis"         |
| Safe Question     | "what does HbA1c mean"                     | Grounded answer with report citations              |

---

## 13. Notification System

**Model:** `Notification.ts` | **Service:** `notificationService.ts`

### Notification Types

| Type               | Trigger                                   | Recipients      |
| ------------------ | ----------------------------------------- | ---------------- |
| `critical_alert`   | Critical parameter detected in report     | Connected doctors|
| `report_uploaded`  | Patient uploads a new report              | Connected doctors|
| `report_reviewed`  | Doctor approves a report summary          | Patient          |
| `appointment`      | Appointment created/modified/cancelled    | Both parties     |
| `connection`       | New doctor-patient connection             | Both parties     |
| `chat_reply`       | Doctor replies to patient question        | Patient          |
| `medication`       | Missed dose detected                      | Patient          |

### Delivery Channels

1. **In-App:** Stored in PostgreSQL, fetched via `GET /api/v1/notifications`
2. **Real-Time:** Pushed via Socket.IO for instant display
3. **Mark as Read:** `PUT /api/v1/notifications/:id/read`

---

## 14. Medication & Prescription Management

### Prescription Flow

```
Doctor creates prescription
  → POST /api/v1/prescriptions
  → Creates Prescription document with medicines[]
  → Auto-generates MedicineSchedule entries for each medicine
  → Patient sees schedule in their Medicines tab
```

### Adherence Tracking

```
Patient marks dose taken
  → PUT /api/v1/medicines/:id/take
  → Appends entry to adherenceLog[]
  → Recalculates adherence percentage
  → If dose missed → creates medication notification
```

### Reminder Scheduler

**File:** `services/reminderScheduler.ts`

- Background scheduler checks medication schedules every 15 minutes
- Creates "missed dose" notifications when scheduled time passes without intake logging
- Calculates daily/weekly adherence percentages

---

## 15. Appointment System

**Model:** `Appointment.ts` | **Service:** `appointmentService.ts`

### Features

- **Create:** Doctor or patient creates appointment with date, time, notes
- **Status Tracking:** scheduled → confirmed → completed (or cancelled)
- **Conflict Detection:** Prevents double-booking same doctor at same time
- **Notifications:** Both parties notified on creation, changes, cancellation
- **History:** Full audit trail of appointment modifications

---

## 16. Security & Privacy

### Security Middleware Stack

```
Request → Helmet (security headers)
        → CORS (origin whitelist)
        → MongoSanitize (NoSQL injection prevention)
        → Rate Limiter (100 req/15 min per IP)
        → Request Logger (structured logging)
        → Auth Guard (JWT verification)
        → Controller
```

### Privacy Features

| Feature                  | Implementation                                              |
| ------------------------ | ----------------------------------------------------------- |
| **Audit Logging**        | Every sensitive operation logged with IP, user agent, timestamp |
| **Connection Consent**   | Patient must explicitly accept doctor connections            |
| **Revoke Access**        | Patient can revoke doctor access instantly                   |
| **Data Minimization**    | Doctors see only connected patients' data                    |
| **Password Hashing**     | bcrypt with 10 salt rounds                                   |
| **Token Rotation**       | Refresh tokens are single-use (rotation on every refresh)    |
| **Code Hashing**         | Connection codes HMAC-SHA256 hashed                          |
| **Privacy Dashboard**    | `GET /api/v1/patient/privacy/dashboard` — full data export   |

### Audit Log Schema

Every sensitive action creates an `AuditLog` entry:
```json
{
  "action": "REPORT_UPLOAD",
  "userId": "664abc...",
  "userRole": "patient",
  "details": { "reportId": "...", "category": "CBC" },
  "ipAddress": "203.0.113.42",
  "userAgent": "Mozilla/5.0...",
  "createdAt": "2025-03-15T10:30:00Z"
}
```

---

## 17. Real-Time (WebSockets)

**File:** `services/socketService.ts`

### Socket.IO Events

| Event                | Direction        | Payload                                 |
| -------------------- | ---------------- | --------------------------------------- |
| `notification:new`   | Server → Client  | Full notification object                |
| `report:critical`    | Server → Doctor  | Report ID + patient name + critical params |
| `chat:message`       | Server → Client  | New chat message with citations         |
| `chat:typing`        | Client ↔ Server  | Thread ID + typing status               |
| `connection:update`  | Server → Both    | Connection status change                |

### Room Structure

- Each user joins a room named `user:<userId>` on connection
- Notifications are emitted to the specific user's room
- Chat messages are emitted to the thread room `thread:<threadId>`

---

## 18. API Endpoint Reference

### Auth Routes (`/api/v1/auth`)

| Method | Endpoint                  | Auth  | Description                    |
| ------ | ------------------------- | ----- | ------------------------------ |
| POST   | `/doctor/register`        | No    | Register new doctor            |
| POST   | `/doctor/login`           | No    | Doctor email + password login  |
| POST   | `/patient/request-otp`    | No    | Request OTP for phone          |
| POST   | `/patient/verify-otp`     | No    | Verify OTP + get tokens        |
| POST   | `/refresh`                | Cookie| Rotate refresh token           |
| POST   | `/logout`                 | Yes   | Invalidate refresh token       |
| GET    | `/me`                     | Yes   | Get current user profile       |

### Report Routes (`/api/v1/reports`)

| Method | Endpoint                  | Auth  | Description                    |
| ------ | ------------------------- | ----- | ------------------------------ |
| POST   | `/upload`                 | Yes   | Upload lab report (multipart)  |
| POST   | `/:id/confirm`            | Yes   | Confirm/edit OCR parameters    |
| GET    | `/inbox`                  | Yes   | Doctor's review inbox          |
| PUT    | `/:id/review`             | Yes   | Doctor reviews/approves report |
| GET    | `/:id`                    | Yes   | Get report details             |
| GET    | `/patient/:patientId`     | Yes   | Get patient's reports          |
| GET    | `/my`                     | Yes   | Patient's own reports          |

### AI Routes (`/api/v1/reports`)

| Method | Endpoint                  | Auth  | Description                    |
| ------ | ------------------------- | ----- | ------------------------------ |
| POST   | `/:id/ai-overview`        | Yes   | Generate AI clinical overview  |
| POST   | `/:id/draft-summary`      | Yes   | Generate patient-facing draft  |

### Connection Routes (`/api/v1/connections`)

| Method | Endpoint                  | Auth  | Description                    |
| ------ | ------------------------- | ----- | ------------------------------ |
| POST   | `/patient/generate-code`  | Yes   | Generate 6-char connect code   |
| POST   | `/doctor/verify-code`     | Yes   | Doctor verifies patient code   |
| POST   | `/patient/accept`         | Yes   | Patient accepts connection     |
| DELETE | `/:id/revoke`             | Yes   | Revoke connection              |
| GET    | `/my`                     | Yes   | List user's connections        |

### Doctor Routes (`/api/v1/doctor`)

| Method | Endpoint                  | Auth  | Description                    |
| ------ | ------------------------- | ----- | ------------------------------ |
| GET    | `/patients`               | Yes   | List connected patients        |
| GET    | `/patients/:id`           | Yes   | Get patient detail             |
| GET    | `/stats`                  | Yes   | Dashboard statistics           |

### Chat Routes (`/api/v1/patient`)

| Method | Endpoint                  | Auth  | Description                    |
| ------ | ------------------------- | ----- | ------------------------------ |
| POST   | `/chat`                   | Yes   | Send message to AI agent       |
| GET    | `/chat/threads`           | Yes   | Get chat thread history        |
| GET    | `/chat/threads/:threadId` | Yes   | Get messages in a thread       |
| POST   | `/chat/:threadId/doctor-reply` | Yes | Doctor replies to thread   |

### Other Routes

| Method | Endpoint                           | Auth  | Description              |
| ------ | ---------------------------------- | ----- | ------------------------ |
| GET    | `/api/v1/prescriptions/patient/:id`| Yes   | Get patient prescriptions|
| POST   | `/api/v1/prescriptions`            | Yes   | Create prescription      |
| GET    | `/api/v1/medicines/schedule`       | Yes   | Get medicine schedule    |
| PUT    | `/api/v1/medicines/:id/take`       | Yes   | Record dose taken        |
| GET    | `/api/v1/appointments`             | Yes   | List appointments        |
| POST   | `/api/v1/appointments`             | Yes   | Create appointment       |
| GET    | `/api/v1/notifications`            | Yes   | Get notifications        |
| PUT    | `/api/v1/notifications/:id/read`   | Yes   | Mark notification read   |
| GET    | `/api/v1/patient/privacy/dashboard`| Yes   | Privacy data export      |

### Health Checks

| Method | Endpoint         | Description                              |
| ------ | ---------------- | ---------------------------------------- |
| GET    | `/health`        | Basic service health check               |
| GET    | `/health/live`   | Liveness probe (uptime + timestamp)      |
| GET    | `/health/ready`  | Readiness probe (DB connection status)   |

---

## 19. How to Run

### Prerequisites

- Node.js ≥ 18
- PostgreSQL 16+
- Google Gemini API key

### Environment Variables

Create `backend/.env`:

```env
PORT=5000
DATABASE_URL=postgresql://reportsetu:reportsetu@localhost:5432/reportsetu?schema=public
JWT_SECRET=your-jwt-secret
JWT_REFRESH_SECRET=your-refresh-secret
ENCRYPTION_KEY=your-32-char-encryption-key
GEMINI_API_KEY=your-gemini-api-key
NODE_ENV=development
```

### Start Backend

```bash
cd backend
npm install
npm run db:migrate    # Applies the empty Prisma schema migration
npm run dev           # Starts on http://localhost:5000
```

### Start Frontend

```bash
cd frontend
npm install
npm run dev          # Starts on http://localhost:5173
```

### Docker Compose (Production)

```bash
docker-compose up --build
```

The application does not create demo users or records automatically. Register
an account through the authentication screens before using the portals.

### Test Credentials

| Portal   | Login                            | Password / OTP |
| -------- | -------------------------------- | -------------- |
| Doctor   | `priya.mehta@reportsetu.in`      | `password123`  |
| Patient  | Phone: `9876543210`              | OTP: `123456`  |

---

## 20. End-to-End User Flows

### Flow 1: Patient Uploads Report & Gets Doctor Summary

```
1. Patient logs in via OTP (phone: 9876543210)
2. Patient navigates to Upload Report
3. Patient selects a CBC lab report PDF from their phone
4. System uploads file → Gemini OCR extracts parameters
5. Patient sees extracted values, corrects any OCR errors
6. Patient confirms → Report saved with status "Critical" (platelets low)
7. System sends critical notification to Dr. Priya Mehta (connected doctor)
8. Dr. Priya opens the report in her Urgent Reports inbox
9. She sees AI-generated key findings and clinical overview
10. She clicks "Generate Draft Summary" → Gemini produces English + Hindi text
11. She reviews, edits if needed, sets next test date
12. She clicks "Approve & Send to Patient"
13. Patient receives notification → opens report → reads summary in Hindi
14. Patient sees: "Your platelet count is low. Please visit for a follow-up."
```

### Flow 2: Patient Asks Health Question via AI Chat

```
1. Patient navigates to "Ask Doctor" tab
2. Patient types: "My hemoglobin has been dropping, should I be worried?"
3. System evaluates message for safety → SAFE (no emergency/medication keywords)
4. System builds patient context: recent reports, prescriptions, conditions
5. Gemini generates grounded response citing actual HB values from reports
6. Response: "Your hemoglobin was 11.2 g/dL (ref: 12.0-15.5) in your last CBC.
   This is mildly below normal. Consider discussing iron supplementation
   with Dr. Priya at your next appointment."
7. Citations link to specific report parameters
8. If patient then asks "should I stop taking metformin?" →
   Safety guard triggers: "Please consult Dr. Priya before changing medications."
```

### Flow 3: Doctor Connects with New Patient

```
1. Patient generates connection code from Settings → "A3F9K2"
2. Patient shares code with doctor (verbally, WhatsApp, etc.)
3. Doctor enters "A3F9K2" in Add Patient page
4. System verifies code hash → finds matching patient
5. Connection established (status: active)
6. Doctor now sees patient in their directory
7. Doctor can view all patient reports, prescriptions, and chat threads
8. Patient can revoke access at any time from Settings
```

### Flow 4: Medication Adherence Tracking

```
1. Doctor creates prescription for patient (Metformin 500mg, twice daily)
2. System generates MedicineSchedule with morning + evening slots
3. Patient sees medication schedule in Medicines tab
4. Patient marks morning dose as taken → adherence log updated
5. If evening dose not taken within 1 hour → missed dose notification
6. Doctor can view adherence percentage in Patient Detail page
7. Low adherence triggers a review flag for the doctor
```

---

## Summary

ReportSetu is a comprehensive clinical platform that:

- **Digitizes lab reports** using Gemini AI OCR with automatic parameter extraction
- **Clinically evaluates** every parameter using a rule-based medical knowledge engine
- **Connects patients and doctors** through a secure, consent-based verification system
- **Provides AI-powered summaries** in English and Hindi with number-verified accuracy
- **Enables intelligent patient Q&A** with grounded responses and safety guardrails
- **Tracks medications** with real-time adherence monitoring and doctor oversight
- **Maintains HIPAA-grade audit trails** for every sensitive operation

The entire system is designed with an India-first approach, recognizing major Indian lab chains, supporting Hindi language summaries, and using phone-based OTP authentication familiar to Indian patients.
