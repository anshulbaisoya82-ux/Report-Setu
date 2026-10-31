# ReportSetu Implementation Tasks & Progress

Mapped strictly and directly to Figma design frames in `/Frames`.

---

## Phase 1: Foundation & Design System Tokens
- [x] **1.1 Design Tokens & Tailwind Theme** (Figma Frame: `ReportSetu – Doctor Dashboard.png`)
  - Dark forest green sidebar `#1E3F35`
  - Soft sage canvas background `#ECF2ED` / `#EAEFEA`
  - Accent teal CTA `#32A299`
  - Critical red alerts `#FBEBEA` / `#B53629` / `#9D3728`
  - Warning amber alerts `#FEF3D6` / `#8C6200`
  - Normal sage pills `#E4EDE8` / `#2B5246`
  - Terracotta notification badges `#D86E53`
  - Google Fonts: `IBM Plex Sans` and `Noto Sans Devanagari`
- [x] **1.2 App Shells & Layout Architecture**
  - `DoctorLayout`: Forest green left sidebar, synced status indicator, top navigation, search, notifications, profile menu, and legal disclaimer footer
  - `PatientLayout`: Forest green left sidebar with patient menu items, notification counter, user profile chip, and privacy badge
  - Global Demo Portal Switcher (Floating pill to toggle between Doctor Portal and Patient Portal instantly)

---

## Phase 2: State Management & Mock Database
- [x] **2.1 Comprehensive Mock Data Store (`src/store/useStore.ts`)**
  - **Patients**: Rohan Verma (`RS-10475`), Meera Iyer (`RS-10482`), Sana Qureshi (`RS-10461`), Arjun Nair (`RS-10448`), Kavya Menon (`RS-10432`), Dev Malhotra (`RS-10419`), Ishita Rao (`RS-10406`), Nikhil Joshi (`RS-10391`)
  - **Doctor**: Dr. Priya Mehta (General Physician, Reg: 12345, Apollo Clinic)
  - **Lab Reports**: Detailed parameter breakdowns (Hemoglobin, RBC, WBC, Platelets, Hematocrit, MCV, MCH, MCHC, RDW, HbA1c, Fasting Glucose, Cholesterol) with reference ranges, statuses (Normal, Low, High, Critical), previous trend history
  - **Medicines & Adherence**: Metformin 500mg (morning/night), 7-day adherence history (12/14 doses taken), daily schedule actions (Mark taken, Snooze, Missed), doctor advice (Walk 30 min daily, Less sugar)
  - **Appointments**: Today's schedule, pending patient requests (Accept/Decline/Reschedule), booking calendar, visit types (In-person, Video call, Phone call)
  - **Patient Questions & Chat**: Threaded messages, AI assistant responses, flagged medicine questions, doctor message draft composer with AI suggested replies

---

## Phase 3: Auth Screens
- [x] **3.1 Doctor Login** (Figma Frame: `Desktop – Login.png`)
  - Left panel: Dark forest green branding, "Lab reports, understood in seconds.", 3 feature value propositions, verified registration trust badge
  - Right panel: White card, Email address, Password with show/hide toggle, "Keep me logged in", "Log in as doctor ->", Mobile OTP login alternative option
- [x] **3.2 Doctor Sign Up** (Figma Frame: `Desktop – Sign up.png`)
  - Left panel: Dark forest green branding with feature bullets
  - Right panel: Full name, Mobile number, Email address, Medical registration number & council selector, Specialty & Clinic name, Password with confirmation, Terms checkbox, "Create account ->"

---

## Phase 4: Doctor Portal Screens
- [x] **4.1 Doctor Home Dashboard** (Figma Frame: `Desktop – Home v2 (trust updates).png`)
  - Welcome greeting: "Good morning, Dr. Priya Mehta" with synced status & `+ Add patient` teal button
  - Urgent review banner: "Needs urgent review: 3 reports have critical values"
  - 3 Stat metric cards: Total patients `248`, Today's appointments `12`, Pending reports `7`
  - Priority Patients list with status tags (`Critical`, `Needs Review`, `Unbalanced`)
  - Two-column view: Reports awaiting review vs Upcoming follow-ups with date chips
