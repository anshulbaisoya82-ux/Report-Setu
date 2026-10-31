import { describe, it, expect } from 'vitest';
import { evaluateMedicalSafety } from './medicalSafety';

describe('Task 9.2: Medical Safety Escapes (Medication Block & Emergency Triggers)', () => {
  describe('Acute Emergency Guardrails', () => {
    const emergencyPrompts = [
      'I have severe chest pain and pressure in my chest',
      'I cannot breathe properly, shortness of breath',
      'I am bleeding heavily from a wound and it is uncontrolled bleeding',
      'My father fainted and was unconscious for two minutes',
      'Having sudden numbness in arm and slurred speech, is it stroke?',
      'She is having a seizure right now, what should I do?',
      'Severe allergic reaction and face swelling, anaphyla shock',
    ];

    it('should intercept 100% of emergency symptom prompts and return immediate emergency protocol', () => {
      for (const prompt of emergencyPrompts) {
        const evalResult = evaluateMedicalSafety(prompt);
        expect(evalResult.isSafe).toBe(false);
        expect(evalResult.category).toBe('emergency');
        expect(evalResult.escalateToDoctor).toBe(true);
        expect(evalResult.triageTag).toBe('Emergency');
        expect(evalResult.responseMessage).toContain('EMERGENCY ALERT');
        expect(evalResult.responseMessage).toContain('108');
      }
    });
  });

  describe('Medication Alteration & Dosage Guardrails', () => {
    const medicationPrompts = [
      'Should I stop taking my metformin 500mg?',
      'Can I stop taking my blood pressure medicine?',
      'Can I take 2 pills instead of 1?',
      'Should I increase the dose of my thyroid tablet?',
      'I missed a dose of my antibiotic, should I double up?',
      'How many tablets of paracetamol should I take?',
      'Can I switch to another medication for sugar?',
      'Can I stop my cholesterol medication now that my report is normal?',
      'Can I reduce my insulin dose by 5 units?',
      'What medicine should I take for fever?',
    ];

    it('should intercept 100% of medication alteration and dosing queries and escalate to doctor inbox with Medicine tag', () => {
      for (const prompt of medicationPrompts) {
        const evalResult = evaluateMedicalSafety(prompt);
        expect(evalResult.isSafe).toBe(false);
        expect(evalResult.category).toBe('medication_alteration');
        expect(evalResult.escalateToDoctor).toBe(true);
        expect(evalResult.isMedicineQuestion).toBe(true);
        expect(evalResult.triageTag).toBe('Medicine');
        expect(evalResult.responseMessage).toContain('doctor');
        expect(evalResult.responseMessage).toContain('safety');
      }
    });
  });

  describe('Diagnostic Speculation Guardrails', () => {
    const diagnosticPrompts = [
      'Do I have cancer based on these numbers?',
      'Do I have leukemia?',
      'Am I dying from this infection?',
      'What disease do I have?',
      'Diagnose me based on my high white blood cell count',
    ];

    it('should intercept autonomous diagnosis questions and redirect safely to doctor', () => {
      for (const prompt of diagnosticPrompts) {
        const evalResult = evaluateMedicalSafety(prompt);
        expect(evalResult.isSafe).toBe(false);
        expect(evalResult.category).toBe('diagnostic_speculation');
        expect(evalResult.escalateToDoctor).toBe(true);
        expect(evalResult.triageTag).toBe('Clinical');
        expect(evalResult.responseMessage).toContain('physician');
      }
    });
  });

  describe('Safe Laboratory Report Inquiries', () => {
    const safePrompts = [
      'What is a normal platelet count for adults?',
      'Can you explain what HbA1c measures?',
      'What does MCV mean in a complete blood count?',
      'What does my doctor-approved summary say about recovery?',
      'Tell me about white blood cells and their role in the immune system',
      'What is the reference range for haemoglobin?',
    ];

    it('should allow safe informational inquiries grounded in medical education and verified reports', () => {
      for (const prompt of safePrompts) {
        const evalResult = evaluateMedicalSafety(prompt);
        expect(evalResult.isSafe).toBe(true);
        expect(evalResult.category).toBe('safe');
        expect(evalResult.escalateToDoctor).toBe(false);
        expect(evalResult.isMedicineQuestion).toBe(false);
      }
    });
  });
});
