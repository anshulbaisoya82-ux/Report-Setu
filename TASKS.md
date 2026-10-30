# ReportSetu Backend - Implementation Roadmap & Task List

> **Project**: Complete, production-grade backend for **ReportSetu** medical lab-report platform.  
> **Stack**: Node.js + TypeScript, Express, MongoDB + Mongoose, Zod validation, Socket.IO, JWT (argon2), Vitest + Supertest + mongodb-memory-server, Docker Compose, OpenAPI/Swagger docs, Pino logging.  
> **API Prefix**: `/api/v1`  
> **Definition of Done per Task**: Types compile without errors (`tsc --noEmit`), unit/integration tests pass, security rules verified by tests, OpenAPI schema updated, frontend contract compatibility maintained, and task checkbox ticked.

---

## Phase 1: Project Setup, Tooling & Core Infrastructure

- [x] **Task 1.1: Backend Project Initialization & TypeScript Configuration**
  - **Description**: Initialize the `/backend` package with Node.js, TypeScript, strict `tsconfig.json`, ESLint, and standard directory structure (`src/{config,controllers,middlewares,models,routes,services,types,utils}`).
  - **Acceptance Criteria**:
    - `package.json` created with all foundational scripts (`build`, `dev`, `test`, `lint`).
    - `tsconfig.json` configured in strict mode with path aliases (`@/*`).
    - Clean build passes with `npm run build`.

- [x] **Task 1.2: Environment Configuration & Zod Validation**
  - **Description**: Setup strongly typed environment variables parsed and validated using Zod (`src/config/env.ts`).
  - **Acceptance Criteria**:
    - Variables defined for `PORT`, `NODE_ENV`, `MONGO_URI`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `ENCRYPTION_KEY`, `CORS_ORIGIN`, `AI_PROVIDER`, etc.
    - Application fails fast with informative error messages if required env vars are missing or invalid.
    - Unit tests verify schema rejection on missing/malformed env variables.

- [x] **Task 1.3: Structured Logging with Pino (PHI/PII Sanitization)**
  - **Description**: Configure Pino logger with request ID tracing, log levels, and automatic redaction of sensitive fields (passwords, tokens, OTPs, health data).
  - **Acceptance Criteria**:
    - Logger writes structured JSON in production and readable formatting in development.
    - Express request logging middleware attaches a unique `requestId` to every request.
    - Unit tests confirm that authorization headers, passwords, and medical data never leak into logs.

- [x] **Task 1.4: Database Connection & Memory-Server Test Harness**
  - **Description**: Setup resilient MongoDB connection via Mongoose with auto-reconnect, index creation, and Vitest test harness using `mongodb-memory-server`.
  - **Acceptance Criteria**:
    - Mongoose connects with proper pool configuration, timeout settings, and graceful disconnect.
    - In-memory database helper spins up for testing and isolates state between test suites.
    - Connection health check test passes cleanly.

- [x] **Task 1.5: Standard API Envelope, Error Hierarchy & Pagination Utilities**
  - **Description**: Implement standard JSON response envelopes (`{ success, data, meta }`), global error handler with custom AppError subclasses, and reusable cursor/offset pagination helper.
  - **Acceptance Criteria**:
    - Consistent response format across 2xx, 4xx, and 5xx responses.
    - Global error middleware catches Zod validation errors, CastErrors, duplicate keys, and unhandled errors without leaking stack traces in production.
    - Unit tests assert envelope structure and HTTP status codes.

- [x] **Task 1.6: OpenAPI / Swagger Specification Setup**
  - **Description**: Integrate `swagger-ui-express` and `tsoa` or `swagger-jsdoc` to serve interactive API documentation at `/api-docs` and export OpenAPI JSON.
  - **Acceptance Criteria**:
    - `/api-docs` serves Swagger UI in non-production environments.
    - Base spec includes authentication schemes (Bearer JWT, Cookie).
    - Route test verifies 200 OK on `/api-docs`.

