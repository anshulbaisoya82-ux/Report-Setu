# ReportSetu v2.0

## What's new

**Frontend redesign**
- Calm, consistent design across doctor, patient and admin portals; responsive layout with phone navigation.
- Demo mode (`npm run dev:demo` in `Frontend/`) runs the whole app on synthetic data, no backend needed.

**Prescriptions**
- Several medicines in one prescription; shared or separate dose times; food instructions; preview of the patient's daily reminders.
- Medicine-name search over ~252,000 Indian medicines (brand, composition, pack, maker), 30 results at a time with "Show more".
  Backend route `GET /api/v1/prescriptions/medicine-suggestions?q=&limit=&offset=` (doctor only).
  Set `MEDICINE_SEARCH_SOURCE=ml` to use the ML service's `/drug/suggest` instead.

**Medicines pages**
- Doctor: current courses with days left, last 7 days of doses, today's doses, past courses, food rules.
- Patient: Taken / Snooze / Missed / Undo, last 7 days, prescriptions.

**Food check (new)**
- Doctor sets food rules per patient: sugar / salt / saturated-fat limits per 100 g, allergies, ingredients to avoid, note.
- Patient photographs a packet label. Text is read on the device (OCR with glare removal and dotted-print joining) or by the server (Gemini Vision, when `GEMINI_API_KEY` is set). The patient checks the text, then the label is compared with the doctor's rules. Every finding quotes the label.
- The patient's recorded conditions are fetched from the database and shown as label facts to discuss with the doctor (e.g. sugar per 100 g for diabetes). The app gives no verdict without doctor rules.
- Routes: `GET /api/v1/food-rules/me`, `GET|PUT /api/v1/food-rules/patient/:patientId`, `POST /api/v1/food-rules/read-label`.

**Patient settings, notifications and privacy**
- Notification switches (medicine reminders, test-due reminders, doctor replies, important result alerts) and language are saved to the profile (`PUT /api/v1/patient/profile` → `notificationPreferences`, merged with what is stored). The server already mutes muted types.
- Notification bell in the sidebar and phone top bar: `GET /notifications`, mark one read, mark all read; refreshes every minute and on socket events.
- Settings → Your data: download everything (`GET /patient/privacy/export`) and delete the account (`DELETE /patient/privacy/account`, type DELETE to confirm).
- "Listen in Hindi" on My reports reads the doctor's Hindi summary and only appears when one exists.
- Removed placeholders that did nothing (fake QR code buttons, SMS alert switch). `/patient/requests` now redirects to My doctors.

**Admin sign-in (security fix)**
- The admin key that was hard-coded in the frontend and backend is gone. Set `ADMIN_KEY` (24+ characters) in `.env`; the admin page asks for it and `POST /api/v1/auth/admin/login` returns a short-lived admin token. With no `ADMIN_KEY` the admin portal is switched off.

**ML service**
- `/drug/suggest` and `/drug/indication` (GET and POST) now work: the `ml/drugs` package searches the same Indian medicine catalogue. `/drug/indication` returns "no data" instead of inventing indications, since no indication source is bundled.

**Docker**
- `docker compose up --build` starts Postgres, Mongo, Redis, the API, the ML service and the web app (http://localhost:5173). The API generates the Prisma client at build time and applies migrations on every start.

## Quick start with Docker

```bash
cp .env.example .env      # then fill in the secrets (see comments in the file)
docker compose up --build
```

## After pulling this branch (without Docker)

```bash
# Backend
cd backend
npm install
npx prisma generate
npx prisma migrate deploy        # adds PatientProfile.foodRules
npm run dev

# Frontend (npm install also copies the OCR engine into public/ocr)
cd ../Frontend
npm install
npm run dev                      # or: npm run dev:demo

# ML service
cd "../Machine learning"
pip install -r requirements.txt
uvicorn api:app --reload --port 8001
```

## Known open items
- Text-message and WhatsApp alerts are not built; notifications are in-app only.
- On-device OCR is tested on generated label photos, not yet on a range of real phone photos.
- Medicine indications have no data source yet.
- The full backend route tests need a database (`npm test` in `backend/` with Postgres and Mongo running).