- [x] **4.2 Patients Roster** (Figma Frame: `Desktop – Patients.png`)
  - Search patient input with instant filtering
  - Sort dropdown (`Criticality`, `Name`, `Recent`)
  - Filter pills: `All patients · 248`, `Needs review`, `Follow-up due`, `Up to date`
  - Patient cards with avatar initials, RS ID, conditions, last report timestamp, status chips, and "View file" action
- [x] **4.3 Add Patient Stepper** (Figma Frame: `Desktop – Add patient.png`)
  - 3-step interactive flow:
    1. Enter patient RS ID (e.g. `RS-10475`)
    2. Request VCode verification
    3. Enter 6-box connect code
  - Matched patient preview card with demographics & active permission toggles
- [x] **4.4 Patient Detail View** (Figma Frame: `Desktop – Patient detail.png`)
  - Patient banner with demographics, RS ID, blood group, condition chips
  - 5 Navigation tabs: `Overview`, `Lab Reports`, `Appointments`, `Notes`, `Follow-ups`
  - All Lab Reports table with status pills
  - Latest report parameter breakdown with interactive selection
  - Side drawer for parameter AI explanation & clinical context
  - Longitudinal SVG trend sparkline chart with shaded reference range band
- [x] **4.5 Patient Medicines & Adherence** (Figma Frame: `Desktop – Patient medicines.png`)
  - Active prescription card with remaining days counter
  - 7-day adherence tracker with Mon-Sun circular completion states
  - Doctor's advice list (walk 30 mins daily, less sugar)
  - Earlier prescriptions history
  - Right-side `New prescription` drawer/form to add or modify medicines
- [x] **4.6 Doctor Appointments** (Figma Frame: `Desktop – Appointments (new layout).png`)
  - Stat cards: `6 Today`, `5 Pending`, `18 This week`
  - Interactive calendar month picker
  - Today's appointment schedule timeline
  - Incoming patient appointment requests with `Accept` and `Decline` actions
  - "New appointment" booking form
- [x] **4.7 Doctor Reports Overview** (Figma Frame: `Desktop – Reports.png`)
  - Donut chart overview: 85% reviewed, 48 total, 41 reviewed, 7 awaiting
  - "Needs urgent review" top 3 critical reports card with quick "Review now" buttons
  - Filter and sort dropdown
  - Full reports list table with status chips and "View" buttons
- [x] **4.8 Doctor Report Detail & Patient Message Composer** (Figma Frame: `Desktop – Report detail.png`)
  - Header: Back button, report title, critical tag, patient info, "View original", "Download", "Mark as reviewed"
  - AI overview card with key findings chips (Platelet Count Low, Hematocrit Low, RDW High) + "Copy summary" / "Regenerate"
  - Detailed lab report table with parameter selection
  - Selected parameter AI analysis drawer
  - Trends vs previous reports SVG multi-line chart with parameter toggle pills
  - Patient Message Composer:
    - Tone selection: `Plain language`, `More detail`, `Brief`
    - Language selector: English / Hindi
    - Rich text editor with formatting toolbar and "Regenerate draft"
    - Inclusion checkboxes: Plain-language summary, Values that need attention, Follow-up request, Attach lab report
    - Next test date picker & Medicine change status
    - Bottom bar: "I have reviewed this report", Save draft, Preview as patient, Send to patient
- [x] **4.9 Doctor Patient Questions** (Figma Frame: `Desktop – Patient questions.png`)
  - Search and filter pills (`All · 8`, `Unanswered · 3`, `Medicine · 2`)
  - Patient thread selection with unread notification badges
  - Chat thread showing patient questions, automated AI responses, and medicine warning banners
  - Doctor reply composer with "AI suggested reply" 1-click insertion

---

