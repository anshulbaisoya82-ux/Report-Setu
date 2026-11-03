import { describe, it, expect } from 'vitest';
import {
  getDoctorInitials,
  analyzeHealthStatus,
  rankDoctors,
  VERIFIED_DOCTORS_POOL,
  SymptomRecord,
} from '../services/doctorRecommendationService';

describe('Smart Doctor Recommendation & Referral System', () => {
  describe('Doctor Initials Avatar Generation', () => {
    it('correctly extracts first and last name initials and strips titles', () => {
      expect(getDoctorInitials('Dr. Vikram Malhotra')).toBe('VM');
      expect(getDoctorInitials('Dr. Ananya Sen')).toBe('AS');
      expect(getDoctorInitials('Dr. Rajeshwari Kulkarni')).toBe('RK');
      expect(getDoctorInitials('Prof. Alok Verma')).toBe('AV');
      expect(getDoctorInitials('Doctor Priya Ramanathan')).toBe('PR');
      expect(getDoctorInitials('Siddharth Joshi')).toBe('SJ');
    });
  });

  describe('Biomarker & Symptom Mapping & Emergency Check', () => {
    it('maps high blood glucose & HbA1c to Endocrinology & Diabetology', () => {
      const mockReports = [
        {
          category: 'Diabetes',
          parameters: [
            { name: 'HbA1c Glycated Hemoglobin', value: 7.8, unit: '%', status: 'Critical' },
            { name: 'Fasting Blood Glucose', value: 165, unit: 'mg/dL', status: 'High' },
          ],
        },
      ];

      const analysis = analyzeHealthStatus(mockReports, []);
      expect(analysis.biomarkerConcernsCount).toBe(2);
      expect(analysis.abnormalParameters[0].mappedSpecialty).toBe('Endocrinology & Diabetology');
      expect(analysis.clinicalCategories).toContain('Metabolic');
      expect(analysis.isEmergency).toBe(false);
    });

    it('triggers emergency alert when platelets < 50,000 /µL', () => {
      const mockReports = [
        {
          category: 'CBC',
          parameters: [
            { name: 'Platelet Count', value: 0.42, unit: 'Lakh/µL', status: 'Critical' },
          ],
        },
      ];

      const analysis = analyzeHealthStatus(mockReports, []);
      expect(analysis.isEmergency).toBe(true);
      expect(analysis.emergencyTriggers.some((t) => t.includes('platelet'))).toBe(true);
    });

    it('triggers emergency alert on acute chest pain symptom', () => {
      const symptoms: SymptomRecord[] = [
        { id: '1', name: 'Severe chest pain radiating to arm', severity: 'Severe', duration: '2 hours' },
      ];

      const analysis = analyzeHealthStatus([], symptoms);
      expect(analysis.isEmergency).toBe(true);
      expect(analysis.emergencyTriggers.some((t) => t.includes('chest pain'))).toBe(true);
    });
  });

  describe('Weighted Doctor Ranking & Transparent Rationale', () => {
    it('ranks Endocrinologist highest for diabetes concerns and provides transparent rationale', () => {
      const mockReports = [
        {
          category: 'Diabetes',
          parameters: [
            { name: 'HbA1c', value: 8.2, unit: '%', status: 'Critical' },
          ],
        },
      ];
      const symptoms: SymptomRecord[] = [
        { id: '1', name: 'Excessive thirst and fatigue', severity: 'Moderate', duration: '2 weeks' },
      ];

      const analysis = analyzeHealthStatus(mockReports, symptoms);
      const ranked = rankDoctors(VERIFIED_DOCTORS_POOL, analysis, symptoms, 'All Modes', 'New Delhi');

      expect(ranked.length).toBeGreaterThan(0);
      const topDoctor = ranked[0];
      expect(topDoctor.doctor.specialty).toBe('Endocrinology & Diabetology');
      expect(topDoctor.initials).toBe('VM');
      expect(topDoctor.matchScore).toBeGreaterThanOrEqual(90);

      // Check transparent rationale
      expect(topDoctor.rationale.length).toBeGreaterThanOrEqual(2);
      expect(topDoctor.rationale.some((r) => r.includes('HbA1c') || r.includes('abnormal'))).toBe(true);
      expect(topDoctor.rationale.some((r) => r.includes('thirst') || r.includes('expertise'))).toBe(true);
    });

    it('ranks Cardiologist highest for cardiac symptoms', () => {
      const symptoms: SymptomRecord[] = [
        { id: '1', name: 'Heart palpitations and chest tightness', severity: 'Moderate', duration: '3 days' },
      ];

      const analysis = analyzeHealthStatus([], symptoms);
      const ranked = rankDoctors(VERIFIED_DOCTORS_POOL, analysis, symptoms, 'All Modes', 'New Delhi');

      const topDoctor = ranked[0];
      expect(topDoctor.doctor.specialty).toBe('Cardiology');
      expect(topDoctor.initials).toBe('AS');
    });
  });
});

