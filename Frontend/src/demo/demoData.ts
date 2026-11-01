/**
 * DEMO MODE ONLY — synthetic, fictional data.
 *
 * Loaded only when VITE_DEMO_MODE=true. None of these people are real and no
 * value here is a real patient's result. Shapes mirror what the Express/Prisma
 * backend returns so the real UI code paths are exercised unchanged.
 */

const iso = (d: string) => new Date(`${d}T09:30:00.000Z`).toISOString();

export const DEMO_DOCTOR = {
  id: 'doc-priya',
  userId: 'user-doc-priya',
  name: 'Dr. Priya Mehta',
  email: 'priya.mehta@demo.reportsetu.in',
  phone: '+91 90000 00001',
  registrationNumber: 'DMC-DEMO-12345',
  medicalCouncil: 'Delhi Medical Council',
  specialty: 'General Physician',
  clinic: { name: 'Sunrise Family Clinic (demo)', address: 'Sector 18, Noida', city: 'Delhi NCR', timings: 'Mon–Sat · 10:00 AM – 2:00 PM' },
  verificationStatus: 'verified',
  verifiedAt: iso('2026-01-04'),
};

type P = {
  id: string; rsId: string; name: string; avatar: string; age: number; gender: 'Male' | 'Female';
  phone: string; location: string; bloodGroup: string; conditions: string[]; lastVisitDate: string;
  status: string; lastReportTime: string; lastReportName: string; connectedDoctors: string[];
};

const pt = (id: string, rsId: string, name: string, age: number, gender: 'Male' | 'Female', bloodGroup: string,
  conditions: string[], status: string, lastReportTime: string, lastReportName: string, location = 'Delhi, India'): P => ({
  id, rsId, name, avatar: name.split(' ').map((s) => s[0]).join(''), age, gender,
  phone: `+91 90000 ${rsId.slice(-5)}`, location, bloodGroup, conditions, lastVisitDate: '12 Oct 2026',
  status, lastReportTime, lastReportName, connectedDoctors: [DEMO_DOCTOR.id],
});

export const DEMO_PATIENTS: P[] = [
  pt('pat-meera', 'RS-10482', 'Meera Iyer', 54, 'Female', 'O+', ['Type 2 Diabetes'], 'Needs Review', '1 hour ago', 'HbA1c'),
  pt('pat-rohan', 'RS-10475', 'Rohan Verma', 32, 'Male', 'B+', ['Type 2 Diabetes'], 'Needs Review', '3 hours ago', 'CBC'),
  pt('pat-sana', 'RS-10461', 'Sana Qureshi', 41, 'Female', 'A+', ['Hypertension'], 'Needs Review', 'yesterday', 'CBC + HbA1c'),
  pt('pat-arjun', 'RS-10448', 'Arjun Nair', 47, 'Male', 'AB+', ['Prediabetes'], 'Follow-up due', 'yesterday', 'HbA1c', 'Kochi, India'),
  pt('pat-kavya', 'RS-10432', 'Kavya Menon', 29, 'Female', 'B-', [], 'Follow-up due', '2 days ago', 'CBC', 'Bengaluru, India'),
  pt('pat-dev', 'RS-10419', 'Dev Malhotra', 58, 'Male', 'O-', ['High cholesterol'], 'Up to date', '5 days ago', 'Lipid Profile'),
  pt('pat-ishita', 'RS-10406', 'Ishita Rao', 36, 'Female', 'A-', [], 'Up to date', '1 week ago', 'CBC', 'Pune, India'),
  pt('pat-nikhil', 'RS-10391', 'Nikhil Joshi', 44, 'Male', 'B+', ['Type 2 Diabetes'], 'Up to date', '2 weeks ago', 'HbA1c', 'Jaipur, India'),
];

export const DEMO_PATIENT_SELF = DEMO_PATIENTS[1]; // Rohan Verma is the demo patient login

type Param = { id: string; name: string; value: number; unit: string; referenceRange: string; status: 'Normal' | 'Low' | 'High' | 'Critical' };
const prm = (id: string, name: string, value: number, unit: string, referenceRange: string, status: Param['status'] = 'Normal'): Param =>
  ({ id, name, value, unit, referenceRange, status });

