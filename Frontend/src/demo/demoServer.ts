/**
 * DEMO MODE ONLY — an in-browser stand-in for the ReportSetu API.
 *
 * Installed from main.tsx only when VITE_DEMO_MODE=true. It intercepts fetch()
 * calls to the API base URL and answers with synthetic data shaped like the
 * real backend responses, so every page runs its real code path. State lives in
 * memory and resets on reload. Production builds never include this behaviour.
 *
 * Safety rules mirrored from the backend:
 *  - questions about medicines are never answered by the assistant; they are
 *    routed to the doctor,
 *  - the assistant never suggests medicines or treatment.
 */
import {
  DEMO_DOCTOR, DEMO_PATIENTS, DEMO_PATIENT_SELF, DEMO_REPORTS, DEMO_PRESCRIPTIONS,
  DEMO_SCHEDULE, DEMO_APPOINTMENTS, DEMO_THREADS, DEMO_ADMIN_DOCTORS,
} from './demoData';
import { demoSearchMedicines } from './demoMedicineSearch';

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

const db = {
  patients: clone(DEMO_PATIENTS),
  reports: clone(DEMO_REPORTS) as any[],
  prescriptions: clone(DEMO_PRESCRIPTIONS) as any[],
  schedule: clone(DEMO_SCHEDULE) as any[],
  appointments: clone(DEMO_APPOINTMENTS) as any[],
  threads: clone(DEMO_THREADS) as any[],
  adminDoctors: clone(DEMO_ADMIN_DOCTORS) as any[],
  notes: [] as any[],
  patientCode: '7K429Q',
  // Synthetic demo: food rules "set by" the demo doctor for the demo patient.
  foodRules: {
    'pat-rohan': { limits: { sugar: 5, salt: 1.5, saturatedFat: null }, allergies: ['Peanut'], avoid: ['Added sugar'], note: 'Check portion size too.', updatedAt: '2026-10-23T10:00:00.000Z', updatedBy: 'Dr. Priya Mehta' },
  } as Record<string, any>,
};

const role = () => localStorage.getItem('reportsetu_role') || 'doctor';
const nowTime = () => new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
const MED_WORDS = /(stop|dose|dosage|tablet|medicine|medication|metformin|insulin|increase|decrease|skip|दवा|गोली)/i;

const ok = (data: unknown, status = 200) =>
  new Response(JSON.stringify({ success: true, data }), { status, headers: { 'Content-Type': 'application/json' } });
// The real profile endpoints use { status, data } rather than { success, data }.
const okProfile = (data: unknown) =>
  new Response(JSON.stringify({ status: 'success', data }), { status: 200, headers: { 'Content-Type': 'application/json' } });
const fail = (message: string, status = 400) =>
  new Response(JSON.stringify({ success: false, error: { message } }), { status, headers: { 'Content-Type': 'application/json' } });

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
const selfThread = () => db.threads.find((t) => t.patientId === DEMO_PATIENT_SELF.id);
const patientReports = (id: string) => db.reports.filter((r) => r.patientId === id);

async function readBody(init?: RequestInit): Promise<any> {
  if (!init?.body || init.body instanceof FormData) return {};
  try { return JSON.parse(String(init.body)); } catch { return {}; }
}