- [x] **Task 1.7: Docker & Docker Compose Configuration**
  - **Description**: Create multi-stage `Dockerfile` and `docker-compose.yml` defining the `api` service and a replica-set-ready `mongo` database.
  - **Acceptance Criteria**:
    - `Dockerfile` utilizes node-alpine and builds a lean production artifact.
    - `docker-compose up --build` boots up API and MongoDB cleanly with persistent volumes.
    - Health checks defined for both services.

---

## Phase 2: Security Foundations & Field-Level Encryption

- [x] **Task 2.1: Field-Level Encryption (AES-256-GCM) Utility & Mongoose Plugin**
  - **Description**: Implement authenticated encryption at rest (AES-256-GCM) using a 256-bit key from environment/KMS for sensitive PII and medical readings.
  - **Acceptance Criteria**:
    - Encryption helper returns ciphertext with IV and auth tag in format `iv:authTag:ciphertext`.
    - Mongoose schema getter/setter or plugin transparently encrypts before save and decrypts on find.
    - Tampered ciphertexts or incorrect keys throw specific decryption errors.
    - Unit tests verify roundtrip encryption/decryption and tamper detection.

- [x] **Task 2.2: Hardening Middleware (Helmet, Strict CORS, Rate Limiting & Sanitize)**
  - **Description**: Apply Helmet headers, strict origin-checked CORS, general IP rate limiting, account-level rate limiting, and NoSQL query sanitization (`express-mongo-sanitize`).
  - **Acceptance Criteria**:
    - Requests with `$gt`, `$ne`, or prototype pollution payloads are safely sanitized.
    - Rate limiters return `429 Too Many Requests` with `Retry-After` header when thresholds are exceeded.
    - Security tests verify headers (`X-Content-Type-Options`, `HSTS`, `Content-Security-Policy`) and rate limit triggering.

- [x] **Task 2.3: Secure Audit Logging Service**
  - **Description**: Create immutable audit logging collection and service recording who (userId, role), what (action), when (timestamp), why (purpose), IP address, and resource accessed.
  - **Acceptance Criteria**:
    - `AuditLog` Mongoose schema with capped/TTL storage and read-only indexing.
    - Audit service runs asynchronously without blocking request execution.
    - Sensitive PHI content is strictly excluded from audit payloads.
    - Unit tests confirm audit records are created on patient data access.

- [x] **Task 2.4: Doctor-Private Data Serializer & Policy Enforcement**
  - **Description**: Build serialization layer and response interceptor ensuring doctor-private fields (e.g. `privateNotes`, `priorityLabel`, internal triage tags) are stripped from patient responses.
  - **Acceptance Criteria**:
    - Dedicated DTO serializers: `PatientFacingReportDto` vs `DoctorFacingReportDto`.
    - Negative test: Querying reports or patient profiles with a patient JWT never contains private doctor notes or internal priority labels.

---

## Phase 3: Authentication, Authorization & Identity

- [x] **Task 3.1: User, DoctorProfile, and PatientProfile Schemas**
  - **Description**: Model the `User` base collection with discriminator or relational profiles for `DoctorProfile` and `PatientProfile`.
  - **Acceptance Criteria**:
    - Doctor schema includes `name`, `email`, `phone`, `registrationNumber`, `medicalCouncil`, `specialty`, `clinic`, and status (`pending` | `verified` | `rejected`).
    - Patient schema includes `name`, `phone`, `rsId`, `age`, `gender`, `bloodGroup`, `conditions`, `location`.
    - Unique indexes on `email`, `phone`, and `rsId`.

- [x] **Task 3.2: Patient Mobile OTP Signup/Login Flow**
  - **Description**: Implement patient phone authentication with OTP generation, hashing, rate limiting, and dev-mode fixed code (`123456`).
  - **Acceptance Criteria**:
    - `POST /api/v1/auth/patient/send-otp` validates phone number, generates 6-digit OTP, stores hashed OTP with 5-minute TTL.
    - `POST /api/v1/auth/patient/verify-otp` validates code (constant-time), registers new patient or logs in existing patient, returns tokens.
    - Maximum 5 attempts allowed per OTP before invalidation.
    - Integration tests cover OTP generation, verification, and rate limiting.

