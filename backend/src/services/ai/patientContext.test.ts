import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { connectTestDb, closeTestDb, clearTestDb } from '../../utils/testDb';
import { User } from '../../utils/testModels';
import { PatientProfile } from '../../utils/testModels';
import { DoctorProfile } from '../../utils/testModels';
import { Report } from '../../utils/testModels';
import { DoctorNote } from '../../utils/testModels';
import { Prescription } from '../../utils/testModels';
import { ChatMessage } from '../../utils/testModels';
import { buildPatientContext } from './patientContextBuilder';

describe('Task 9.1: Deterministic Patient Context Builder', () => {
  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
  });

  it('should assemble verified patient profile, confirmed reports, trends, and active prescriptions', async () => {
    // 1. Create Patient & Doctor Users
    const patientUser = await User.create({
      phone: '+919876543210',
      role: 'patient',
      isActive: true,
    });

    const doctorUser = await User.create({
      phone: '+919123456789',
      role: 'doctor',
      isActive: true,
    });

    const doctorProfile = await DoctorProfile.create({
      userId: doctorUser._id,
      name: 'Dr. Priya Mehta',
      phone: '+919123456789',
      email: 'priya@reportsetu.in',
      specialty: 'Internal Medicine',
      registrationNumber: 'MCI-99881',
      medicalCouncil: 'Delhi Medical Council',
      experienceYears: 12,
      hospital: 'Apollo Hospitals',
      rating: 4.9,
      verificationStatus: 'verified',
    });

    const patientProfile = await PatientProfile.create({
      userId: patientUser._id,
      name: 'Rohan Verma',
      phone: '+919876543210',
      age: 52,
      gender: 'Male',
      bloodGroup: 'B+',
      conditions: ['Hypertension', 'Type 2 Diabetes'],
      location: 'South Delhi',
      status: 'Critical', // Internal doctor priority label
      connectedDoctors: [doctorProfile._id],
    });

    // 2. Create Confirmed Report (reviewed: true) with approved summary
    const confirmedReport1 = await Report.create({
      patientId: patientProfile._id,
      patientName: patientProfile.name,
      name: 'Complete Blood Count',
      category: 'CBC',
      labName: 'Dr Lal PathLabs',
      collectionDate: new Date('2026-10-15'),
      reportedDate: new Date('2026-10-15'),
      status: 'Normal',
      reviewStatus: 'approved',
      reviewed: true,
      parameters: [
        {
          id: 'p-1',
          name: 'Haemoglobin',
          value: 13.8,
          unit: 'g/dL',
          referenceRange: '13.0 - 17.0',
          status: 'Normal',
        },
        {
          id: 'p-2',
          name: 'Platelet Count',
          value: 120000,
          unit: '/µL',
          referenceRange: '150000 - 450000',
          status: 'Low',
        },
      ],
      doctorSummary: {
        text: 'Platelets are slightly low but recovering well following viral infection. Maintain adequate hydration.',
        approvedAt: new Date('2026-10-16'),
        doctorName: 'Dr. Priya Mehta',
        tone: 'Plain language',
      },
    });

    // 3. Create Earlier Confirmed Report to establish longitudinal trend
    await Report.create({
      patientId: patientProfile._id,
      patientName: patientProfile.name,
      name: 'Complete Blood Count (Prior)',
      category: 'CBC',
      labName: 'Dr Lal PathLabs',
      collectionDate: new Date('2026-10-01'),
      reportedDate: new Date('2026-10-01'),
      status: 'Critical',
      reviewStatus: 'approved',
      reviewed: true,
      parameters: [
        {
          id: 'p-prev-1',
          name: 'Platelet Count',
          value: 85000,
          unit: '/µL',
          referenceRange: '150000 - 450000',
          status: 'Low',
        },
      ],
      doctorSummary: {
        text: 'Acute thrombocytopenia secondary to dengue fever.',
        approvedAt: new Date('2026-10-02'),
        doctorName: 'Dr. Priya Mehta',
        tone: 'Plain language',
      },
    });

    // 4. Create Unapproved / Draft Report (reviewed: false) - MUST BE EXCLUDED
    await Report.create({
      patientId: patientProfile._id,
      patientName: patientProfile.name,
      name: 'Unverified Lipid Panel',
      category: 'Lipid',
      labName: 'Quest Diagnostics',
      collectionDate: new Date('2026-10-20'),
      reportedDate: new Date('2026-10-20'),
      status: 'Unbalanced',
      reviewStatus: 'pending',
      reviewed: false, // Pending doctor review
      parameters: [
        {
          id: 'p-draft-1',
          name: 'Triglycerides',
          value: 350,
          unit: 'mg/dL',
          referenceRange: '< 150',
          status: 'High',
        },
      ],
      doctorSummary: {
        text: 'DRAFT: Patient may have severe dyslipidemia. Needs statin escalation.',
        approvedAt: new Date(),
        doctorName: 'Draft AI',
        tone: 'Plain language',
      },
    });

    // 5. Create Private Doctor Note (DoctorNote) - MUST BE STRICTLY EXCLUDED
    await DoctorNote.create({
      patientId: patientProfile._id,
      doctorId: doctorProfile._id,
      note: 'Patient is non-compliant with diet and skips morning medication.',
      category: 'Clinical Note',
    });

    // 6. Create Active Prescription
    await Prescription.create({
      patientId: patientProfile._id,
      doctorId: doctorProfile._id,
      doctorName: 'Dr. Priya Mehta',
      name: 'Post-Viral Recovery Regimen',
      instructions: 'Take with food. Do not skip doses.',
      startDate: new Date('2026-10-15'),
      endDate: new Date('2026-10-30'),
      totalDays: 15,
      status: 'Active',
      advice: ['Hydrate with 3L water daily', 'Rest'],
      medicines: [
        {
          name: 'Carica Papaya Leaf Extract',
          dose: '1100 mg',
          timing: 'Morning & Night',
          frequency: 'Twice daily',
        },
      ],
    });

    // 7. Create Prior Chat Message
    await ChatMessage.create({
      patientId: patientProfile._id,
      sender: 'patient',
      text: 'Are my platelets rising?',
      threadId: `thread-${patientProfile._id}`,
    });

    // Build the context
    const context = await buildPatientContext(patientProfile._id.toString());

    // VERIFICATIONS:
    // 1. Profile information is accurately mapped
    expect(context.profile.name).toBe('Rohan Verma');
    expect(context.profile.age).toBe(52);
    expect(context.profile.bloodGroup).toBe('B+');
    expect(context.profile.conditions).toContain('Type 2 Diabetes');

    // 2. Only confirmed reports are counted (2 confirmed, 1 pending excluded)
    expect(context.confirmedReportsCount).toBe(2);
    const trigParam = context.measurements.find((m) => m.testName === 'Triglycerides');
    expect(trigParam).toBeUndefined(); // Draft report parameter excluded!

    // 3. Approved summaries only include verified doctor summaries
    expect(context.approvedSummaries.length).toBe(2);
    const draftSummary = context.approvedSummaries.find((s) => s.summary.includes('DRAFT'));
    expect(draftSummary).toBeUndefined();

    // 4. Longitudinal trend computed correctly (Platelet Count rising from 85000 to 120000)
    const pltTrend = context.trends.find((t) => t.testName === 'platelet count');
    expect(pltTrend).toBeDefined();
    expect(pltTrend?.direction).toBe('rising');
    expect(pltTrend?.latestValue).toBe(120000);
    expect(pltTrend?.previousValue).toBe(85000);
    expect(pltTrend?.delta).toBe(35000);

    // 5. Active prescriptions populated
    expect(context.activePrescriptions.length).toBe(1);
    expect(context.activePrescriptions[0].prescriptionName).toBe('Post-Viral Recovery Regimen');
    expect(context.activePrescriptions[0].medicines[0].name).toBe('Carica Papaya Leaf Extract');

    // 6. Recent conversation populated
    expect(context.recentConversation.length).toBe(1);
    expect(context.recentConversation[0].text).toBe('Are my platelets rising?');

    // 7. Privacy check: DoctorNote or private annotations are NEVER in context
    expect((context as any).doctorNotes).toBeUndefined();
    expect((context as any).encryptedNote).toBeUndefined();
    expect((context as any).status).toBeUndefined(); // Doctor internal triage priority excluded from patient context
    expect(context.hasPrivateNotes).toBe(false);
  });
});
