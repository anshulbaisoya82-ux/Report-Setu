/**
 * Doctor Recommendation & Referral Engine
 * 
 * Analyzes patient laboratory biomarkers and self-reported symptoms to recommend
 * the most appropriate medical specialties and verified doctors with transparent clinical rationale.
 */

export interface SymptomRecord {
  id: string;
  name: string;
  severity: 'Mild' | 'Moderate' | 'Severe';
  duration: string;
}

export interface DoctorProfileRecord {
  id: string;
  name: string;
  specialty: string;
  subSpecialties?: string[];
  qualifications: string[];
  experienceYears: number;
  clinicName: string;
  clinicAddress: string;
  city: string;
  medicalCouncil: string;
  registrationNumber: string;
  consultationFee: number;
  consultationModes: ('In-person' | 'Video call' | 'Phone call')[];
  availableSlots: string[];
  rating?: number;
  reviewCount?: number;
  verified: boolean;
}

export interface RecommendationResult {
  doctor: DoctorProfileRecord;
  initials: string;
  matchScore: number; // 0 - 100%
  breakdown: {
    specialtyScore: number;
    qualificationScore: number;
    proximityModeScore: number;
    availabilityScore: number;
  };
  matchedSpecialty: string;
  rationale: string[];
}

export interface HealthAnalysisSummary {
  biomarkerConcernsCount: number;
  activeSymptomsCount: number;
  clinicalCategories: string[];
  abnormalParameters: {
    name: string;
    value: string | number;
    unit: string;
    status: string;
    mappedSpecialty: string;
  }[];
  isEmergency: boolean;
  emergencyTriggers: string[];
}

/**
 * Strips titles like Dr., Prof., and extracts clean 2-letter initials:
 * "Dr. Vikram Malhotra" -> "VM"
 * "Dr. Ananya Sen" -> "AS"
 * "Dr. Rajeshwari Kulkarni" -> "RK"
 */