- [x] **Task 3.3: Doctor Email/Password Signup & Admin Verification Flow**
  - **Description**: Implement doctor registration with argon2 password hashing, registration number tracking, and admin verification state management.
  - **Acceptance Criteria**:
    - `POST /api/v1/auth/doctor/signup` registers doctor with status `pending`.
    - `POST /api/v1/admin/doctors/:id/verify` (admin only) updates doctor status to `verified`.
    - Unverified doctors cannot query or interact with patient records (returns `403 Forbidden`).
    - Integration tests verify unverified doctor rejection and successful admin verification.

- [x] **Task 3.4: Doctor Login with Argon2 & Brute-Force Lockout**
  - **Description**: Implement secure doctor authentication with password verification, failed attempt counter, and progressive lockout (e.g. 5 failed attempts locks for 15 minutes).
  - **Acceptance Criteria**:
    - `POST /api/v1/auth/doctor/login` validates credentials using argon2.
    - Failed attempts increment counter; 5th failure locks account and records audit event.
    - Locked account rejects login even with valid password until lock duration expires.
    - Integration tests verify lockout triggering and unlock behavior.

- [x] **Task 3.5: JWT Access & Refresh Token Service with Rotation and Reuse Detection**
  - **Description**: Implement 15-minute access token and rotating refresh token stored hashed in DB and delivered via httpOnly secure cookie.
  - **Acceptance Criteria**:
    - `POST /api/v1/auth/refresh-token` issues new access token and rotated refresh token.
    - If a previously used refresh token is presented (reuse detected), all tokens in that family are immediately invalidated.
    - `POST /api/v1/auth/logout` revokes current session.
    - `POST /api/v1/auth/logout-all` revokes all active refresh tokens for the user.
    - Comprehensive test suite for rotation, revocation, and reuse detection.

- [x] **Task 3.6: Central Authorization & RBAC Middleware**
  - **Description**: Implement `authenticate` and `requireRole('patient' | 'doctor' | 'admin')` middleware validating JWT signatures, active status, and token blacklist.
  - **Acceptance Criteria**:
    - Protected endpoints reject missing or invalid tokens with `401 Unauthorized`.
    - Endpoints guarded with `requireRole` reject unauthorized roles with `403 Forbidden`.
    - Active user payload attached to `req.user`.

---

## Phase 4: Patient-Doctor Connection Protocol (Temporary Codes)

- [x] **Task 4.1: Cryptographic RS ID Generator for Patients**
  - **Description**: Create non-guessable, collision-resistant RS ID generator (e.g. `RS-` prefix followed by 5 random alphanumeric chars, e.g. `RS-10475`) with unique index.
  - **Acceptance Criteria**:
    - Generated RS ID matches format `/^RS-[A-Z0-9]{5}$/`.
    - Automatic collision retry logic on document save.
    - Unit tests confirm format and uniqueness across generated batches.

- [x] **Task 4.2: Doctor VCode Request Flow**
  - **Description**: Implement endpoint where doctor submits a patient's RS ID to create a pending connection request with a 6-character VCode valid for 10 minutes.
  - **Acceptance Criteria**:
    - `POST /api/v1/connections/doctor/request-vcode` accepts `{ rsId }`.
    - Generates 6-character alphanumeric VCode, stores it hashed with 10-minute Mongo TTL index.
    - Returns VCode to doctor; creates an in-app notification event for the patient.
    - Rate limited to prevent RS ID enumeration.
    - Integration tests verify creation, expiration, and notification trigger.

