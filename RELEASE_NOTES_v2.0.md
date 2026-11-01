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

## After pulling this branch

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
- The ML `/drug/suggest` and `/drug/indication` endpoints need the updated `ml` package (not in this repository yet).
- Admin login still uses a fixed key; move to a proper admin account.
- Patient settings are not saved yet; the notification bell is not connected.