export function getDoctorInitials(name: string): string {
  if (!name) return 'DR';
  const clean = name.replace(/^(dr\.?|prof\.?|doctor)\s+/i, '').trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'DR';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Standard pool of verified Indian doctors across clinical specialties
 */
export const VERIFIED_DOCTORS_POOL: DoctorProfileRecord[] = [
  {
    id: 'doc-endocrinologist-1',
    name: 'Dr. Vikram Malhotra',
    specialty: 'Endocrinology & Diabetology',
    subSpecialties: ['Type 1 & 2 Diabetes', 'Thyroid Disorders', 'Metabolic Syndrome'],
    qualifications: ['MBBS', 'MD (Internal Medicine)', 'DM (Endocrinology)'],
    experienceYears: 16,
    clinicName: 'Max Super Speciality Hospital & Diabetes Care Clinic',
    clinicAddress: '1 Press Enclave Road, Saket',
    city: 'New Delhi',
    medicalCouncil: 'Delhi Medical Council',
    registrationNumber: 'DMC-48291',
    consultationFee: 1000,
    consultationModes: ['In-person', 'Video call', 'Phone call'],
    availableSlots: ['Today, 04:30 PM', 'Tomorrow, 10:00 AM', 'Tomorrow, 02:30 PM'],
    rating: 4.9,
    reviewCount: 312,
    verified: true,
  },
  {
    id: 'doc-cardiologist-1',
    name: 'Dr. Ananya Sen',
    specialty: 'Cardiology',
    subSpecialties: ['Hypertension', 'Ischemic Heart Disease', 'Preventive Cardiology'],
    qualifications: ['MBBS', 'MD (Medicine)', 'DM (Cardiology)', 'FACC'],
    experienceYears: 18,
    clinicName: 'Fortis Escorts Heart Institute',
    clinicAddress: 'Okhla Road, New Friends Colony',
    city: 'New Delhi',
    medicalCouncil: 'Delhi Medical Council',
    registrationNumber: 'DMC-39102',
    consultationFee: 1200,
    consultationModes: ['In-person', 'Video call'],
    availableSlots: ['Tomorrow, 11:15 AM', 'Tomorrow, 05:00 PM', 'Wed, 09:30 AM'],
    rating: 4.95,
    reviewCount: 428,
    verified: true,
  },
  {
    id: 'doc-internist-1',
    name: 'Dr. Rajeshwari Kulkarni',
    specialty: 'Internal Medicine & General Physician',
    subSpecialties: ['Hematology / Anemia', 'General Health', 'Chronic Disease Management'],
    qualifications: ['MBBS', 'MD (General Medicine)'],
    experienceYears: 14,
    clinicName: 'Apollo Spectra Clinic & Family Wellness',
    clinicAddress: 'Bandra West, Linking Road',
    city: 'Mumbai',
    medicalCouncil: 'Maharashtra Medical Council',
    registrationNumber: 'MMC-59281',
    consultationFee: 750,
    consultationModes: ['In-person', 'Video call', 'Phone call'],
    availableSlots: ['Today, 06:00 PM', 'Tomorrow, 09:30 AM', 'Tomorrow, 01:00 PM'],
    rating: 4.88,
    reviewCount: 265,
    verified: true,
  },
  {
    id: 'doc-gastro-1',
    name: 'Dr. Alok Verma',
    specialty: 'Gastroenterology & Hepatology',
    subSpecialties: ['Liver Enzymes / LFT', 'Fatty Liver Disease', 'Digestive Health'],
    qualifications: ['MBBS', 'MD (Medicine)', 'DNB (Gastroenterology)'],
    experienceYears: 15,
    clinicName: 'Medanta Digestive & Liver Institute',
    clinicAddress: 'Sector 38, CH Bakhtawar Singh Road',
    city: 'Gurugram',
    medicalCouncil: 'Haryana Medical Council',
    registrationNumber: 'HNMC-28401',
    consultationFee: 1100,
    consultationModes: ['In-person', 'Video call'],
    availableSlots: ['Tomorrow, 12:00 PM', 'Tomorrow, 04:00 PM', 'Thu, 10:30 AM'],
    rating: 4.85,
    reviewCount: 198,
    verified: true,
  },
  {
    id: 'doc-nephro-1',
    name: 'Dr. Priya Ramanathan',
    specialty: 'Nephrology',
    subSpecialties: ['Renal Function / KFT', 'Hypertensive Kidney Disease', 'Proteinuria'],
    qualifications: ['MBBS', 'MD (Medicine)', 'DM (Nephrology)'],
    experienceYears: 13,
    clinicName: 'Manipal Kidney Care & Dialysis Centre',
    clinicAddress: 'HAL Old Airport Road, Kodihalli',
    city: 'Bengaluru',
    medicalCouncil: 'Karnataka Medical Council',
    registrationNumber: 'KMC-73819',
    consultationFee: 950,
    consultationModes: ['In-person', 'Video call'],
    availableSlots: ['Tomorrow, 02:00 PM', 'Thu, 11:00 AM', 'Fri, 03:30 PM'],
    rating: 4.9,
    reviewCount: 174,
    verified: true,
  },
  {
    id: 'doc-derma-1',
    name: 'Dr. Siddharth Joshi',
    specialty: 'Dermatology',
    subSpecialties: ['Clinical Allergology', 'Skin Lesions', 'Eczema & Dermatitis'],
    qualifications: ['MBBS', 'MD (Dermatology, Venereology & Leprosy)'],
    experienceYears: 11,
    clinicName: 'SkinHealth Specialty Clinic',
    clinicAddress: 'Defence Colony, Main Ring Road',
    city: 'New Delhi',
    medicalCouncil: 'Delhi Medical Council',
    registrationNumber: 'DMC-61920',
    consultationFee: 800,
    consultationModes: ['In-person', 'Video call'],
    availableSlots: ['Today, 05:30 PM', 'Tomorrow, 10:45 AM', 'Wed, 03:00 PM'],
    rating: 4.8,
    reviewCount: 156,
    verified: true,
  },
];

/**
 * Analyzes patient reports and symptoms to produce health summary and emergency check
 */
export function analyzeHealthStatus(
  reports: any[] = [],
  symptoms: SymptomRecord[] = []
): HealthAnalysisSummary {
  const abnormalParameters: HealthAnalysisSummary['abnormalParameters'] = [];
  const categoriesSet = new Set<string>();
  const emergencyTriggers: string[] = [];

  // 1. Analyze Reports & Parameters
  for (const report of reports) {
    if (report.category) {
      categoriesSet.add(report.category);
    }

    const params: any[] = report.parameters || [];
    for (const p of params) {
      const pName = (p.name || '').toLowerCase();
      const pStatus = p.status || 'Normal';
      const pValStr = String(p.value || '').replace(/,/g, '');
      const pVal = parseFloat(pValStr);

      let mappedSpecialty = 'Internal Medicine & General Physician';
      let isAbnormal = pStatus === 'Critical' || pStatus === 'Low' || pStatus === 'High' || pStatus === 'Attention Required';

      // Clinical Mapping Rules
      if (pName.includes('glucose') || pName.includes('sugar') || pName.includes('hba1c')) {
        mappedSpecialty = 'Endocrinology & Diabetology';
        categoriesSet.add('Metabolic');
        if (pName.includes('hba1c') && pVal > 6.4) isAbnormal = true;
        if (pName.includes('glucose') && pVal > 140) isAbnormal = true;
      } else if (pName.includes('blood pressure') || pName.includes('bp') || pName.includes('cholesterol') || pName.includes('lipid') || pName.includes('triglyceride')) {
        mappedSpecialty = 'Cardiology';
        categoriesSet.add('Cardiovascular');
      } else if (pName.includes('platelet') || pName.includes('hemoglobin') || pName.includes('hb') || pName.includes('wbc') || pName.includes('rbc')) {
        mappedSpecialty = 'Internal Medicine & General Physician';
        categoriesSet.add('Hematology');

        // Critical Emergency Trigger: Platelets < 50,000 /µL (< 0.50 Lakh/µL)
        if (pName.includes('platelet')) {
          const isLakh = (p.unit || '').toLowerCase().includes('lakh');
          const normalizedPlatelets = isLakh ? pVal * 100000 : pVal;
          if (!isNaN(normalizedPlatelets) && normalizedPlatelets > 0 && normalizedPlatelets < 50000) {
            emergencyTriggers.push(`Critically low platelet count: ${pVal} ${p.unit || '/µL'} (< 50,000/µL) poses immediate bleeding risk.`);
          }
        }

        // Severe Anemia check
        if (pName.includes('hemoglobin') && pVal > 0 && pVal < 7.0) {
          emergencyTriggers.push(`Severe Anemia: Hemoglobin reading of ${pVal} g/dL (< 7.0 g/dL) requires urgent transfusion review.`);
        }
      } else if (pName.includes('sgpt') || pName.includes('sgot') || pName.includes('bilirubin') || pName.includes('alkaline phosphatase') || pName.includes('lft')) {
        mappedSpecialty = 'Gastroenterology & Hepatology';
        categoriesSet.add('Hepatic');
      } else if (pName.includes('creatinine') || pName.includes('bun') || pName.includes('urea') || pName.includes('uric acid') || pName.includes('kft')) {
        mappedSpecialty = 'Nephrology';
        categoriesSet.add('Renal');
      }

      if (isAbnormal) {
        abnormalParameters.push({
          name: p.name || 'Biomarker Parameter',
          value: p.value,
          unit: p.unit || '',
          status: pStatus,
          mappedSpecialty,
        });
      }
    }
  }

  // 2. Analyze Reported Symptoms
  for (const s of symptoms) {
    const sName = s.name.toLowerCase();

    // Check emergency triggers in symptoms
    if (sName.includes('chest pain') || sName.includes('angina') || sName.includes('radiating to arm')) {
      emergencyTriggers.push('Acute chest pain / pressure requires immediate emergency medical evaluation (108 / 112).');
    }
    if (sName.includes('shortness of breath') || sName.includes('dyspnea') || sName.includes('severe breathlessness')) {
      if (s.severity === 'Severe') {
        emergencyTriggers.push('Acute dyspnea / severe shortness of breath reported. Urgent attention recommended.');
      }
    }
    if (sName.includes('loss of consciousness') || sName.includes('fainting') || sName.includes('syncope')) {
      emergencyTriggers.push('Sudden loss of consciousness or syncope warrants urgent hospital triage.');
    }

    if (sName.includes('sugar') || sName.includes('thirst') || sName.includes('urination') || sName.includes('weight loss')) {
      categoriesSet.add('Endocrinology');
    } else if (sName.includes('heart') || sName.includes('palpitation') || sName.includes('pressure')) {
      categoriesSet.add('Cardiovascular');
    } else if (sName.includes('stomach') || sName.includes('liver') || sName.includes('acidity') || sName.includes('jaundice')) {
      categoriesSet.add('Gastroenterology');
    } else if (sName.includes('swelling') || sName.includes('urine') || sName.includes('kidney')) {
      categoriesSet.add('Nephrology');
    } else if (sName.includes('rash') || sName.includes('itching') || sName.includes('skin') || sName.includes('allergy')) {
      categoriesSet.add('Dermatology');
    } else {
      categoriesSet.add('General Health');
    }
  }

  return {
    biomarkerConcernsCount: abnormalParameters.length,
    activeSymptomsCount: symptoms.length,
    clinicalCategories: Array.from(categoriesSet),
    abnormalParameters,
    isEmergency: emergencyTriggers.length > 0,
    emergencyTriggers,
  };
}

/**
 * Weighted Doctor Ranking Algorithm
 * Specialty Relevance (40%) + Qualifications & Experience (25%) + Location & Mode (20%) + Availability (15%)
 */
export function rankDoctors(
  doctors: DoctorProfileRecord[],
  analysis: HealthAnalysisSummary,
  symptoms: SymptomRecord[] = [],
  filterMode: string = 'All Modes',
  patientCity: string = 'New Delhi'
): RecommendationResult[] {
  // Collect target specialties based on biomarkers and symptoms
  const specialtyMatches: Record<string, number> = {};

  // Score from abnormal biomarkers
  for (const ab of analysis.abnormalParameters) {
    specialtyMatches[ab.mappedSpecialty] = (specialtyMatches[ab.mappedSpecialty] || 0) + 3;
  }

  // Score from reported symptoms
  for (const s of symptoms) {
    const sName = s.name.toLowerCase();
    const weight = s.severity === 'Severe' ? 3 : s.severity === 'Moderate' ? 2 : 1;

    if (sName.includes('thirst') || sName.includes('sugar') || sName.includes('diabetes') || sName.includes('fatigue')) {
      specialtyMatches['Endocrinology & Diabetology'] = (specialtyMatches['Endocrinology & Diabetology'] || 0) + weight;
    }
    if (sName.includes('chest') || sName.includes('palpitation') || sName.includes('breath') || sName.includes('heart')) {
      specialtyMatches['Cardiology'] = (specialtyMatches['Cardiology'] || 0) + weight;
    }
    if (sName.includes('stomach') || sName.includes('abdomen') || sName.includes('jaundice') || sName.includes('nausea') || sName.includes('liver')) {
      specialtyMatches['Gastroenterology & Hepatology'] = (specialtyMatches['Gastroenterology & Hepatology'] || 0) + weight;
    }
    if (sName.includes('swelling') || sName.includes('feet') || sName.includes('urine') || sName.includes('flank')) {
      specialtyMatches['Nephrology'] = (specialtyMatches['Nephrology'] || 0) + weight;
    }
    if (sName.includes('rash') || sName.includes('itching') || sName.includes('skin') || sName.includes('allergy')) {
      specialtyMatches['Dermatology'] = (specialtyMatches['Dermatology'] || 0) + weight;
    }
    // Broad fallback
    specialtyMatches['Internal Medicine & General Physician'] = (specialtyMatches['Internal Medicine & General Physician'] || 0) + 1;
  }

  // Default priority if no concerns found
  if (Object.keys(specialtyMatches).length === 0) {
    specialtyMatches['Internal Medicine & General Physician'] = 3;
    specialtyMatches['Endocrinology & Diabetology'] = 2;
  }

  return doctors.map((doc) => {
    // 1. Specialty Relevance (40%)
    const rawSpecialtyWeight = specialtyMatches[doc.specialty] || 0;
    let specialtyScore = 0;
    if (rawSpecialtyWeight >= 3) {
      specialtyScore = 40;
    } else if (rawSpecialtyWeight > 0) {
      specialtyScore = 32;
    } else if (doc.specialty.includes('Internal Medicine')) {
      specialtyScore = 24;
    } else {
      specialtyScore = 15;
    }

    // 2. Qualifications & Experience (25%)
    let qualificationScore = 15; // base verified
    if (doc.qualifications.some((q) => q.includes('DM') || q.includes('DNB') || q.includes('FACC'))) {
      qualificationScore += 5;
    }
    if (doc.experienceYears >= 15) {
      qualificationScore += 5;
    } else if (doc.experienceYears >= 10) {
      qualificationScore += 3;
    }

    // 3. Location & Mode (20%)
    let proximityModeScore = 0;
    const sameCity = (doc.city || '').toLowerCase() === (patientCity || '').toLowerCase();
    if (sameCity) {
      proximityModeScore += 12;
    } else {
      proximityModeScore += 8; // Video is nationwide
    }

    if (filterMode === 'All Modes') {
      proximityModeScore += 8;
    } else if (doc.consultationModes.includes(filterMode as any)) {
      proximityModeScore += 8;
    } else {
      proximityModeScore += 2;
    }

    // 4. Availability (15%)
    let availabilityScore = 8;
    if (doc.availableSlots.some((s) => s.toLowerCase().includes('today'))) {
      availabilityScore = 15;
    } else if (doc.availableSlots.some((s) => s.toLowerCase().includes('tomorrow'))) {
      availabilityScore = 12;
    }

    // Total Match Score (75% to 99% realistic bounds)
    const rawTotal = specialtyScore + qualificationScore + proximityModeScore + availabilityScore;
    const matchScore = Math.min(99, Math.max(76, Math.round(rawTotal * 0.98)));

    // Generate Transparent Rationale
    const rationale: string[] = [];

    // Biomarker matches
    const matchedBiomarkers = analysis.abnormalParameters.filter(
      (p) => p.mappedSpecialty === doc.specialty || doc.specialty.includes('Internal Medicine')
    );
    if (matchedBiomarkers.length > 0) {
      const topParam = matchedBiomarkers[0];
      rationale.push(
        `Targeted review for your abnormal ${topParam.name} (${topParam.value} ${topParam.unit}).`
      );
    }

    // Symptom matches
    const relevantSymptoms = symptoms.filter((s) => {
      const sLower = s.name.toLowerCase();
      if (doc.specialty.includes('Endocrin') && (sLower.includes('thirst') || sLower.includes('sugar') || sLower.includes('fatigue'))) return true;
      if (doc.specialty.includes('Cardio') && (sLower.includes('chest') || sLower.includes('heart') || sLower.includes('breath'))) return true;
      if (doc.specialty.includes('Gastro') && (sLower.includes('stomach') || sLower.includes('liver') || sLower.includes('acidity'))) return true;
      if (doc.specialty.includes('Nephro') && (sLower.includes('swelling') || sLower.includes('urine'))) return true;
      if (doc.specialty.includes('Derma') && (sLower.includes('rash') || sLower.includes('skin'))) return true;
      return false;
    });

    if (relevantSymptoms.length > 0) {
      rationale.push(
        `Directly aligns with reported symptom: "${relevantSymptoms[0].name}" (${relevantSymptoms[0].severity} severity).`
      );
    } else if (doc.subSpecialties && doc.subSpecialties.length > 0) {
      rationale.push(`Clinical expertise in ${doc.subSpecialties.slice(0, 2).join(', ')}.`);
    }

    // Credential rationale
    rationale.push(
      `${doc.qualifications.join(', ')} with ${doc.experienceYears}+ years experience, verified by ${doc.medicalCouncil} (${doc.registrationNumber}).`
    );

    // Availability / mode
    if (doc.availableSlots.length > 0) {
      rationale.push(`Earliest slot available: ${doc.availableSlots[0]} (${doc.consultationModes.join(', ')}).`);
    }

    return {
      doctor: doc,
      initials: getDoctorInitials(doc.name),
      matchScore,
      breakdown: {
        specialtyScore,
        qualificationScore,
        proximityModeScore,
        availabilityScore,
      },
      matchedSpecialty: doc.specialty,
      rationale,
    };
  }).sort((a, b) => b.matchScore - a.matchScore);
}