const cbc = (hb: number, rbc: number, wbc: number, plt: number, hct: number, rdw: number): Param[] => [
  prm('hb', 'Hemoglobin (Hb)', hb, 'g/dL', '13.0 – 17.0', hb < 13 ? 'Low' : 'Normal'),
  prm('rbc', 'Total RBC Count', rbc, 'million/µL', '4.5 – 5.9', rbc < 4.5 ? 'Low' : 'Normal'),
  prm('wbc', 'Total WBC Count', wbc, 'thousand/µL', '4.0 – 11.0'),
  prm('plt', 'Platelet Count', plt, 'lakh/µL', '1.5 – 4.5', plt < 1.5 ? (plt < 1.0 ? 'Critical' : 'Low') : 'Normal'),
  prm('hct', 'Hematocrit (HCT)', hct, '%', '40.0 – 50.0', hct < 40 ? 'Low' : 'Normal'),
  prm('mcv', 'MCV', 88.4, 'fL', '83.0 – 101.0'),
  prm('mch', 'MCH', 28.1, 'pg', '27.0 – 32.0'),
  prm('mchc', 'MCHC', 32.0, 'g/dL', '31.5 – 34.5'),
  prm('rdw', 'RDW', rdw, '%', '11.5 – 14.5', rdw > 14.5 ? 'High' : 'Normal'),
];

const overview = (summary: string, points: string[], findings: { parameter: string; value: string; unit: string; tag: 'Low' | 'High' | 'Normal' | 'Critical'; changeText: string }[]) => ({
  summary, pointsToConsider: points, keyFindings: findings, generatedAt: iso('2026-10-22'),
});

const rep = (id: string, p: P, name: string, category: string, labName: string, date: string, status: 'Critical' | 'Unbalanced' | 'Normal',
  parameters: Param[], reviewed: boolean, aiOverview: any, doctorSummary?: any) => ({
  id, patientId: p.id, patientName: p.name, patientAvatar: p.avatar, name, category, labName,
  collectionDate: iso(date), reportedDate: iso(date), status,
  reviewStatus: reviewed ? 'approved' : 'pending', reviewed, reviewedAt: reviewed ? iso(date) : undefined,
  reviewedBy: reviewed ? DEMO_DOCTOR.name : undefined, doctorViewed: reviewed,
  parameters, aiOverview, doctorSummary,
});

const [meera, rohan, sana, arjun, kavya, dev, ishita, nikhil] = DEMO_PATIENTS;

const rohanSummary = {
  text: 'Most of your blood counts are normal. Your platelets are lower than usual, and they have been going down over your last three reports. Your doctor will repeat this test on 6 November and talk about it at your visit. No change to your medicines.',
  hindiText: 'आपकी ज़्यादातर रक्त जाँच सामान्य है। आपके प्लेटलेट्स सामान्य से कम हैं। डॉक्टर 6 नवंबर को यह जाँच दोबारा करेंगी। आपकी दवाओं में कोई बदलाव नहीं है।',
  tone: 'Plain language', approvedAt: '23 Oct 2026', doctorName: DEMO_DOCTOR.name,
  nextTestDate: '06 Nov 2026', medicinesStatus: 'No change', sentVia: ['App'],
};

