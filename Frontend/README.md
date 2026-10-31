# ReportSetu — Frontend

React 18 + Vite + Tailwind. Talks to the Express/Prisma backend in `../backend`.

## Run it

```bash
cd Frontend
npm install

# A) Demo mode — no backend needed, synthetic data only
npm run dev:demo          # → http://localhost:5173  (use the one-click demo sign-ins)

# B) Against the real backend (Postgres + API on :5000 + ML service on :8001)
cp .env.example .env      # VITE_API_BASE_URL=http://localhost:5000/api/v1
npm run dev               # → http://localhost:5173
```

Demo sign-ins: doctor **Dr. Priya Mehta**, patient **Rohan Verma** (OTP `123456`), and **Admin**.
Doctor "connect patient" code in demo: `7K429Q`. Every person and value in demo mode is fictional.

## Other scripts

| Command | What it does |
|---|---|
| `npm run build` | Type-check and production build (demo code is stripped out) |
| `npm run build:demo` | Static demo build in `dist-demo/` (hash URLs, works from any folder) |
| `npm test` | Unit tests (biomarker matching, status wording, date formatting) |

## Structure

- `src/components/layout/AppShell.tsx` — responsive frame (sidebar ≥1024px, drawer + bottom tabs below)
- `src/components/ui/` — `Toast` (replaces `alert()`), `PageLoader`, `status` (patient-safe status wording)
- `src/demo/` — demo-mode fetch interceptor and synthetic data; loaded only when `VITE_DEMO_MODE=true`
- `src/utils/format.ts` — date formatting for ISO timestamps from the API

## Safety rules the UI follows

- Lab values only ever come from the uploaded file (backend OCR/ML) or what the patient types — never guessed.
- Nothing shows as "sent to doctor" / "sent to patient" / "dose taken" unless the server confirmed it.
- Medicine questions are routed to the doctor; the assistant never suggests medicines or treatment.
- Draft messages to patients contain only facts from the report; any advice is written by the doctor.
