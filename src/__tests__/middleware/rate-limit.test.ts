/**
 * Rate-limit middleware tests.
 *
 * Tests the middleware function directly (unit-level, no HTTP server).
 * Uses NextRequest/NextResponse from next/server.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withRateLimit } from '@/lib/middleware/rate-limit';
import * as config from '@/lib/config/rate-limit-config';

// Mock the config module to control limiter behavior
jest.mock('@/lib/config/rate-limit-config');
const mockGetLimiter = config.getLimiter as jest.MockedFunction<typeof config.getLimiter>;

function createRequest(
  url: string = 'http://localhost:3000/api/v1/balance',
  options: {
    method?: string;
    headers?: Record<string, string>;
  } = {},
): NextRequest {
  const { method = 'GET', headers = {} } = options;
  return new NextRequest(url, {
    method,
    headers: new Headers(headers),
  });
}

function createMockLimiter(overrides: {
  allowed?: boolean;
  limit?: number;
  remaining?: number;
  resetAt?: number;
  retryAfterMs?: number;
} = {}) {
  const result = {
    allowed: overrides.allowed ?? true,
    limit: overrides.limit ?? 100,
    remaining: overrides.remaining ?? 99,
    resetAt: overrides.resetAt ?? (Date.now() + 60_000),
    retryAfterMs: overrides.retryAfterMs,
  };

  return {
    algorithm: 'fixed-window' as const,
    check: jest.fn().mockReturnValue(result),
    reset: jest.fn(),
  };
}

describe('withRateLimit middleware', () => {
  const mockHandler = jest.fn(async () =>
    NextResponse.json({ data: 'ok' }),
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows requests and attaches rate-limit headers', async () => {
    const limiter = createMockLimiter({ allowed: true, remaining: 99 });
    mockGetLimiter.mockReturnValue(limiter);

    const wrapped = withRateLimit(mockHandler, 'standard');
    const req = createRequest('http://localhost:3000/api/v1/balance', {
      headers: { 'x-api-key': 'test-key' },
    });

    const res = await wrapped(req);

    expect(res.status).toBe(200);
    expect(res.headers.get('X-RateLimit-Limit')).toBe('100');
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('99');
    expect(res.headers.get('X-RateLimit-Reset')).toBeTruthy();
    expect(res.headers.has('Retry-After')).toBe(false);
    expect(mockHandler).toHaveBeenCalledTimes(1);
  });

  it('returns 429 with Stripe-style error when limit exceeded', async () => {
    const limiter = createMockLimiter({
      allowed: false,
      remaining: 0,
      retryAfterMs: 30_000,
    });
    mockGetLimiter.mockReturnValue(limiter);

    const wrapped = withRateLimit(mockHandler, 'standard');
    const req = createRequest('http://localhost:3000/api/v1/balance', {
      headers: { 'x-api-key': 'test-key' },
    });

    const res = await wrapped(req);
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.error).toBeDefined();
    expect(body.error.type).toBe('rate_limit_error');
    expect(body.error.code).toBe('rate_limit_exceeded');
    expect(body.error.status).toBe(429);
    expect(mockHandler).not.toHaveBeenCalled();
  });

  it('includes Retry-After header on 429', async () => {
    const limiter = createMockLimiter({
      allowed: false,
      remaining: 0,
      retryAfterMs: 45_000,
    });
    mockGetLimiter.mockReturnValue(limiter);

    const wrapped = withRateLimit(mockHandler, 'standard');
    const req = createRequest('http://localhost:3000/api/v1/balance', {
      headers: { 'x-api-key': 'test-key' },
    });

    const res = await wrapped(req);

    expect(res.headers.get('Retry-After')).toBe('45');
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('0');
  });

  it('extracts API key from x-api-key header', async () => {
    const limiter = createMockLimiter();
    mockGetLimiter.mockReturnValue(limiter);

    const wrapped = withRateLimit(mockHandler, 'standard');
    const req = createRequest('http://localhost:3000/api/v1/balance', {
      headers: { 'x-api-key': 'sk_test_abc123' },
    });

    await wrapped(req);

    expect(limiter.check).toHaveBeenCalledWith('sk_test_abc123');
  });

  it('extracts API key from Authorization: Bearer header', async () => {
    const limiter = createMockLimiter();
    mockGetLimiter.mockReturnValue(limiter);

    const wrapped = withRateLimit(mockHandler, 'standard');
    const req = createRequest('http://localhost:3000/api/v1/balance', {
      headers: { 'authorization': 'Bearer sk_test_bearer_key' },
    });

    await wrapped(req);

    expect(limiter.check).toHaveBeenCalledWith('sk_test_bearer_key');
  });

  it('different API keys have independent rate limits', async () => {
    const limiter = createMockLimiter();
    mockGetLimiter.mockReturnValue(limiter);

    const wrapped = withRateLimit(mockHandler, 'standard');

    await wrapped(createRequest('http://localhost:3000/api/v1/balance', {
      headers: { 'x-api-key': 'key-A' },
    }));

    await wrapped(createRequest('http://localhost:3000/api/v1/balance', {
      headers: { 'x-api-key': 'key-B' },
    }));

    expect(limiter.check).toHaveBeenNthCalledWith(1, 'key-A');
    expect(limiter.check).toHaveBeenNthCalledWith(2, 'key-B');
  });

  it('exempt tier skips rate limiting entirely', async () => {
    mockGetLimiter.mockReturnValue(null);

    const wrapped = withRateLimit(mockHandler, 'exempt');
    const req = createRequest();

    const res = await wrapped(req);

    expect(res.status).toBe(200);
    expect(res.headers.has('X-RateLimit-Limit')).toBe(false);
    expect(mockHandler).toHaveBeenCalledTimes(1);
  });

  it('X-RateLimit-Limit matches configured max', async () => {
    const limiter = createMockLimiter({ limit: 20 });
    mockGetLimiter.mockReturnValue(limiter);

    const wrapped = withRateLimit(mockHandler, 'critical');
    const req = createRequest('http://localhost:3000/api/v1/charges', {
      headers: { 'x-api-key': 'test' },
    });

    const res = await wrapped(req);
    expect(res.headers.get('X-RateLimit-Limit')).toBe('20');
  });

  it('X-RateLimit-Reset is a Unix epoch in seconds', async () => {
    const resetAt = Date.now() + 60_000;
    const limiter = createMockLimiter({ resetAt });
    mockGetLimiter.mockReturnValue(limiter);

    const wrapped = withRateLimit(mockHandler, 'standard');
    const req = createRequest('http://localhost:3000/api/v1/balance', {
      headers: { 'x-api-key': 'test' },
    });

    const res = await wrapped(req);
    const resetHeader = res.headers.get('X-RateLimit-Reset');
    expect(resetHeader).toBe(String(Math.ceil(resetAt / 1000)));
  });
});