export const DEMO_REPORTS = [
  rep('rep-meera-hba1c', meera, 'HbA1c', 'HbA1c', 'Thyrocare', '2026-10-22', 'Critical',
    [prm('hba1c', 'HbA1c', 12.4, '%', '< 5.7', 'Critical'), prm('eag', 'Estimated Average Glucose', 309, 'mg/dL', '< 117', 'Critical')],
    false, overview('HbA1c is well above the reference range and higher than the previous result. Flagged for prompt clinician review.',
      ['Compare with the previous HbA1c of 9.8% (Jul 2026).', 'Confirm the current treatment plan at the next visit.'],
      [{ parameter: 'HbA1c', value: '12.4', unit: '%', tag: 'Critical', changeText: '↑ 2.6 since Jul' }])),
  rep('rep-rohan-cbc-oct', rohan, 'Complete Blood Count (CBC)', 'CBC', 'Apollo Diagnostics', '2026-10-22', 'Unbalanced',
    cbc(13.2, 4.2, 9.8, 1.2, 38.1, 15.2), true,
    overview('Platelet count is below the reference range and has declined across the last three CBC reports. RBC and hematocrit are slightly low; RDW slightly high.',
      ['Platelets trend: 1.9 → 1.6 → 1.2 lakh/µL.', 'Consider a repeat CBC to confirm.'],
      [{ parameter: 'Platelet Count', value: '1.2', unit: 'lakh/µL', tag: 'Low', changeText: '↓ 0.4 since Mar' },
       { parameter: 'Hematocrit', value: '38.1', unit: '%', tag: 'Low', changeText: '↓ 1.2' },
       { parameter: 'RDW', value: '15.2', unit: '%', tag: 'High', changeText: '↑ 0.6' }]),
    rohanSummary),
  rep('rep-sana-cbc', sana, 'CBC + HbA1c', 'CBC', 'Metropolis', '2026-10-21', 'Critical',
    [...cbc(11.6, 4.1, 7.2, 2.4, 36.0, 13.8), prm('hba1c', 'HbA1c', 10.8, '%', '< 5.7', 'Critical')], false,
    overview('HbA1c markedly above range; hemoglobin and hematocrit below range.', ['Review glycaemic control.'],
      [{ parameter: 'HbA1c', value: '10.8', unit: '%', tag: 'Critical', changeText: 'First result' }])),
  rep('rep-arjun-hba1c', arjun, 'HbA1c', 'HbA1c', 'Thyrocare', '2026-10-21', 'Unbalanced',
    [prm('hba1c', 'HbA1c', 6.3, '%', '< 5.7', 'High')], false,
    overview('HbA1c above the reference range, in the prediabetes band.', ['Compare with prior result of 6.1%.'],
      [{ parameter: 'HbA1c', value: '6.3', unit: '%', tag: 'High', changeText: '↑ 0.2' }])),
  rep('rep-kavya-cbc', kavya, 'Complete Blood Count (CBC)', 'CBC', 'Apollo Diagnostics', '2026-10-20', 'Unbalanced',
    cbc(12.4, 4.6, 6.1, 2.8, 41.0, 13.1), false,
    overview('Hemoglobin slightly below range; other values within range.', [], [{ parameter: 'Hemoglobin', value: '12.4', unit: 'g/dL', tag: 'Low', changeText: '↓ 0.3' }])),
  rep('rep-dev-lipid', dev, 'Lipid Profile', 'Lipid', 'Metropolis', '2026-10-17', 'Normal',
    [prm('chol', 'Total Cholesterol', 186, 'mg/dL', '< 200'), prm('ldl', 'LDL Cholesterol', 96, 'mg/dL', '< 100'), prm('hdl', 'HDL Cholesterol', 48, 'mg/dL', '> 40'), prm('tg', 'Triglycerides', 138, 'mg/dL', '< 150')],
    true, overview('All lipid values within reference range.', [], [])),
  rep('rep-ishita-cbc', ishita, 'Complete Blood Count (CBC)', 'CBC', 'Apollo Diagnostics', '2026-10-15', 'Normal', cbc(13.6, 4.8, 6.4, 2.6, 42.0, 12.9), true,
    overview('All values within reference range.', [], [])),
  rep('rep-nikhil-hba1c', nikhil, 'HbA1c', 'HbA1c', 'Thyrocare', '2026-10-08', 'Normal', [prm('hba1c', 'HbA1c', 5.5, '%', '< 5.7')], true,
    overview('HbA1c within reference range.', [], [])),
  // Rohan's history
  rep('rep-rohan-lipid', rohan, 'Lipid Profile', 'Lipid', 'Metropolis', '2026-08-20', 'Normal',
    [prm('chol', 'Total Cholesterol', 178, 'mg/dL', '< 200'), prm('ldl', 'LDL Cholesterol', 92, 'mg/dL', '< 100'), prm('hdl', 'HDL Cholesterol', 46, 'mg/dL', '> 40')], true,
    overview('All lipid values within reference range.', [], []), { ...rohanSummary, text: 'Your cholesterol values are all in the normal range. Keep up your evening walks.', hindiText: undefined, approvedAt: '21 Aug 2026', nextTestDate: undefined }),
  rep('rep-rohan-hba1c', rohan, 'HbA1c', 'HbA1c', 'Thyrocare', '2026-06-05', 'Unbalanced', [prm('hba1c', 'HbA1c', 7.1, '%', '< 5.7', 'High')], true,
    overview('HbA1c above range; improved from 7.6%.', [], [{ parameter: 'HbA1c', value: '7.1', unit: '%', tag: 'High', changeText: '↓ 0.5' }]),
    { ...rohanSummary, text: 'Your 3-month sugar average (HbA1c) is better than last time but still above normal. Continue your medicine as prescribed.', hindiText: undefined, approvedAt: '06 Jun 2026', nextTestDate: undefined }),
  rep('rep-rohan-cbc-mar', rohan, 'Complete Blood Count (CBC)', 'CBC', 'Apollo Diagnostics', '2026-03-12', 'Normal', cbc(12.4, 4.6, 8.9, 1.6, 39.6, 14.6), true,
    overview('Platelets at the lower limit of the range.', [], []), { ...rohanSummary, text: 'Your blood counts are mostly normal. Platelets are at the lower edge of normal.', hindiText: undefined, approvedAt: '13 Mar 2026', nextTestDate: undefined }),
  rep('rep-rohan-lft', rohan, 'Liver Function Test (LFT)', 'LFT', 'Metropolis', '2026-01-18', 'Normal',
    [prm('sgot', 'SGOT / AST', 31, 'U/L', '5 – 40'), prm('sgpt', 'SGPT / ALT', 38, 'U/L', '7 – 56'), prm('bili', 'Total Bilirubin', 0.8, 'mg/dL', '0.2 – 1.2')], true,
    overview('All liver values within range.', [], []), { ...rohanSummary, text: 'Your liver test results are all normal.', hindiText: undefined, approvedAt: '19 Jan 2026', nextTestDate: undefined }),
  rep('rep-rohan-cbc-2025', rohan, 'Complete Blood Count (CBC)', 'CBC', 'Thyrocare', '2025-10-03', 'Normal', cbc(12.1, 4.7, 8.1, 1.9, 40.4, 13.9), true,
    overview('All values within range.', [], []), { ...rohanSummary, text: 'Your blood counts are normal.', hindiText: undefined, approvedAt: '04 Oct 2025', nextTestDate: undefined }),
];