- [x] **Task 4.3: Patient Single-Use Connect Code Generation & Doctor Redemption**
  - **Description**: Allow patient to generate a single-use 6-digit connect code in Settings (valid 10 mins). Doctor enters it to finalize connection.
  - **Acceptance Criteria**:
    - `POST /api/v1/connections/patient/generate-code` returns single-use connect code stored hashed with 10-minute TTL.
    - `POST /api/v1/connections/doctor/verify-code` accepts `{ patientRsId, code }`.
    - Validates code using constant-time comparison, limits to max 5 failed attempts before lockout.
    - On success: marks connection `Active`, links `connectedDoctors` in patient profile, emits real-time event.
    - Integration tests verify successful connection, attempt lockout, and expiration.

- [x] **Task 4.4: Connection Revocation & Central Active-Connection Policy**
  - **Description**: Implement connection revocation endpoints and a central authorization middleware (`requireActiveConnection`) used across all clinical patient routes.
  - **Acceptance Criteria**:
    - `POST /api/v1/connections/patient/revoke/:doctorId` immediately disconnects doctor and kicks live Socket.IO connection.
    - `POST /api/v1/connections/doctor/revoke/:connectionId` allows doctor to cancel pending request.
    - `requireActiveConnection` middleware checks DB/cache: any doctor attempting to access a patient without an active connection receives `403 Forbidden`.
    - Security penetration tests attempt to bypass policy and confirm zero unauthorized access.

---

## Phase 5: Lab Reports Pipeline, Parsing & Deterministic Evaluation

- [x] **Task 5.0: Machine Learning Service Setup & Express Client Adapter**
  - **Description**: Containerize the Python FastAPI service in `Machine learning/api.py`, add `ml-service` to `docker-compose.yml`, and build a typed `mlClient` in the Express backend (`src/services/mlClient.ts`) to orchestrate calls with graceful fallback.
  - **Acceptance Criteria**:
    - `Dockerfile` in `Machine learning/` running FastAPI with uvicorn on port 8001.
    - `docker-compose.yml` updated with `ml-service` container linked to `reportsetu-network`.
    - Express `src/services/mlClient.ts` provides typed methods for all endpoints: `/extract`, `/analyze`, `/forecast/hba1c`, `/triage`, `/summarize`, `/chat`.
    - Integration tests verify `mlClient` communication and offline resilience.

- [x] **Task 5.1: File Upload Engine with Security Scanning Hook**
  - **Description**: Setup Multer with memory storage or secure temp storage, 10MB file size limit, strict MIME type validation (PDF, JPG, PNG) with file-signature (magic bytes) checking.
  - **Acceptance Criteria**:
    - Rejects files larger than 10MB and files with disguised extensions (e.g. `.exe` renamed to `.pdf`).
    - Exposes a plugin hook for antivirus scanning (`scanBuffer`).
    - Integration tests test valid PDF/PNG upload and rejection of invalid MIME types.

- [x] **Task 5.2: Text Extraction & Modular `analyzeReport(file)` Pipeline (Integrated with ML Extractor)**
  - **Description**: Build pluggable extraction service integrating the `Machine learning/ml/extraction` engine (digital PDF parsing via `pypdfium2`, scanned OCR via `easyocr`, and lab name matching for major Indian diagnostic chains: Lal PathLabs, Apollo, SRL, Metropolis, Thyrocare, Quest, MaxLab) via `mlClient.extractReport` with local `pdf-parse` fallback.
  - **Acceptance Criteria**:
    - Modular architecture with interface `IReportAnalyzer`.
    - Detects report category (`CBC`, `HbA1c`, `Lipid`, `LFT`, `KFT`, `Other`), lab name, collection date, specimen, and parameters.
    - If confidence is below 0.60 or file name contains 'unknown', flags report with status `needs_type`.
    - Response matches frontend `ReportAnalysisResult` shape exactly.

- [x] **Task 5.3: Deterministic Clinical Range Evaluator (Code-Based Status & ML Rules)**
  - **Description**: Implement pure, deterministic clinical engine that parses biological reference ranges and computes parameter status (`Normal` | `Low` | `High` | `Critical`) strictly via code, aligned with `Machine learning/ml/analysis/reference_rules.py`.
  - **Acceptance Criteria**:
    - Handles diverse range formats (`13.0 – 17.0`, `< 5.7`, `> 40`, `0.7 - 1.3`).
    - Values > 50% above upper limit or < 30% below lower limit flagged as `Critical`.
    - Status calculation NEVER depends on probabilistic AI outputs.
    - Comprehensive unit test suite with 50+ medical parameter test cases from `reference_rules.py`.

