import { describe, it, expect } from 'vitest';
import {
  serializeReport,
  serializeReports,
  serializePatientProfile,
  assertNoDoctorPrivateLeak,
} from './serializers';

describe('Doctor-Private Data Serializer & Policy Enforcement (Task 2.4)', () => {
  const mockReport = {
    id: 'rep_101',
    name: 'Complete Blood Count (CBC)',
    category: 'CBC',
    patientId: 'pat_202',
    patientName: 'Aarav Patel',
    labName: 'Lal PathLabs',
    collectionDate: '2026-10-25',
    reportedDate: '2026-10-26',
    status: 'Critical',
    reviewed: true,
    parameters: [
      {
        id: 'p1',
        name: 'Hemoglobin',
        value: 8.2,
        unit: 'g/dL',
        referenceRange: '13.0 - 17.0',
        status: 'Low',
      },
    ],
    aiOverview: {
      summary: 'Low hemoglobin levels detected.',
      pointsToConsider: ['Discuss iron supplementation'],
      keyFindings: [],
      generatedAt: '2026-10-26T10:00:00Z',
    },
    doctorSummary: {
      text: 'Patient shows moderate anemia. Prescribed ferrous ascorbate.',
      tone: 'Plain language',
      approvedAt: '2026-10-26T11:00:00Z',
      doctorName: 'Dr. Sharma',
    },
    // Doctor-Private Internal Fields (MUST BE STRIPPED FROM PATIENTS)
    privateNotes: 'Suspect internal occult GI bleed. Order FOBT if no improvement in 7 days.',
    priorityLabel: 'URGENT_TRIAGE_1',
    triageScore: 88,
    internalRiskScore: 'HIGH_RISK',
    internalFlags: ['FLAG_ANEMIA_SEVERE', 'FLAG_MONITOR_BLEED'],
    rawOcrText: 'CONFIDENTIAL LAB SYSTEM RAW SCAN METADATA 100293482...',
    doctorWorklistStatus: 'IN_REVIEW',
    differentialDiagnosisDraft: 'Iron deficiency vs Thalassemia minor',
  };

  const mockPatientProfile = {
    id: 'pat_202',
    rsId: 'RS-7821',
    name: 'Aarav Patel',
    age: 42,
    gender: 'Male',
    phone: '+919876543210',
    bloodGroup: 'B+',
    conditions: ['Hypertension'],
    // Doctor-Private Patient Fields
    doctorNotes: 'Patient tends to discontinue medication when asymptomatic. Poor adherence history.',
    complianceRisk: 'HIGH_NON_COMPLIANCE',
    internalTags: ['DIFFICULT_FOLLOWUP', 'NEED_CARETAKER_CALL'],
    billingNotes: 'Corporate account sponsored',
  };

  describe('Report Serialization', () => {
    it('should strip all doctor-private clinical notes and triage labels when role is patient', () => {
      const patientView = serializeReport(mockReport, 'patient');

      // Patient-facing fields must be intact
      expect(patientView.id).toBe('rep_101');
      expect(patientView.name).toBe('Complete Blood Count (CBC)');
      expect(patientView.status).toBe('Critical');
      expect(patientView.parameters).toHaveLength(1);
      expect(patientView.aiOverview.summary).toBe('Low hemoglobin levels detected.');
      expect(patientView.doctorSummary.doctorName).toBe('Dr. Sharma');

      // Private doctor fields must be strictly removed
      expect(patientView.privateNotes).toBeUndefined();
      expect(patientView.priorityLabel).toBeUndefined();
      expect(patientView.triageScore).toBeUndefined();
      expect(patientView.internalRiskScore).toBeUndefined();
      expect(patientView.internalFlags).toBeUndefined();
      expect(patientView.rawOcrText).toBeUndefined();
      expect(patientView.doctorWorklistStatus).toBeUndefined();
      expect(patientView.differentialDiagnosisDraft).toBeUndefined();

      // Defensive leak assertion must pass
      expect(() => assertNoDoctorPrivateLeak(patientView)).not.toThrow();
    });

    it('should retain all clinical notes and triage fields when role is doctor or admin', () => {
      const doctorView = serializeReport(mockReport, 'doctor');

      expect(doctorView.privateNotes).toBe(
        'Suspect internal occult GI bleed. Order FOBT if no improvement in 7 days.'
      );
      expect(doctorView.priorityLabel).toBe('URGENT_TRIAGE_1');
      expect(doctorView.triageScore).toBe(88);
      expect(doctorView.differentialDiagnosisDraft).toBe('Iron deficiency vs Thalassemia minor');

      const adminView = serializeReport(mockReport, 'admin');
      expect(adminView.privateNotes).toBeDefined();
    });

    it('should serialize an array of reports for patient role without leaks', () => {
      const reports = [mockReport, { ...mockReport, id: 'rep_102' }];
      const serialized = serializeReports(reports, 'patient');

      expect(serialized).toHaveLength(2);
      for (const rep of serialized) {
        expect(rep.privateNotes).toBeUndefined();
        expect(rep.priorityLabel).toBeUndefined();
        expect(() => assertNoDoctorPrivateLeak(rep)).not.toThrow();
      }
    });
  });

  describe('Patient Profile Serialization', () => {
    it('should strip doctorNotes, complianceRisk, and internalTags from patient profile when role is patient', () => {
      const patientView = serializePatientProfile(mockPatientProfile, 'patient');

      expect(patientView.id).toBe('pat_202');
      expect(patientView.name).toBe('Aarav Patel');
      expect(patientView.bloodGroup).toBe('B+');

      // Private clinical notes stripped
      expect(patientView.doctorNotes).toBeUndefined();
      expect(patientView.complianceRisk).toBeUndefined();
      expect(patientView.internalTags).toBeUndefined();
      expect(patientView.billingNotes).toBeUndefined();

      expect(() => assertNoDoctorPrivateLeak(patientView)).not.toThrow();
    });

    it('should preserve doctorNotes and complianceRisk when role is doctor', () => {
      const doctorView = serializePatientProfile(mockPatientProfile, 'doctor');

      expect(doctorView.doctorNotes).toBe(
        'Patient tends to discontinue medication when asymptomatic. Poor adherence history.'
      );
      expect(doctorView.complianceRisk).toBe('HIGH_NON_COMPLIANCE');
      expect(doctorView.internalTags).toContain('DIFFICULT_FOLLOWUP');
    });
  });

  describe('assertNoDoctorPrivateLeak Policy Enforcement', () => {
    it('should throw Error when a doctor-private field is detected in patient payload', () => {
      const leakingPayload = {
        id: 'rep_leak',
        name: 'Report',
        privateNotes: 'Sensitive note',
      };

      expect(() => assertNoDoctorPrivateLeak(leakingPayload)).toThrow(
        "Data leak detected: doctor-private field 'privateNotes' found in patient response"
      );
    });
  });
});