export const DEMO_PRESCRIPTIONS = [
  { id: 'rx-1', patientId: rohan.id, name: 'Metformin 500 mg', instructions: '1 tablet · Morning and Night · after food', startDate: '12 Oct 2026', endDate: '10 Jan 2027', totalDays: 90, remainingDays: 71, status: 'Active', doctorName: DEMO_DOCTOR.name, advice: ['Walk 30 minutes daily', 'Less sugar in your diet'] },
  { id: 'rx-0', patientId: rohan.id, name: 'Metformin 500 mg', instructions: '1 tablet · Morning · after food', startDate: '07 Jul 2026', endDate: '05 Oct 2026', totalDays: 90, remainingDays: 0, status: 'Ended', doctorName: DEMO_DOCTOR.name, advice: [] },
];

export const DEMO_SCHEDULE = [
  { id: 'dose-am', name: 'Metformin 500 mg', dose: '1 tablet', timing: 'Morning · after breakfast', scheduledTime: '08:00 AM', state: 'taken', takenAt: 'Taken at 8:15', instructions: 'After breakfast' },
  { id: 'walk', name: 'Evening walk', dose: '30 minutes', timing: "Doctor's advice", scheduledTime: '06:30 PM', state: 'due', instructions: "Doctor's advice · 30 minutes daily" },
  { id: 'dose-pm', name: 'Metformin 500 mg', dose: '1 tablet', timing: 'Night · after dinner', scheduledTime: '09:00 PM', state: 'due', instructions: 'After dinner' },
];

/** Appointment dates relative to today so the demo schedule never goes stale. */
const rel = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' }).replace(/^(\w+)\s/, '$1, ');
};

const apt = (id: string, p: P, reason: string, date: string, time: string, type: string, status: string, requestedAt = 'Today') => ({
  id, patientId: p.id, patientName: p.name, patientRsId: p.rsId, doctorId: DEMO_DOCTOR.id, doctorName: DEMO_DOCTOR.name,
  reason, date, time, type, status, requestedAt,
});

export const DEMO_APPOINTMENTS = [
  apt('apt-1', dev, 'Routine check-up', rel(0), '09:30 AM', 'In-person', 'Completed'),
  apt('apt-2', kavya, 'Follow-up · CBC', rel(0), '10:30 AM', 'In-person', 'Completed'),
  apt('apt-3', ishita, 'Report review', rel(0), '12:00 PM', 'Video call', 'Confirmed'),
  apt('apt-4', nikhil, 'Follow-up · HbA1c', rel(0), '02:30 PM', 'In-person', 'Confirmed'),
  apt('apt-5', meera, 'Follow-up · HbA1c review', rel(1), '11:30 AM', 'Video call', 'Pending'),
  apt('apt-6', rohan, 'CBC report discussion', rel(1), '12:15 PM', 'In-person', 'Pending'),
  apt('apt-7', sana, 'New consultation', rel(2), '10:00 AM', 'In-person', 'Pending'),
  apt('apt-8', arjun, 'Follow-up · medication review', rel(3), '04:30 PM', 'Phone call', 'Pending'),
  apt('apt-9', rohan, 'Routine check-up', 'Mon, 12 Oct', '11:00 AM', 'In-person', 'Completed', '10 Oct'),
  apt('apt-10', rohan, 'CBC report review', 'Thu, 12 Mar', '05:00 PM', 'Video call', 'Completed', '11 Mar'),
];

