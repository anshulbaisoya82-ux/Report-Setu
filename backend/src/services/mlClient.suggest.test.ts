import { afterEach, describe, expect, it, vi } from 'vitest';
import { MlClient } from './mlClient';

afterEach(() => vi.unstubAllGlobals());

describe('MlClient.suggestMedicines (ML GET /drug/suggest)', () => {
  it('calls /drug/suggest with q and limit and returns clean, de-duplicated names', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ query: 'para', suggestions: ['Paracetamol', ' Paracetamol ', 'Dolo 650', '', 42] }))
    );
    vi.stubGlobal('fetch', fetchMock);

    const client = new MlClient('http://ml.test:8001/');
    const out = await client.suggestMedicines('para', 5);

    expect(out).toEqual(['Paracetamol', 'Dolo 650']);
    const url = String((fetchMock.mock.calls[0] as unknown[])[0]);
    expect(url).toBe('http://ml.test:8001/drug/suggest?q=para&limit=5');
  });

  it('throws (no invented names) when the ML service errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('boom', { status: 500 })));
    await expect(new MlClient('http://ml.test:8001').suggestMedicines('para')).rejects.toThrow();
  });

  it('throws when the ML service is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('ECONNREFUSED'); }));
    await expect(new MlClient('http://ml.test:8001').suggestMedicines('para')).rejects.toThrow('ECONNREFUSED');
  });
});