- [x] **Task 5.4: Patient Upload, Value Correction & Audit History**
  - **Description**: Patient submits confirmed/edited report parameters. Store both original extracted values and user-corrected values with a `wasCorrected` flag.
  - **Acceptance Criteria**:
    - `POST /api/v1/reports/upload` executes upload and extraction.
    - `PUT /api/v1/reports/:id/confirm` saves final parameters, preserving `{ originalValue, correctedValue, isEdited }`.
    - Recalculates overall report status (`Normal` | `Unbalanced` | `Critical`).
    - Critical parameters immediately create a high-priority alert for connected doctors.

- [x] **Task 5.5: Doctor Review Workflow & Status State Machine**
  - **Description**: Implement doctor report review state machine (`pending` -> `in_review` -> `approved`), storing doctor summary, next test date, and medicine status.
  - **Acceptance Criteria**:
    - `GET /api/v1/reports/doctor/inbox` lists reports with urgent review ranking score.
    - `PUT /api/v1/reports/:id/review` records doctor summary, approved timestamp, and changes status to `approved`.
    - Patient only sees doctor summary and AI overview once status is `approved`.
    - Integration tests verify state transitions and patient view restrictions.

- [x] **Task 5.6: Historical Trends, Unusual Changes & HbA1c Forecasting API**
  - **Description**: Endpoint computing longitudinal parameter trajectories across all approved reports for a patient, integrating `Machine learning/ml/analysis/trend_detector.py`, `unusual_change.py`, and `Machine learning/ml/forecast/hba1c_forecaster.py` (90-day trajectory forecasting).
  - **Acceptance Criteria**:
    - `GET /api/v1/reports/patient/:patientId/trends` returns time series data with deltas matching frontend `historicalTrends` structure.
    - Calculates trend direction (`up` | `down` | `neutral`), percentage change, and flags unusual spikes/drops.
    - Returns 90-day trajectory forecast for HbA1c with confidence intervals.
    - Integration tests verify correct calculation of trends, deltas, and forecasts.

---

## Phase 6: Doctor Clinical Tools, Prescriptions & Appointments

- [x] **Task 6.1: Patient Management & LangGraph Clinical Triage Directory**
  - **Description**: Implement doctor-facing patient listing endpoint with search, condition filtering, and status ordering powered by the LangGraph Clinical Triage Agent (`Machine learning/ml/agents/triage_agent.py` and `POST /triage` scoring: `Urgent`, `Elevated`, `Routine`, `Normal`).
  - **Acceptance Criteria**:
    - `GET /api/v1/doctor/patients` returns connected patients formatted matching frontend `Patient` interface.
    - Integrates triage priorities and recommended actions from the ML triage agent.
    - Supports query params: `search`, `condition`, `status`, `page`, `limit`.
    - Performance test asserts sub-100ms response time with indexed queries.

- [x] **Task 6.2: Doctor Private Notes & Clinical Annotations**
  - **Description**: Provide private notes and priority labels CRUD for doctors on patient profiles and reports, isolated from patient access.
  - **Acceptance Criteria**:
    - `POST /api/v1/doctor/patients/:id/private-notes` and `PUT /api/v1/doctor/patients/:id/priority`.
    - Stored in separate encrypted fields or dedicated collections.
    - Integration tests verify doctor can manage notes and patient token receives 403 or filtered response.

- [x] **Task 6.3: Prescription Management & Medication Instructions**
  - **Description**: Doctor prescribes medications with drug name, strength, dosage schedule, timing (before/after meals), duration, and clinical advice.
  - **Acceptance Criteria**:
    - `POST /api/v1/prescriptions` (doctor only) creates prescription matching frontend `Prescription` model.
    - `GET /api/v1/prescriptions` returns active prescriptions with calculated `remainingDays`.
    - Emits real-time socket event `prescription:updated`.
    - Integration tests verify validation of prescription fields and day count calculations.

