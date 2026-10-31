export type MedicalSafetyCategory =
  | 'safe'
  | 'prescription_request'
  | 'medication_alteration'
  | 'emergency'
  | 'diagnostic_speculation'
  | 'doctor_request';

export interface MedicalSafetyEvaluation {
  isSafe: boolean;
  category: MedicalSafetyCategory;
  escalateToDoctor: boolean;
  isMedicineQuestion: boolean;
  autoPauseAi: boolean;
  triageTag?: 'Medicine' | 'Emergency' | 'Clinical' | 'Prescription' | 'DoctorReview';
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

// Explicit Prescription & Medicine Recommendation Requests
const PRESCRIPTION_PATTERNS = [
  /\b(?:can\s+you|please|could\s+you)?\s*(?:prescribe|write\s+(?:me\s+)?(?:a\s+)?prescription|give\s+(?:me\s+)?(?:a\s+)?prescription)\b/i,
  /\bneed\s+(?:a\s+)?(?:new\s+)?prescription\b/i,
  /\bwhat\s+(?:medicine|medication|drug|pill|syrup|antibiotic)\s+(?:should|can|do)\s+i\s+(?:take|buy|use)\b/i,
  /\bwhat\s+(?:medicine|tablet|pill)\s+for\s+(?:fever|pain|cough|cold|infection|headache|stomach|bp|sugar)\b/i,
  /\bwhich\s+(?:medicine|tablet|drug|antibiotic)\s+is\s+best\s+for\b/i,
  /\brecommend\s+(?:me\s+)?(?:a\s+)?(?:medicine|medication|drug|tablet|pill)\b/i,
  /\bchange\s+my\s+prescription\b/i,
  /\brefill\s+(?:my\s+)?prescription\b/i,
  /\bprescribe\s+me\b/i,
  /\bcan\s+i\s+take\s+(?:paracetamol|ibuprofen|aspirin|antibiotic|viagra|steroids|crocin|dolo|azithromycin|amoxicillin)\b/i,
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
  /\b(?:dose|dosage)\s+of\s+(?:the\s+|my\s+)?(?:\w+\s+)*(?:tablet|medicine|pill|medication)\b/i,
  /\b(?:paracetamol|metformin|insulin|aspirin|statin)\s+(?:dose|dosage|tablet|pill)\b/i,
];

// Direct request for doctor intervention / review
const DOCTOR_REQUEST_PATTERNS = [
  /\bcan\s+the\s+doctor\s+(?:call|check|review|see|contact)\s+me\b/i,
  /\bdoctor\s+(?:please\s+)?(?:reply|call|advise|help|check)\b/i,
  /\bi\s+want\s+to\s+talk\s+to\s+(?:my\s+|the\s+)?doctor\b/i,
  /\bconnect\s+me\s+to\s+(?:my\s+|the\s+)?doctor\b/i,
  /\blet\s+doctor\s+(?:handle|answer|reply)\b/i,
  /\bask\s+the\s+doctor\b/i,
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
 * Evaluates patient query against medical safety guardrails.
 * Automatically triggers AI conversation pause and flags inquiry for connected doctor.
 */
export function evaluateMedicalSafety(query: string, doctorName = 'your doctor'): MedicalSafetyEvaluation {
  const clean = query.trim();

  // 1. Acute Emergency Symptoms
  for (const pattern of EMERGENCY_PATTERNS) {
    if (pattern.test(clean)) {
      return {
        isSafe: false,
        category: 'emergency',
        escalateToDoctor: true,
        autoPauseAi: true,
        isMedicineQuestion: false,
        triageTag: 'Emergency',
        flaggedReason: 'Emergency medical symptom detected',
        responseMessage:
          'EMERGENCY ALERT: Your message mentions symptoms that may require urgent medical attention. ' +
          'Please call emergency services immediately (108 / 112 in India, 911 in North America) ' +
          'or proceed to the nearest emergency department right away. ' +
          `Automated AI replies have been paused and this thread has been escalated to ${doctorName}.`,
      };
    }
  }

  // 2. Prescription & New Medicine Requests
  for (const pattern of PRESCRIPTION_PATTERNS) {
    if (pattern.test(clean)) {
      return {
        isSafe: false,
        category: 'prescription_request',
        escalateToDoctor: true,
        autoPauseAi: true,
        isMedicineQuestion: true,
        triageTag: 'Prescription',
        flaggedReason: 'Prescription or medication recommendation requested',
        responseMessage:
          'I cannot prescribe medications, suggest new drugs, or issue prescriptions. ' +
          `For your safety, I have paused automated AI replies on this conversation and forwarded your request directly to ${doctorName}. ` +
          'Please wait while your doctor reviews your request and carries forward your care.',
      };
    }
  }

  // 3. Medication Changes or Dosage Alterations
  for (const pattern of MEDICATION_ALTERATION_PATTERNS) {
    if (pattern.test(clean)) {
      return {
        isSafe: false,
        category: 'medication_alteration',
        escalateToDoctor: true,
        autoPauseAi: true,
        isMedicineQuestion: true,
        triageTag: 'Medicine',
        flaggedReason: 'Medication alteration or dosage adjustment requested',
        responseMessage:
          'Medication alterations, stopping drugs, or changing dosages must be evaluated and authorized solely by a licensed physician. ' +
          `I have paused AI responses and sent your inquiry directly to ${doctorName}'s clinical inbox. ` +
          'Please wait for your doctor to advise you.',
      };
    }
  }

  // 4. Direct Request for Doctor
  for (const pattern of DOCTOR_REQUEST_PATTERNS) {
    if (pattern.test(clean)) {
      return {
        isSafe: false,
        category: 'doctor_request',
        escalateToDoctor: true,
        autoPauseAi: true,
        isMedicineQuestion: false,
        triageTag: 'DoctorReview',
        flaggedReason: 'Direct doctor consultation requested by patient',
        responseMessage:
          `I have forwarded your request directly to ${doctorName} and paused AI automated responses. ` +
          'Your doctor has been notified and will reply to you here shortly.',
      };
    }
  }

  // 5. Autonomous Disease Diagnosis Speculation
  for (const pattern of DIAGNOSTIC_PATTERNS) {
    if (pattern.test(clean)) {
      return {
        isSafe: false,
        category: 'diagnostic_speculation',
        escalateToDoctor: true,
        autoPauseAi: true,
        isMedicineQuestion: false,
        triageTag: 'Clinical',
        flaggedReason: 'Autonomous disease diagnosis request detected',
        responseMessage:
          'Only your physician can evaluate symptoms and diagnose medical conditions. ' +
          `I have paused automated AI responses and routed your inquiry to ${doctorName} for clinical assessment. ` +
          'In the meantime, you can review your verified lab report parameters.',
      };
    }
  }

  // 6. Safe Informational / Lab Report / Schedule Query
  return {
    isSafe: true,
    category: 'safe',
    escalateToDoctor: false,
    autoPauseAi: false,
    isMedicineQuestion: false,
  };
}