type Handler = (m: RegExpMatchArray, body: any, url: URL, init?: RequestInit) => Response | Promise<Response>;
const routes: [string, RegExp, Handler][] = [
  // ── Auth ────────────────────────────────────────────────────────────────
  ['POST', /^\/auth\/doctor\/login$/, () => ok({ user: { id: DEMO_DOCTOR.userId, role: 'doctor' }, doctor: DEMO_DOCTOR, accessToken: 'demo-token-doctor', refreshToken: 'demo-refresh' })],
  ['POST', /^\/auth\/doctor\/signup$/, (_m, b) => ok({ user: { role: 'doctor' }, doctor: { ...b, verificationStatus: 'pending' }, message: 'Account created. An administrator will verify your registration.' }, 201)],
  ['POST', /^\/auth\/patient\/send-otp$/, (_m, b) => ok({ phone: b.phone, expiresAt: new Date(Date.now() + 300000).toISOString(), devCode: '123456', message: 'Verification code sent (demo code: 123456)' })],
  ['POST', /^\/auth\/patient\/verify-otp$/, (_m, b) => b.otp !== '123456'
    ? fail('Incorrect code. In demo mode the code is 123456.')
    : ok({ user: { role: 'patient' }, patient: DEMO_PATIENT_SELF, accessToken: 'demo-token-patient', refreshToken: 'demo-refresh', isNewUser: false, isProfileComplete: true })],
  ['POST', /^\/auth\/(logout|refresh-token|refresh)$/, () => ok({ message: 'ok', accessToken: 'demo-token' })],

  // ── Profiles ────────────────────────────────────────────────────────────
  ['GET', /^\/doctor\/profile$/, () => okProfile({ ...DEMO_DOCTOR, stats: { activePatientsCount: db.patients.length, appointmentsCount: db.appointments.length, prescriptionsIssuedCount: db.prescriptions.length, reportsReviewedCount: db.reports.filter((r) => r.reviewed).length, pendingQuestionsCount: db.threads.filter((t) => t.unreadCount).length } })],
  ['PUT', /^\/doctor\/profile$/, (_m, b) => { Object.assign(DEMO_DOCTOR, b); return okProfile(DEMO_DOCTOR); }],
  ['GET', /^\/patient\/profile$/, () => okProfile({ ...DEMO_PATIENT_SELF, email: 'rohan.verma@demo.reportsetu.in', primaryDoctor: { id: DEMO_DOCTOR.id, name: DEMO_DOCTOR.name, specialty: DEMO_DOCTOR.specialty, clinic: DEMO_DOCTOR.clinic }, stats: { reportsCount: patientReports(DEMO_PATIENT_SELF.id).length, prescriptionsCount: db.prescriptions.length, appointmentsCount: db.appointments.filter((a) => a.patientId === DEMO_PATIENT_SELF.id).length, connectedDoctorsCount: 1 } })],
  ['PUT', /^\/patient\/profile$/, (_m, b) => { Object.assign(DEMO_PATIENT_SELF, b); return okProfile(DEMO_PATIENT_SELF); }],

  // ── Doctor ──────────────────────────────────────────────────────────────
  ['GET', /^\/doctor\/patients$/, (_m, _b, u) => {
    const q = (u.searchParams.get('search') || '').toLowerCase();
    const list = db.patients.filter((p) => !q || p.name.toLowerCase().includes(q) || p.rsId.toLowerCase().includes(q));
    return ok({ patients: list, total: list.length });
  }],
  ['GET', /^\/doctor\/patients\/([^/]+)\/private-notes$/, (m) => ok({ notes: db.notes.filter((n) => n.patientId === m[1]) })],
  ['POST', /^\/doctor\/patients\/([^/]+)\/private-notes$/, (m, b) => { const n = { id: `note-${Date.now()}`, patientId: m[1], ...b, createdAt: new Date().toISOString() }; db.notes.unshift(n); return ok(n, 201); }],
  ['GET', /^\/doctor\/questions$/, () => ok(db.threads)],
  ['POST', /^\/doctor\/questions\/([^/]+)\/reply$/, (m, b) => {
    const t = db.threads.find((x) => x.id === m[1]);
    if (!t) return fail('Thread not found', 404);
    t.messages.push({ id: `d-${Date.now()}`, sender: 'doctor', text: b.reply || b.text, timestamp: nowTime() });
    t.unreadCount = 0;
    return ok(t);
  }],
  ['POST', /^\/doctor\/questions\/([^/]+)\/toggle-ai$/, (m, b) => { const t = db.threads.find((x) => x.id === m[1]); if (t) t.isAiPaused = b.action === 'takeover'; return ok(t); }],
  ['POST', /^\/doctor\/threads\/([^/]+)\/suggest-reply$/, (m) => ok({ suggestedReply: db.threads.find((x) => x.id === m[1])?.suggestedReply || 'Thank you for your question. I will review your report and reply shortly.' })],

  // ── Reports ─────────────────────────────────────────────────────────────
  ['GET', /^\/reports\/doctor\/inbox$/, () => ok({ reports: db.reports.filter((r) => r.collectionDate > '2026-10-01'), total: db.reports.length })],
  ['GET', /^\/reports\/(patient\/[^/]+\/)?trends$/, () => ok({ trends: [] })],
  ['GET', /^\/reports\/patient\/([^/]+)$/, (m) => ok(patientReports(m[1]))],
  ['GET', /^\/reports$/, () => ok(patientReports(DEMO_PATIENT_SELF.id).filter((r) => role() !== 'patient' || r.reviewed || true))],
  ['POST', /^\/reports\/upload$/, async () => {
    await delay(900);
    const id = `rep-upload-${Date.now()}`;
    const report = { id, patientId: DEMO_PATIENT_SELF.id, patientName: DEMO_PATIENT_SELF.name, patientAvatar: DEMO_PATIENT_SELF.avatar,
      name: 'Complete Blood Count (CBC)', category: 'CBC', labName: 'Apollo Diagnostics', collectionDate: new Date().toISOString(),
      reportedDate: new Date().toISOString(), specimen: 'EDTA whole blood', status: 'Unbalanced', reviewStatus: 'pending', reviewed: false,
      parameters: [
        { id: 'hb', name: 'Hemoglobin (Hb)', value: 13.2, unit: 'g/dL', referenceRange: '13.0 – 17.0', status: 'Normal' },
        { id: 'rbc', name: 'Total RBC Count', value: 4.2, unit: 'million/µL', referenceRange: '4.5 – 5.9', status: 'Low' },
        { id: 'wbc', name: 'Total WBC Count', value: 9.8, unit: 'thousand/µL', referenceRange: '4.0 – 11.0', status: 'Normal' },
        { id: 'plt', name: 'Platelet Count', value: 1.2, unit: 'lakh/µL', referenceRange: '1.5 – 4.5', status: 'Low' },
        { id: 'hct', name: 'Hematocrit (HCT)', value: 38.1, unit: '%', referenceRange: '40.0 – 50.0', status: 'Low' },
      ], aiOverview: null };
    db.reports.unshift(report);
    return ok({ report, analysis: { confidence: 0.93 } }, 201);
  }],
  ['PUT', /^\/reports\/([^/]+)\/confirm$/, (m, b) => { const r = db.reports.find((x) => x.id === m[1]); if (!r) return fail('Report not found', 404); Object.assign(r, b, { reviewStatus: 'pending' }); return ok(r); }],
  ['PUT', /^\/reports\/([^/]+)\/review$/, (m, b) => {
    const r = db.reports.find((x) => x.id === m[1]);
    if (!r) return fail('Report not found', 404);
    Object.assign(r, { reviewed: true, reviewStatus: 'approved', reviewedAt: new Date().toISOString(), reviewedBy: DEMO_DOCTOR.name,
      doctorSummary: { text: b.summaryText, hindiText: b.hindiText, tone: b.tone || 'Plain language', approvedAt: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }), doctorName: DEMO_DOCTOR.name, nextTestDate: b.nextTestDate, medicinesStatus: b.medicinesStatus, sentVia: b.sentVia } });
    return ok(r);
  }],
  ['PUT', /^\/reports\/([^/]+)\/status$/, (m, b) => { const r = db.reports.find((x) => x.id === m[1]); if (r) r.reviewStatus = b.status; return ok(r); }],
  ['POST', /^\/reports\/([^/]+)\/view$/, (m) => { const r = db.reports.find((x) => x.id === m[1]); if (r) { r.doctorViewed = true; if (r.reviewStatus === 'pending') r.reviewStatus = 'in_review'; } return ok(r); }],
  ['POST', /^\/reports\/([^/]+)\/ai-overview$/, async (m) => { await delay(700); return ok(db.reports.find((x) => x.id === m[1])?.aiOverview); }],
  ['POST', /^\/reports\/([^/]+)\/generate-draft$/, async (m) => {
    await delay(800);
    const r = db.reports.find((x) => x.id === m[1]);
    const out = (r?.parameters || []).filter((p: any) => p.status !== 'Normal').map((p: any) => p.name.replace(/\s*\(.*\)/, ''));
    const en = out.length
      ? `Most of your results are in the normal range. ${out.join(', ')} ${out.length > 1 ? 'are' : 'is'} outside the usual range. Your doctor will talk with you about this at your next visit.`
      : 'All your results are in the normal range.';
    return ok({ summaryEn: en, summaryHi: 'आपकी ज़्यादातर रिपोर्ट सामान्य है। डॉक्टर अगली मुलाक़ात में आपसे इस बारे में बात करेंगी।' });
  }],
  ['GET', /^\/reports\/([^/]+)$/, (m) => { const r = db.reports.find((x) => x.id === m[1]); return r ? ok(r) : fail('Report not found', 404); }],

  // ── Medicines & prescriptions ───────────────────────────────────────────
  ['GET', /^\/medicines\/today$/, (_m, _b, u) => { const pid = u.searchParams.get('patientId'); const list = !pid || pid === DEMO_PATIENT_SELF.id ? db.schedule : []; return ok({ schedule: list, total: list.length }); }],
  ['GET', /^\/medicines\/adherence$/, (_m, _b, u) => (u.searchParams.get('patientId') && u.searchParams.get('patientId') !== DEMO_PATIENT_SELF.id) ? ok({ adherenceRate: 100, streakDays: 0, totalScheduled: 0, totalTaken: 0, totalMissed: 0 }) : ok({ adherenceRate: 86, streakDays: 2, totalScheduled: 14, totalTaken: 12, totalMissed: 1, message: 'Last 7 days' })],
  ['POST', /^\/medicines\/([^/]+)\/action$/, (m, b) => { const s = db.schedule.find((x) => x.id === m[1]); if (s) { s.state = b.action; s.takenAt = b.action === 'taken' ? `Taken at ${nowTime()}` : undefined; } return ok(s); }],
  ['GET', /^\/prescriptions\/medicine-suggestions$/, async (_m, _b, u) => {
    const q = (u.searchParams.get('q') || '').trim();
    const limit = Math.min(Number(u.searchParams.get('limit')) || 30, 100);
    const offset = Math.max(Number(u.searchParams.get('offset')) || 0, 0);
    const { total, items } = await demoSearchMedicines(q, limit, offset);
    return ok({ query: q, total, offset, suggestions: items.map((i) => i.name), items, source: 'demo' });
  }],
  // Food rules (doctor sets, patient checks labels against them)
  ['GET', /^\/food-rules\/me$/, () => ok({ rules: db.foodRules[DEMO_PATIENT_SELF.id] || null, conditions: DEMO_PATIENT_SELF.conditions || [] })],
  ['GET', /^\/food-rules\/patient\/([^/]+)$/, (m) => ok({ rules: db.foodRules[m[1]] || null, conditions: db.patients.find((p: any) => p.id === m[1])?.conditions || [] })],
  ['PUT', /^\/food-rules\/patient\/([^/]+)$/, (m, b) => {
    const clean = (l: unknown) => (Array.isArray(l) ? [...new Set(l.map((x) => String(x).trim()).filter((x) => x.length >= 2))] : []);
    const rules = { limits: b.limits || { sugar: null, salt: null, saturatedFat: null }, allergies: clean(b.allergies), avoid: clean(b.avoid), note: String(b.note || '').slice(0, 300), updatedAt: new Date().toISOString(), updatedBy: DEMO_DOCTOR.name };
    db.foodRules[m[1]] = rules;
    return ok({ rules });
  }],
  // Demo has no server reader: the page then reads the photo on the device (on-device OCR).
  ['POST', /^\/food-rules\/read-label$/, () => fail('Server photo reading is not available in the demo.', 503)],
  ['GET', /^\/prescriptions$/, () => ok({ prescriptions: db.prescriptions })],
  ['POST', /^\/prescriptions$/, (_m, b) => { const rx = { id: `rx-${Date.now()}`, status: 'Active', doctorName: DEMO_DOCTOR.name, remainingDays: b.totalDays || 30, advice: [], ...b }; db.prescriptions.unshift(rx); return ok(rx, 201); }],

  // ── Appointments ────────────────────────────────────────────────────────
  ['GET', /^\/appointments$/, () => ok({ appointments: role() === 'patient' ? db.appointments.filter((a) => a.patientId === DEMO_PATIENT_SELF.id) : db.appointments })],
  ['POST', /^\/appointments\/request$/, (_m, b) => {
    const p = role() === 'patient' ? DEMO_PATIENT_SELF : db.patients.find((x) => x.id === b.patientId) || DEMO_PATIENT_SELF;
    const a = { id: `apt-${Date.now()}`, patientId: p.id, patientName: p.name, patientRsId: p.rsId, doctorId: DEMO_DOCTOR.id, doctorName: DEMO_DOCTOR.name,
      reason: b.reason || 'Consultation', date: b.date, time: b.time, type: b.type || 'In-person', status: role() === 'doctor' ? 'Confirmed' : 'Pending', requestedAt: 'Just now', notes: b.notes };
    db.appointments.unshift(a);
    return ok(a, 201);
  }],
  ['PUT', /^\/appointments\/([^/]+)\/status$/, (m, b) => { const a = db.appointments.find((x) => x.id === m[1]); if (!a) return fail('Appointment not found', 404); Object.assign(a, { status: b.status }, b.date ? { date: b.date } : {}, b.time ? { time: b.time } : {}, b.notes ? { notes: b.notes } : {}); return ok(a); }],

  // ── Connections ─────────────────────────────────────────────────────────
  ['GET', /^\/connections\/my$/, () => ok({ connections: [{ id: 'conn-1', doctorId: DEMO_DOCTOR.id, name: DEMO_DOCTOR.name, doctorName: DEMO_DOCTOR.name, specialty: DEMO_DOCTOR.specialty, clinic: DEMO_DOCTOR.clinic, doctor: { id: DEMO_DOCTOR.id, name: DEMO_DOCTOR.name, specialty: DEMO_DOCTOR.specialty, clinic: DEMO_DOCTOR.clinic }, connectedAt: '2026-03-12T09:30:00.000Z', status: 'active' }] })],
  ['GET', /^\/connections\/patient\/pending$/, () => ok({ requests: [] })],
  ['POST', /^\/connections\/patient\/generate-code$/, () => ok({ code: db.patientCode, expiresAt: new Date(Date.now() + 120000).toISOString(), rsId: DEMO_PATIENT_SELF.rsId, message: 'Verification code generated. Valid for 2 minutes.' })],
  ['POST', /^\/connections\/patient\/(approve|reject)$/, (m) => ok({ code: db.patientCode, expiresAt: new Date(Date.now() + 120000).toISOString(), connectionId: 'conn-x', doctorName: DEMO_DOCTOR.name, message: m[1] === 'approve' ? 'Approved' : 'Rejected' })],
  ['POST', /^\/connections\/patient\/revoke\/([^/]+)$/, () => ok({ message: 'Doctor connection revoked successfully.' })],
  ['POST', /^\/connections\/doctor\/(request|request-vcode)$/, (_m, b) => {
    const p = db.patients.find((x) => x.rsId.toUpperCase() === String(b.rsId || b.patientRsId || '').toUpperCase());
    return ok({ connectionId: `conn-${Date.now()}`, patient: p ? { name: p.name, rsId: p.rsId } : { rsId: b.rsId }, status: 'pending', message: 'Request sent. Ask the patient to read out their connect code (demo code: 7K429Q).' });
  }],
  ['GET', /^\/connections\/doctor\/pending$/, () => ok({ requests: [] })],
  ['POST', /^\/connections\/doctor\/verify-code$/, (_m, b) => String(b.code || '').toUpperCase() !== db.patientCode
    ? fail('Invalid or expired code. In demo mode the code is 7K429Q.')
    : ok({ connection: { id: 'conn-new', status: 'active' }, patient: db.patients.find((x) => x.rsId === String(b.patientRsId || b.rsId).toUpperCase()) || DEMO_PATIENT_SELF, message: 'Connected with patient successfully.' })],
  ['POST', /^\/connections\/doctor\/revoke\/([^/]+)$/, () => ok({ message: 'Connection revoked/cancelled successfully.' })],

  // ── Notifications / privacy ─────────────────────────────────────────────
  ['GET', /^\/notifications$/, () => ok({ notifications: [], unreadCount: 0, total: 0 })],
  ['PUT', /^\/notifications\/.*$/, () => ok({})],
  ['GET', /^\/patient\/privacy\/export$/, () => ok({ profile: DEMO_PATIENT_SELF, reports: patientReports(DEMO_PATIENT_SELF.id), note: 'Demo export — synthetic data' })],
  ['DELETE', /^\/patient\/privacy\/account$/, () => fail('Account deletion is disabled in demo mode.', 403)],

  // ── Patient chat (Ask doctor) ───────────────────────────────────────────
  ['GET', /^\/patient\/chat\/thread$/, () => ok(selfThread())],
  ['GET', /^\/patient\/chat\/history$/, () => ok(selfThread()?.messages || [])],
  ['POST', /^\/patient\/chat$/, async (_m, b) => {
    await delay(600);
    const t = selfThread();
    const text = String(b.message || '');
    const isMed = MED_WORDS.test(text);
    t.messages.push({ id: `p-${Date.now()}`, sender: 'patient', text, timestamp: nowTime(), isMedicineQuestion: isMed });
    if (isMed) {
      t.unreadCount += 1; t.category = 'Medicine';
      const reply = { id: `s-${Date.now()}`, sender: 'system', text: `Questions about medicines go to your doctor. Sent to ${DEMO_DOCTOR.name}.`, timestamp: nowTime() };
      t.messages.push(reply);
      return ok({ ...reply, answer: reply.text, escalated: true, isMedicineQuestion: true, triageTag: 'Medicine' });
    }
    const plt = /platelet/i.test(text);
    const answer = plt
      ? 'Platelets help your blood clot. In your 22 Oct CBC your count is 1.2 lakh/µL, lower than the normal range of 1.5–4.5. Your doctor wants to repeat the test on 6 November.'
      : /next test|repeat/i.test(text)
        ? 'Your doctor has asked for a repeat CBC on 6 November.'
        : 'I can only explain what is in your doctor-approved report summary. Your latest CBC (22 Oct) shows most values in the normal range; platelets, RBC and hematocrit are a little low. For anything else, please ask your doctor.';
    const reply = { id: `a-${Date.now()}`, sender: 'assistant', text: answer, timestamp: nowTime(),
      citations: plt ? [{ date: '22 Oct 2026', testName: 'Platelet Count', value: 1.2, unit: 'lakh/µL' }] : [] };
    t.messages.push(reply);
    return ok({ ...reply, answer, escalated: false, isMedicineQuestion: false });
  }],

  // ── Admin ───────────────────────────────────────────────────────────────
  ['GET', /^\/admin\/stats$/, () => ok({
    totalDoctors: db.adminDoctors.length,
    pendingDoctors: db.adminDoctors.filter((d) => d.verificationStatus === 'pending').length,
    verifiedDoctors: db.adminDoctors.filter((d) => d.verificationStatus === 'verified').length,
    rejectedDoctors: db.adminDoctors.filter((d) => d.verificationStatus === 'rejected').length,
    totalPatients: db.patients.length, totalReports: db.reports.length,
  })],
  ['GET', /^\/admin\/doctors$/, (_m, _b, u) => {
    const s = u.searchParams.get('status'); const q = (u.searchParams.get('search') || '').toLowerCase();
    const list = db.adminDoctors.filter((d) => (!s || d.verificationStatus === s) && (!q || `${d.name} ${d.registrationNumber} ${d.medicalCouncil}`.toLowerCase().includes(q)));
    return ok({ doctors: list, total: list.length });
  }],
  ['POST', /^\/admin\/doctors\/verify-all$/, () => { let n = 0; db.adminDoctors.forEach((d) => { if (d.verificationStatus === 'pending') { d.verificationStatus = 'verified'; n++; } }); return ok({ message: `Verified ${n} doctor(s)`, count: n }); }],
  ['POST', /^\/admin\/doctors\/([^/]+)\/verify$/, (m) => { const d = db.adminDoctors.find((x) => x.id === m[1]); if (d) d.verificationStatus = 'verified'; return ok({ doctor: d, message: 'Doctor verified' }); }],
  ['POST', /^\/admin\/doctors\/([^/]+)\/reject$/, (m, b) => { const d = db.adminDoctors.find((x) => x.id === m[1]); if (d) { d.verificationStatus = 'rejected'; d.rejectionReason = b.reason; } return ok({ doctor: d, message: 'Doctor rejected' }); }],
];

export function installDemoServer(apiBase: string) {
  const realFetch = window.fetch.bind(window);
  const base = new URL(apiBase, window.location.href);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(raw, window.location.href);
    if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) return realFetch(input, init);

    const path = url.pathname.slice(base.pathname.replace(/\/$/, '').length) || '/';
    const method = (init?.method || 'GET').toUpperCase();
    const body = await readBody(init);
    await delay(150); // feel like a network so loading states are visible

    for (const [m, re, handler] of routes) {
      const match = path.match(re);
      if (m === method && match) return handler(match, body, url, init);
    }
    console.warn(`[demo] no demo handler for ${method} ${path}`);
    return fail(`This action isn't available in demo mode (${method} ${path}).`, 501);
  };
}

export { isDemoMode } from './flags';