- [x] **Task 6.4: Patient Medication Schedule & Dose Adherence Tracker**
  - **Description**: Build patient-facing daily medicine checklist, logging dose actions (`taken`, `missed`, `snoozed`) with timestamps and weekly adherence calculation.
  - **Acceptance Criteria**:
    - `GET /api/v1/medicines/today` returns daily schedule matching frontend `MedicineScheduleItem`.
    - `POST /api/v1/medicines/:id/action` records action and `takenAt` time.
    - `GET /api/v1/medicines/adherence` computes weekly adherence percentage (`taken / scheduled`).
    - Integration tests verify state changes and adherence calculation accuracy.

- [x] **Task 6.5: Medicine Reminder Background Scheduler**
  - **Description**: Setup lightweight scheduler/queue (node-cron or BullMQ) that creates notification events for due medications based on patient reminder settings.
  - **Acceptance Criteria**:
    - Evaluates scheduled times and patient notification preference (`medicineReminders: true`).
    - Dispatches in-app notification and real-time socket alert when a dose is due.
    - Tests verify job triggers and respects muted patient preferences.

- [x] **Task 6.6: Appointment Lifecycle & Anti-Double-Booking Engine**
  - **Description**: Manage appointment bookings (`In-person`, `Video call`, `Phone call`) with status machine (`Pending` -> `Confirmed` | `Cancelled` | `Completed`), doctor availability slots, and concurrency lock to prevent double booking.
  - **Acceptance Criteria**:
    - `POST /api/v1/appointments/request` (patient) creates appointment request.
    - `PUT /api/v1/appointments/:id/status` (doctor accept/reject/reschedule or patient cancel).
    - Database unique compound index or transaction prevents two confirmed appointments for the same doctor at the same slot.
    - Integration tests test concurrent booking attempt rejection and status transitions.

---

## Phase 7: Real-Time Engine (Socket.IO) & Notification Dispatcher

- [x] **Task 7.1: Authenticated Socket.IO Server & Room Authorization**
  - **Description**: Configure Socket.IO server with JWT authentication middleware, personal user rooms (`user:<userId>`), and dynamic thread rooms (`thread:<threadId>`).
  - **Acceptance Criteria**:
    - Handshake validates JWT access token; rejects unauthenticated sockets.
    - Joining a patient or doctor thread room enforces active connection authorization check.
    - Unit tests verify connection approval and rejection of invalid tokens.

- [x] **Task 7.2: Real-Time Clinical Events & Revocation Kick**
  - **Description**: Implement event broadcasting across clinical workflows (`report:uploaded`, `report:status`, `critical:alert`, `appointment:updated`, `prescription:updated`, `access:revoked`).
  - **Acceptance Criteria**:
    - When patient revokes doctor access, doctor's socket is immediately expelled from all patient rooms and notified with `access:revoked`.
    - Critical report uploads trigger `critical:alert` to connected doctors with room broadcast.
    - Integration test with mock Socket.IO client confirms message delivery and room eviction.

- [x] **Task 7.3: In-App Notification System & Delivery Stubs**
  - **Description**: Create notification model with read/unread tracking, user preferences enforcement (`testDueReminders`, `doctorReplies`), and pluggable SMS/Email/Push dev stubs.
  - **Acceptance Criteria**:
    - `GET /api/v1/notifications` with pagination and unread counts.
    - `PUT /api/v1/notifications/:id/read` and `PUT /api/v1/notifications/read-all`.
    - Dev stubs log simulated SMS/Email to Pino logger without crashing when credentials are absent.
    - Integration tests verify delivery and user preference filters.

---

## Phase 8: AI Core Architecture, Security & Provider Abstraction

