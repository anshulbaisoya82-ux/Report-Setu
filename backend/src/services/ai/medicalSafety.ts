export type MedicalSafetyCategory =
  | 'safe'
  | 'medication_alteration'
  | 'emergency'
  | 'diagnostic_speculation';

export interface MedicalSafetyEvaluation {
  isSafe: boolean;
  category: MedicalSafetyCategory;
  escalateToDoctor: boolean;
  isMedicineQuestion: boolean;
  triageTag?: 'Medicine' | 'Emergency' | 'Clinical';
  responseMessage?: string;
  flaggedReason?: string;
}

// Emergency keywords and phrases
const EMERGENCY_PATTERNS = [
  /\bchest\s+pain\b/i,
  /\bpressure\s+in\s+chest\b/i,
  /\bheart\s+attack\b/i,
  /\bcannot\s+breathe\b/i,
  /\bcan't\s+breathe\b/i,
  /\bdifficulty\s+breathing\b/i,
  /\bshort(?:ness)?\s+of\s+breath\b/i,
  /\bheavy\s+bleeding\b/i,
  /\buncontrolled\s+bleeding\b/i,
  /\bvomiting\s+blood\b/i,
  /\bcoughing\s+up\s+blood\b/i,
  /\bfaint(?:ed|ing)?\b/i,
  /\bunconscious(?:ness)?\b/i,
  /\bseizure\b/i,
  /\bcollapsed\b/i,
  /\bchoking\b/i,
  /\bstroke\b/i,
  /\bslurred\s+speech\b/i,
  /\bsudden\s+numbness\b/i,
  /\bsevere\s+allergic\s+reaction\b/i,
  /\banaphyla(?:xis|ctic)\b/i,
];

// Medication alteration and dosage modification patterns
const MEDICATION_ALTERATION_PATTERNS = [
  /\b(?:stop|discontinue|cease|quit)\s+(?:taking\s+)?(?:the\s+|my\s+)?(?:\w+\s+)*(?:medicine|medication|pill|tablet|drug|dose|metformin|aspirin|insulin|statin|antibiotic)\b/i,
  /\bshould\s+i\s+stop\b/i,
  /\bcan\s+i\s+stop\b/i,
  /\bskip\s+(?:a\s+)?(?:dose|pill|tablet|medicine)\b/i,
  /\bmissed\s+a\s+dose\b/i,
  /\b(?:change|switch|alter|adjust)\s+(?:the\s+|my\s+|to\s+)?(?:\w+\s+)*(?:dose|dosage|medicine|medication|prescription)\b/i,
  /\b(?:increase|raise|up)\s+(?:the\s+|my\s+)?(?:\w+\s+)*(?:dose|dosage|medicine|medication|units?)\b/i,
  /\b(?:decrease|reduce|lower)\s+(?:the\s+|my\s+)?(?:\w+\s+)*(?:dose|dosage|medicine|medication|units?)\b/i,
  /\bcan\s+i\s+take\s+(?:\d+\s+)?(?:pills?|tablets?|capsules?|doses?)\b/i,
  /\b(?:how\s+many|how\s+much)\s+(?:pills?|tablets?|capsules?|mg|units?|doses?)\b/i,
  /\bwhat\s+(?:medicine|medication|pill|tablet|drug|antibiotic)\s+(?:should|can|do)\s+i\s+take\b/i,
  /\bprescribe\s+me\b/i,
  /\bcan\s+i\s+take\s+(?:paracetamol|ibuprofen|aspirin|antibiotic|viagra|steroids|crocin|dolo)\b/i,
  /\b(?:dose|dosage)\s+of\s+(?:the\s+|my\s+)?(?:\w+\s+)*(?:tablet|medicine|pill|medication)\b/i,
  /\b(?:paracetamol|metformin|insulin|aspirin|statin)\s+(?:dose|dosage|tablet|pill)\b/i,
];

// Diagnostic speculation patterns
const DIAGNOSTIC_PATTERNS = [
  /\bdo\s+i\s+have\s+(?:cancer|leukemia|diabetes|hiv|aids|tumor|lymphoma|infection)\b/i,
  /\bam\s+i\s+(?:sick|dying|anemic)\b/i,
  /\bwhat\s+disease\s+do\s+i\s+have\b/i,
  /\bwill\s+i\s+die\b/i,
  /\bis\s+this\s+(?:terminal|fatal)\b/i,
  /\bdiagnos(?:e|is)\s+me\b/i,
];

/**
 * Evaluates patient query against medical safety guardrails (Task 9.2).
 * Strictly intercepts medication alteration and emergency inquiries.
 */
export function evaluateMedicalSafety(query: string): MedicalSafetyEvaluation {
  const clean = query.trim();

  // 1. Check for Acute Emergency Symptoms
  for (const pattern of EMERGENCY_PATTERNS) {
    if (pattern.test(clean)) {
      return {
        isSafe: false,
        category: 'emergency',
        escalateToDoctor: true,
        isMedicineQuestion: false,
        triageTag: 'Emergency',
        flaggedReason: 'Emergency medical symptom detected',
        responseMessage:
          'EMERGENCY ALERT: Your message mentions symptoms that may require urgent medical care. ' +
          'Please call emergency services immediately (108 / 112 in India, 911 in North America) ' +
          'or proceed to the nearest emergency department right away. ' +
          'Our AI clinical assistant cannot evaluate acute emergencies.',
      };
    }
  }

  // 2. Check for Medication Changes or Dosage Advice
  for (const pattern of MEDICATION_ALTERATION_PATTERNS) {
    if (pattern.test(clean)) {
      return {
        isSafe: false,
        category: 'medication_alteration',
        escalateToDoctor: true,
        isMedicineQuestion: true,
        triageTag: 'Medicine',
        flaggedReason: 'Medication change, dosage, or prescription query detected',
        responseMessage:
          'Your inquiry regarding starting, stopping, altering, or dosing medication has been forwarded ' +
          "directly to your doctor's priority clinical inbox. For your safety, medication adjustments " +
          'must be evaluated and authorized solely by your treating physician.',
      };
    }
  }

  // 3. Check for Diagnostic Speculation
  for (const pattern of DIAGNOSTIC_PATTERNS) {
    if (pattern.test(clean)) {
      return {
        isSafe: false,
        category: 'diagnostic_speculation',
        escalateToDoctor: true,
        isMedicineQuestion: false,
        triageTag: 'Clinical',
        flaggedReason: 'Autonomous disease diagnosis request detected',
        responseMessage:
          'Only a licensed physician can diagnose medical conditions. Your inquiry has been sent to ' +
          "your doctor's clinical questions queue. In the meantime, you can explore the verified, " +
          'confirmed parameters in your lab report.',
      };
    }
  }

  // 4. Safe Informational / Lab Report Query
  return {
    isSafe: true,
    category: 'safe',
    escalateToDoctor: false,
    isMedicineQuestion: false,
  };
}
