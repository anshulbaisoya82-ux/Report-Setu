import React from 'react';
import type { LabParameter } from '../../types';

export type Severity = 'normal' | 'slight' | 'notable' | 'critical';

/** Parse "13.0 – 17.0", "< 5.7", "> 40" into bounds. */
export function parseRange(range?: string): { low?: number; high?: number } {
  if (!range) return {};
  const clean = range.replace(/,/g, '');
  const lt = clean.match(/^\s*[<≤]\s*([\d.]+)/);
  if (lt) return { high: parseFloat(lt[1]) };
  const gt = clean.match(/^\s*[>≥]\s*([\d.]+)/);
  if (gt) return { low: parseFloat(gt[1]) };
  const parts = clean.split(/\s*[-–—]\s*/).map((s) => parseFloat(s));
  if (parts.length === 2 && parts.every((n) => !Number.isNaN(n))) return { low: parts[0], high: parts[1] };
  return {};
}

/**
 * Patient-friendly wording for a lab value's position against its reference range.
 * Purely descriptive — it never interprets what the value means clinically.
 */
export function describeParameter(p: Pick<LabParameter, 'value' | 'referenceRange' | 'status'>): { label: string; severity: Severity } {
  if (p.status === 'Critical') return { label: 'Needs attention', severity: 'critical' };
  if (p.status === 'Normal') return { label: 'Normal', severity: 'normal' };
  const v = typeof p.value === 'number' ? p.value : parseFloat(String(p.value));
  const { low, high } = parseRange(p.referenceRange);
  const dir = p.status === 'Low' ? 'low' : 'high';
  const bound = dir === 'low' ? low : high;
  if (!Number.isNaN(v) && bound) {
    const off = Math.abs(v - bound) / bound;
    if (off <= 0.12) return { label: `Slightly ${dir}`, severity: 'slight' };
  }
  return { label: dir === 'low' ? 'Low' : 'High', severity: 'notable' };
}

const dot: Record<Severity, string> = {
  normal: 'bg-emerald-500',
  slight: 'bg-amber-500',
  notable: 'bg-red-600',
  critical: 'bg-red-700 ring-2 ring-red-200',
};
const text: Record<Severity, string> = {
  normal: 'text-emerald-800',
  slight: 'text-amber-800',
  notable: 'text-red-700',
  critical: 'text-red-800',
};

export const StatusLabel: React.FC<{ label: string; severity: Severity; className?: string }> = ({ label, severity, className = '' }) => (
  <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${text[severity]} ${className}`}>
    <span aria-hidden className={`h-2 w-2 rounded-full ${dot[severity]}`} />
    {label}
  </span>
);

const pill: Record<Severity, string> = {
  normal: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  slight: 'bg-amber-50 text-amber-800 border-amber-200',
  notable: 'bg-red-50 text-red-700 border-red-200',
  critical: 'bg-red-100 text-red-800 border-red-300',
};
export const StatusPill: React.FC<{ label: string; severity: Severity }> = ({ label, severity }) => (
  <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${pill[severity]}`}>
    <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${dot[severity]}`} />
    {label}
  </span>
);

/** Short, neutral "what is this test" copy. Educational only — no interpretation. */
const EXPLAINERS: [RegExp, string][] = [
  [/platelet/i, 'Platelets are tiny cells that help your blood clot when you get a cut.'],
  [/haemoglobin|hemoglobin|\bhb\b/i, 'Hemoglobin is the protein in red blood cells that carries oxygen around your body.'],
  [/rbc|red blood/i, 'Red blood cells carry oxygen from your lungs to the rest of your body.'],
  [/wbc|white blood|leukocyte/i, 'White blood cells are part of your immune system and help your body fight infections.'],
  [/hematocrit|haematocrit|hct|pcv/i, 'Hematocrit is the share of your blood that is made up of red blood cells.'],
  [/\bmcv\b/i, 'MCV is the average size of your red blood cells.'],
  [/\bmchc\b/i, 'MCHC is how concentrated the hemoglobin is inside your red blood cells.'],
  [/\bmch\b/i, 'MCH is the average amount of hemoglobin in each red blood cell.'],
  [/\brdw\b/i, 'RDW shows how much your red blood cells vary in size.'],
  [/hba1c|glycated/i, 'HbA1c shows your average blood sugar level over roughly the last three months.'],
  [/glucose|eag/i, 'This measures the amount of sugar (glucose) in your blood.'],
  [/ldl/i, 'LDL is one type of cholesterol carried in your blood.'],
  [/hdl/i, 'HDL is one type of cholesterol carried in your blood.'],
  [/cholesterol/i, 'Cholesterol is a fatty substance carried in your blood.'],
  [/triglyceride/i, 'Triglycerides are a type of fat carried in your blood.'],
  [/sgot|ast/i, 'AST (SGOT) is an enzyme measured as part of a liver function test.'],
  [/sgpt|alt/i, 'ALT (SGPT) is an enzyme measured as part of a liver function test.'],
  [/bilirubin/i, 'Bilirubin is a substance made when the body breaks down old red blood cells.'],
  [/creatinine/i, 'Creatinine is a waste product that is measured to check kidney function.'],
  [/urea/i, 'Urea is a waste product that is measured to check kidney function.'],
];
export function explainParameter(name: string): string {
  return EXPLAINERS.find(([re]) => re.test(name))?.[1] ?? 'This is one of the values measured in your test. Your doctor can explain what it means for you.';
}