- [x] **Task 8.1: Multi-Provider AI Adapter & ML Microservice Client**
  - **Description**: Implement provider-agnostic `IAIProvider` interface with runtime selection via `AI_PROVIDER` (Gemini, Claude, OpenAI, and internal ML Microservice `mlClient`), unified contracts, and graceful offline fallback.
  - **Acceptance Criteria**:
    - Adapters for Google Gemini, Anthropic Claude, OpenAI, and internal ReportSetu ML Microservice (`Machine learning/api.py`).
    - Fallback and mock provider for offline local testing and CI/CD pipelines.
    - Unit tests verify interface compliance across all adapters.

- [x] **Task 8.2: Versioned Prompts, Zod Schemas & Token Budgeting**
  - **Description**: Organize prompts in `/prompts` with semantic versioning, strict Zod schema validation for structured outputs, and token/cost tracking.
  - **Acceptance Criteria**:
    - Prompts loaded with version headers (e.g. `patient-qa-v1.2.md`).
    - AI responses parsed and validated against Zod schemas; malformed responses trigger one retry then graceful fallback.
    - Audit log captures input tokens, output tokens, model name, and prompt version.

- [x] **Task 8.3: AI Safety, Medical Boundary & Prompt-Injection Guardrails**
  - **Description**: Implement pre-flight and post-flight safety filters: sanitizing user inputs against prompt injection, strictly bounding context to clinical data, and applying timeout budgets.
  - **Acceptance Criteria**:
    - Uploaded report text treated strictly as untrusted data, never as system instructions.
    - Safety test suite checks resistance against jailbreaks, system prompt leak attempts, and non-medical topics.

---

## Phase 9: AI Agent 1 - Patient Assistant ("Ask Doctor")

- [x] **Task 9.1: Deterministic Patient Context Builder**
  - **Description**: Assemble comprehensive `PatientContext` on demand from MongoDB: verified profile, all confirmed reports and parameters, longitudinal trends, doctor summaries, active prescriptions, and recent conversation.
  - **Acceptance Criteria**:
    - Only incorporates confirmed and doctor-approved summaries; excludes pending/draft items.
    - Strictly filters out doctor-private notes and priority labels.
    - Unit tests confirm accurate data assembly and absence of private notes.

- [x] **Task 9.2: Medical Safety Escapes (Medication Block & Emergency Triggers)**
  - **Description**: Enforce hardcoded clinical guardrails: any questions about changing/stopping medications or dosages are intercepted; emergency symptoms (chest pain, heavy bleeding) trigger immediate emergency protocol.
  - **Acceptance Criteria**:
    - Medication questions: Never answered by AI. Escalates to doctor's `Patient questions` inbox with `Medicine` tag; returns standard doctor-triage notice.
    - Emergency symptoms: Returns immediate emergency warning (Call 108 / Visit nearest emergency room).
    - Unit tests assert 100% interception rate across a wide battery of medication and emergency prompts.

- [x] **Task 9.3: Grounded Clinical QA & ML Patient Chat Assistant**
  - **Description**: AI answers questions strictly from verified records in patient's selected language (`en` or `hi`), leveraging `Machine learning/ml/language/patient_chat.py` (`POST /chat`) with built-in escalation tagging.
  - **Acceptance Criteria**:
    - Response cites specific test dates and parameters.
    - Escalates doctor questions or severe symptoms automatically with triage tags.
    - Streams tokens over Socket.IO (`chat:chunk`, `chat:done`) and persists to `ChatMessage` collection.
    - Integration tests verify message persistence and citation accuracy.

---

## Phase 10: AI Agent 2 - Doctor Summary, Draft Assistant & Copilot Search

- [x] **Task 10.1: Clinical Overview & Key Findings Generation**
  - **Description**: Generate structured AI Overview for doctors from report parameters, code-computed statuses, and historical deltas (summary, points to consider, key findings) using `Machine learning/ml/language/summarizer.py`.
  - **Acceptance Criteria**:
    - Output strictly conforms to frontend `aiOverview` schema.
    - Suggestions worded as "points to consider", never autonomous clinical decisions.
    - Stored with model ID, prompt version, and input hash.

