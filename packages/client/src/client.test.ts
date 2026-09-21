import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { ApiClient } from './index';
describe('API transport', () => {
  it('rejects malformed success envelopes', async () => {
    const api = new ApiClient({
      baseUrl: 'https://test.invalid',
      fetcher: vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify({ success: true, data: {}, error: null }))),
    });
    await expect(api.call('GET', '/profile', z.object({ name: z.string() }))).rejects.toMatchObject(
      { code: 'INVALID_RESPONSE' },
    );
  });
  it('does not retry unacknowledged emergency mutations', async () => {
    const fetcher = vi.fn().mockRejectedValue(new TypeError('offline'));
    const api = new ApiClient({ baseUrl: 'https://test.invalid', fetcher });
    await expect(api.call('POST', '/sos', z.unknown(), {})).rejects.toMatchObject({
      code: 'UNCONFIRMED',
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('uses one refresh for concurrent browser requests', async () => {
    let calls = 0,
      refreshes = 0;
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/auth/refresh')) {
        refreshes++;
        await new Promise((r) => setTimeout(r, 10));
        return new Response(JSON.stringify({ success: true, data: { user: {} }, error: null }));
      }
      calls++;
      return calls <= 2
        ? new Response('{}', { status: 401 })
        : new Response(JSON.stringify({ success: true, data: { name: 'Harsha' }, error: null }));
    });
    const api = new ApiClient({ baseUrl: 'https://test.invalid', fetcher, cookieSession: true });
    await Promise.all([
      api.call('GET', '/profile', z.object({ name: z.string() })),
      api.call('GET', '/profile', z.object({ name: z.string() })),
    ]);
    expect(refreshes).toBe(1);
  });
});