export const DEMO_THREADS = [
  {
    id: 'thread-rohan', patientId: rohan.id, patientName: rohan.name, patientRsId: rohan.rsId, patientAvatar: rohan.avatar,
    reportContext: 'CBC · 22 Oct', category: 'Medicine', unreadCount: 1, lastMessageTime: 'Today · 10:04 AM', isAiPaused: false, doctorName: DEMO_DOCTOR.name,
    suggestedReply: 'Please continue Metformin as usual. We will talk about the platelet result at your visit.',
    messages: [
      { id: 'm1', sender: 'patient', text: 'What does low platelet count mean?', timestamp: '10:02 AM' },
      { id: 'm2', sender: 'assistant', text: 'Platelets help your blood clot. Your count is 1.2 lakh/µL, lower than the normal range of 1.5–4.5. Your doctor wants to repeat the test on 6 November.', timestamp: '10:02 AM' },
      { id: 'm3', sender: 'patient', text: 'Should I stop my Metformin?', timestamp: '10:04 AM', isMedicineQuestion: true },
      { id: 'm4', sender: 'system', text: 'Questions about medicines go to your doctor. Sent to Dr. Priya Mehta.', timestamp: '10:04 AM' },
    ],
  },
  {
    id: 'thread-meera', patientId: meera.id, patientName: meera.name, patientRsId: meera.rsId, patientAvatar: meera.avatar,
    reportContext: 'HbA1c · 22 Oct', category: 'Report', unreadCount: 1, lastMessageTime: 'Today · 9:12 AM', isAiPaused: false, doctorName: DEMO_DOCTOR.name,
    messages: [
      { id: 'n1', sender: 'patient', text: 'Is 12.4 very high? Should I be worried?', timestamp: '9:12 AM' },
      { id: 'n2', sender: 'assistant', text: 'Your HbA1c of 12.4% is above the reference range (below 5.7%). Your doctor has been notified and will review it.', timestamp: '9:12 AM' },
    ],
  },
  {
    id: 'thread-kavya', patientId: kavya.id, patientName: kavya.name, patientRsId: kavya.rsId, patientAvatar: kavya.avatar,
    reportContext: 'CBC · 20 Oct', category: 'General', unreadCount: 0, lastMessageTime: 'Yesterday', isAiPaused: false, doctorName: DEMO_DOCTOR.name,
    messages: [
      { id: 'k1', sender: 'patient', text: 'When should I take my next test?', timestamp: 'Yesterday' },
      { id: 'k2', sender: 'doctor', text: 'Please repeat the CBC in 4 weeks.', timestamp: 'Yesterday' },
    ],
  },
];

export const DEMO_ADMIN_DOCTORS = [
  { ...DEMO_DOCTOR, createdAt: iso('2026-01-02') },
  { id: 'doc-2', name: 'Dr. Arvind Kulkarni', email: 'arvind.k@demo.reportsetu.in', phone: '+91 90000 00002', registrationNumber: 'MMC-DEMO-55120', medicalCouncil: 'Maharashtra Medical Council', specialty: 'Endocrinologist', clinic: { name: 'Pune Diabetes Care (demo)' }, verificationStatus: 'pending', createdAt: iso('2026-10-29') },
  { id: 'doc-3', name: 'Dr. Fatima Sheikh', email: 'fatima.s@demo.reportsetu.in', phone: '+91 90000 00003', registrationNumber: 'KMC-DEMO-77031', medicalCouncil: 'Karnataka Medical Council', specialty: 'Haematologist', clinic: { name: 'Lakeside Clinic (demo)' }, verificationStatus: 'pending', createdAt: iso('2026-10-30') },
  { id: 'doc-4', name: 'Dr. Rakesh Bansal', email: 'rakesh.b@demo.reportsetu.in', phone: '+91 90000 00004', registrationNumber: 'UNVERIFIED-001', medicalCouncil: 'Unknown', specialty: 'General Physician', clinic: { name: '—' }, verificationStatus: 'rejected', rejectionReason: 'Registration number not found in council register', createdAt: iso('2026-10-11') },
];

