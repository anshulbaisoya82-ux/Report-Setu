import { describe, expect, it } from 'vitest';
import { byTime, doseDetail } from '../components/medicines/MedicineParts';

const dose = (over: Record<string, unknown>) => ({ id: 'x', name: 'M', dose: '1 tablet', timing: '', scheduledTime: '08:00 AM', state: 'due', ...over }) as any;

describe('medicine helpers', () => {
  it('sorts doses by clock time, AM before PM, noon and unknown handled', () => {
    const list = [dose({ id: 'pm', scheduledTime: '09:00 PM' }), dose({ id: 'noon', scheduledTime: '12:30 PM' }), dose({ id: 'x?', scheduledTime: '' }), dose({ id: 'am', scheduledTime: '08:00 AM' })];
    expect(list.sort(byTime).map((d) => d.id)).toEqual(['am', 'noon', 'pm', 'x?']);
  });

  it('does not repeat the dose when the instructions already contain it', () => {
    expect(doseDetail(dose({ dose: '30 minutes', instructions: "Doctor's advice · 30 minutes daily" }))).toBe("Doctor's advice · 30 minutes daily");
    expect(doseDetail(dose({ dose: '1 tablet', instructions: 'After dinner' }))).toBe('1 tablet · After dinner');
    expect(doseDetail(dose({ dose: '', instructions: 'After dinner' }))).toBe('After dinner');
  });
});