- [x] **Task 10.2: Patient-Friendly Summary Draft in English & Hindi & Copilot Search**
  - **Description**: Generate drafts for doctor review in plain language, with tone options (`Plain language`, `More detail`, `Brief`) and Hindi translation using `Machine learning/ml/language/summarizer.py` and doctor copilot search (`Machine learning/ml/language/copilot_tools.py`).
  - **Acceptance Criteria**:
    - Draft stored with status `pending_doctor_approval`.
    - Does not reach patient until doctor explicitly approves via `markReportReviewed`.
    - Exposes copilot search tools for searching clinical findings.
    - Integration tests verify draft creation, language translation, and patient visibility firewall.

- [x] **Task 10.3: Post-Generation Number Verification Engine**
  - **Description**: Build AST/regex verification engine comparing all numerical values and statuses in AI generated text against source database values.
  - **Acceptance Criteria**:
    - If AI text states an incorrect number (e.g. Hemoglobin 14.5 when DB is 13.2) or wrong direction, generation fails verification and is rejected.
    - Unit tests assert rejection of hallucinated numerical readings.

- [x] **Task 10.4: Patient Question Suggested Reply Generator**
  - **Description**: Provide one-click draft replies for doctors in the `Patient questions` inbox based on patient thread history and recent lab reports.
  - **Acceptance Criteria**:
    - `POST /api/v1/doctor/threads/:id/suggest-reply` populates `suggestedReply` in thread.
    - Doctor can review, edit, or discard draft before sending.

---

## Phase 11: Privacy Operations, Seeder, Documentation & Verification

- [x] **Task 11.1: Patient Privacy Operations (Data Export & Right to Be Forgotten)**
  - **Description**: Implement GDPR/DPDP-compliant patient data export (download complete health history in encrypted JSON/ZIP) and account deletion endpoints.
  - **Acceptance Criteria**:
    - `GET /api/v1/patient/privacy/export` packages all user data, reports, prescriptions, and chats.
    - `DELETE /api/v1/patient/privacy/account` irreversibly anonymizes/deletes records while preserving legally required medical audit logs.
    - Integration tests verify export completeness and data erasure.

- [x] **Task 11.2: Health Probes, Metrics & Graceful Shutdown**
  - **Description**: Expose `/health/live` and `/health/ready` endpoints checking MongoDB connection and system metrics; handle `SIGTERM`/`SIGINT` with connection draining.
  - **Acceptance Criteria**:
    - `/health/ready` returns 200 when MongoDB is connected, 503 if disconnected.
    - Graceful shutdown stops accepting new requests, closes active sockets, and flushes audit logs.

- [x] **Task 11.3: Comprehensive Database Seeder (Frontend Mock Data Alignment)**
  - **Description**: Write idempotent seed script (`npm run seed`) creating Dr. Priya Mehta (verified doctor) and 8 realistic patients (Rohan Sharma, Meera Patel, etc.) with 3+ reports, longitudinal trends, prescriptions, appointments, and chat threads matching frontend `mockData.ts`.
  - **Acceptance Criteria**:
    - `npm run seed` runs cleanly without duplicates.
    - All IDs, RS IDs, categories, and parameter values match frontend contracts.
    - Integration test validates seeded data structure.

- [x] **Task 11.4: Postman Collection & OpenAPI Verification**
  - **Description**: Generate and validate comprehensive Postman collection and updated `openapi.json` covering all doctor, patient, and admin endpoints.
  - **Acceptance Criteria**:
    - Valid Postman Collection v2.1 with pre-request scripts for automatic Bearer token handling.
    - `openapi.json` validates with zero schema errors.

- [x] **Task 11.5: End-to-End System Test Suite & Frontend Contract Verification**
  - **Description**: Run comprehensive end-to-end integration test suite simulating full patient-doctor journeys: signup, connect code exchange, report upload, OCR extraction, doctor review, prescription, and AI chat.
  - **Acceptance Criteria**:
    - 100% of integration test suites pass.
    - Frontend API layer can swap directly from mock data to `/api/v1` backend without contract breakage.
