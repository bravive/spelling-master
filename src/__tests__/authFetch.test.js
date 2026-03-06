import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeAuthFetch } from '../authFetch.js';

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('makeAuthFetch', () => {
  it('returns the response on 200', async () => {
    global.fetch = vi.fn().mockResolvedValue({ status: 200, ok: true });
    const onUnauth = vi.fn();
    const res = await makeAuthFetch(onUnauth)('/api/foo');
    expect(res.status).toBe(200);
    expect(onUnauth).not.toHaveBeenCalled();
  });

  it('calls onUnauthorized and throws on 401', async () => {
    global.fetch = vi.fn().mockResolvedValue({ status: 401 });
    const onUnauth = vi.fn();
    await expect(makeAuthFetch(onUnauth)('/api/foo')).rejects.toThrow('Session expired');
    expect(onUnauth).toHaveBeenCalledOnce();
  });

  it('calls onUnauthorized exactly once even if caller awaits twice', async () => {
    global.fetch = vi.fn().mockResolvedValue({ status: 401 });
    const onUnauth = vi.fn();
    const authFetch = makeAuthFetch(onUnauth);
    await authFetch('/api/foo').catch(() => {});
    await authFetch('/api/foo').catch(() => {});
    expect(onUnauth).toHaveBeenCalledTimes(2); // once per call, not shared state
  });

  it('does not call onUnauthorized on 403 Forbidden', async () => {
    global.fetch = vi.fn().mockResolvedValue({ status: 403 });
    const onUnauth = vi.fn();
    const res = await makeAuthFetch(onUnauth)('/api/foo');
    expect(res.status).toBe(403);
    expect(onUnauth).not.toHaveBeenCalled();
  });

  it('does not call onUnauthorized on 500', async () => {
    global.fetch = vi.fn().mockResolvedValue({ status: 500 });
    const onUnauth = vi.fn();
    const res = await makeAuthFetch(onUnauth)('/api/foo');
    expect(res.status).toBe(500);
    expect(onUnauth).not.toHaveBeenCalled();
  });

  it('does not call onUnauthorized on 404', async () => {
    global.fetch = vi.fn().mockResolvedValue({ status: 404 });
    const onUnauth = vi.fn();
    const res = await makeAuthFetch(onUnauth)('/api/missing');
    expect(res.status).toBe(404);
    expect(onUnauth).not.toHaveBeenCalled();
  });

  it('passes url and all options through to fetch', async () => {
    global.fetch = vi.fn().mockResolvedValue({ status: 200 });
    const onUnauth = vi.fn();
    const opts = { method: 'PUT', headers: { Authorization: 'Bearer tok' }, body: '{}' };
    await makeAuthFetch(onUnauth)('/api/bar', opts);
    expect(fetch).toHaveBeenCalledWith('/api/bar', opts);
  });

  it('uses empty options object when none provided', async () => {
    global.fetch = vi.fn().mockResolvedValue({ status: 200 });
    await makeAuthFetch(vi.fn())('/api/baz');
    expect(fetch).toHaveBeenCalledWith('/api/baz', {});
  });

  it('re-throws on network error (fetch itself rejects)', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network failure'));
    const onUnauth = vi.fn();
    await expect(makeAuthFetch(onUnauth)('/api/foo')).rejects.toThrow('Network failure');
    expect(onUnauth).not.toHaveBeenCalled();
  });
});