## Phase 5: Patient Portal Screens
- [x] **5.1 Patient Home** (Figma Frame: `Patient – Home.png`)
  - Greeting: "Welcome back, Rohan"
  - Top alert banner: "Dr. Priya Mehta reviewed your CBC report from Apollo Diagnostics" with "View summary" CTA
  - 3 Stat cards: 6 My reports, 1/2 Today's medicines, 12:15 PM Next appointment
  - Today's medicines card with interactive [✓ Mark taken] action
  - My recent reports card with quick view buttons
  - Upcoming visits and tests cards
- [x] **5.2 Patient Upload Report Flow** (Figma Frames: `Patient – Upload report.png`, `Patient – Upload report – check values.png`)
  - Step 1: Report category selector (Complete Blood Count, Diabetes, Lipid Profile, Liver Function, Kidney Function, Other report)
  - 4-step progress stepper: Choose file -> Read -> Check values -> Sent to doctor
  - File drag-and-drop zone with sample files & manual entry toggle
  - Editable parameter verification table with out-of-range value highlight (Platelet Count)
  - "+ Add a test", "Start again", and "Confirm & send to doctor"
- [x] **5.3 Patient My Reports** (Figma Frame: `Patient – My reports.png`)
  - "Latest doctor's note" card with "Listen in Hindi" audio/speech trigger and "Open report"
  - "Values to watch" amber card (Platelet Count, Total RBC, RDW)
  - Category filter pills (`All reports · 6`, `CBC · 3`, `Lipid · 1`, `HbA1c · 1`, `LFT · 1`)
  - Reports table with status pills and View actions
- [x] **5.4 Patient Report Detail** (Figma Frame: `Patient – Report detail.png`)
  - Doctor's summary box (Approved by Dr. Priya Mehta) with "Listen in Hindi" and "View original report"
  - Parameter breakdown table with interactive selection
  - Side explanation card: "What is this?", "What your doctor said", disclaimer
  - Longitudinal trend chart over time with reference range zone
- [x] **5.5 Patient Medicines** (Figma Frame: `Patient – Medicines.png`)
  - Stat cards: 1/2 Taken today, 86% This week, 79 Days left
  - "This week" 7-day adherence calendar with checked/missed states
  - Doctor's instructions cards (Walk 30 minutes daily, Less sugar in diet)
  - Today's schedule with "Taken", "Mark taken", "Snooze", "Missed" actions
  - Current prescription & earlier prescriptions history
- [x] **5.6 Patient Appointments** (Figma Frame: `Patient – Appointments.png`)
  - Summary stats: 0 Confirmed, 1 Pending, 2 Past visits
  - "My requests" card with "Cancel request" button
  - Interactive October 2026 calendar with request & visit markers
  - "Request an appointment" form: Doctor selector, Reason input, Date & Time pickers, Visit type (In-person, Video call, Phone call), Note for doctor, Send request button
  - Past visits history list
- [x] **5.7 Patient Ask Doctor** (Figma Frame: `Patient – Ask doctor.png`)
  - Chat interface with Dr. Priya Mehta
  - Pre-defined "Common questions" pills ("What is CBC?", "Are my results okay?", "When is my next test?", "What does 'slightly low' mean?")
  - Instant AI explanations for general queries
  - Medicine questions routed banner ("Questions about medicines go to your doctor. Sent to Dr. Priya Mehta.")
  - Input field supporting questions in Hindi or English
- [x] **5.8 Patient Settings** (Figma Frame: `Patient – Settings.png`)
  - Profile card: Rohan Verma, RS-10475, +91 98765 43210, Delhi, India, B+, Type 2 Diabetes, Last visit 12 Oct 2026
  - "Connect a doctor": RS ID copy button, 6-digit connect code generator (`7K4-29Q`) with "New code" button and 3-step instructions
  - "Doctors with access": Dr. Priya Mehta with "Remove access" button
  - Language toggle: English / हिन्दी
  - Notification toggles: Medicine reminders, Test-due reminders, Doctor replies, Large text mode
  - Account sign out button

---

## Phase 6: Polish, Verification & Build
- [x] Full TypeScript type-checking (`tsc -b`)
- [x] Production build validation (`npm run build`)
- [x] Browser visual verification of doctor and patient flows
