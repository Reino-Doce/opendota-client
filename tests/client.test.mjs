import assert from 'node:assert/strict';
import test from 'node:test';
import { OpenDotaClient, OpenDotaError } from '../dist/index.js';

function clientWith(fetchImpl, options = {}) {
    return new OpenDotaClient({
        baseUrl: 'https://opendota.test/api',
        fetchImpl,
        minimumRequestIntervalMs: 0,
        requestDeadlineMs: 1_000,
        attemptTimeoutMs: 250,
        maxRetries: 0,
        ...options,
    });
}

test('serializes query values without losing zero, numeric booleans, or array order', async () => {
    let requested;
    const client = clientWith(async (url, init) => {
        requested = { url: new URL(url), init };
        return Response.json([]);
    });
    try {
        await client.get('/players/{account_id}/matches', {
            path: { account_id: '123456789' },
            query: { limit: 0, win: false, is_radiant: true, project: ['match_id', 'hero_id'] },
        });
        assert.equal(requested.url.pathname, '/api/players/123456789/matches');
        assert.equal(requested.url.searchParams.get('limit'), '0');
        assert.equal(requested.url.searchParams.get('win'), '0');
        assert.equal(requested.url.searchParams.get('is_radiant'), '1');
        assert.deepEqual(requested.url.searchParams.getAll('project'), ['match_id', 'hero_id']);
        assert.equal(requested.init.method, 'GET');
    } finally {
        client.close();
    }
});

test('omits false topPlayers turbo and repeats findMatches hero arrays', async () => {
    const urls = [];
    const client = clientWith(async (url) => {
        urls.push(new URL(url));
        return Response.json([]);
    });
    try {
        await client.get('/topPlayers', { query: { turbo: false } });
        await client.get('/topPlayers', { query: { turbo: true } });
        await client.get('/findMatches', { query: { teamA: [1, 2], teamB: [3, 4] } });
        assert.equal(urls[0]?.search, '');
        assert.equal(urls[1]?.searchParams.get('turbo'), '1');
        assert.deepEqual(urls[2]?.searchParams.getAll('teamA'), ['1', '2']);
        assert.deepEqual(urls[2]?.searchParams.getAll('teamB'), ['3', '4']);
    } finally {
        client.close();
    }
});

test('sends bearer credentials only in headers and returns safe metadata', async () => {
    const key = 'private-test-api-key';
    let requested;
    const client = clientWith(async (url, init) => {
        requested = { url: new URL(url), init };
        return new Response('{"result":[]}', {
            status: 200,
            headers: { 'content-type': 'application/json', 'x-rate-limit-remaining-minute': '17', 'x-rate-limit-remaining-day': '89' },
        });
    }, { apiKey: key });
    try {
        const result = await client.get('/metadata', {});
        assert.equal(requested.init.headers.authorization, `Bearer ${key}`);
        assert.equal(requested.url.searchParams.has('api_key'), false);
        assert.equal(JSON.stringify(result).includes(key), false);
        assert.deepEqual(result.meta.rateLimit, { minuteRemaining: 17, dayRemaining: 89 });
        assert.equal(result.meta.cacheStatus, 'miss');
        assert.equal(result.meta.provider, 'opendota');
        assert.ok(Date.parse(result.meta.fetchedAt));
        assert.ok(Date.parse(result.meta.servedAt));
    } finally {
        client.close();
    }
});

test('applies the operation-specific ID array response override', async () => {
    const client = clientWith(async () => new Response('[9007199254740993123,0]', { status: 200 }));
    try {
        const result = await client.get('/leagues/{league_id}/matchIds', { path: { league_id: '123' } });
        assert.deepEqual(result.data, ['9007199254740993123', '0']);
    } finally {
        client.close();
    }
});

test('preserves parsed match IDs from the parsed-matches response objects', async () => {
    const client = clientWith(async () => new Response('[{"match_id":9007199254740993123}]', { status: 200 }));
    try {
        const result = await client.get('/parsedMatches', {});
        assert.equal(result.data[0]?.match_id, '9007199254740993123');
    } finally {
        client.close();
    }
});

test('keeps absent fields, null values, and successful empty history as data', async () => {
    const client = clientWith(async () => Response.json([]));
    try {
        const result = await client.get('/players/{account_id}/matches', { path: { account_id: '123' } });
        assert.deepEqual(result.data, []);
    } finally {
        client.close();
    }
});

test('coalesces identical requests while allowing one caller to cancel independently', async () => {
    let calls = 0;
    let fetchSignal;
    const client = clientWith(async (_url, init) => {
        calls += 1;
        fetchSignal = init.signal;
        await new Promise((resolve, reject) => {
            const timer = setTimeout(resolve, 25);
            init.signal.addEventListener('abort', () => {
                clearTimeout(timer);
                reject(new DOMException('aborted', 'AbortError'));
            }, { once: true });
        });
        return Response.json({ ok: true });
    });
    const abort = new AbortController();
    try {
        const cancelled = client.get('/metadata', { signal: abort.signal });
        const retained = client.get('/metadata', {});
        abort.abort();
        await assert.rejects(cancelled, (error) => error instanceof OpenDotaError && error.code === 'aborted');
        assert.deepEqual((await retained).data, { ok: true });
        assert.equal(calls, 1);
        assert.ok(fetchSignal);
    } finally {
        client.close();
    }
});

test('aborts shared transport after every coalesced caller cancels', async () => {
    let fetchSignal;
    const client = clientWith((_url, init) => new Promise((_resolve, reject) => {
        fetchSignal = init.signal;
        init.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
    }));
    const abortOne = new AbortController();
    const abortTwo = new AbortController();
    try {
        const first = client.get('/metadata', { signal: abortOne.signal });
        const second = client.get('/metadata', { signal: abortTwo.signal });
        abortOne.abort();
        abortTwo.abort();
        await Promise.all([
            assert.rejects(first, (error) => error instanceof OpenDotaError && error.code === 'aborted'),
            assert.rejects(second, (error) => error instanceof OpenDotaError && error.code === 'aborted'),
        ]);
        assert.equal(fetchSignal.aborted, true);
    } finally {
        client.close();
    }
});

test('caches cloned successful data, retains acquisition time, expires, and clears entries', async () => {
    let now = 1_800_000_000_000;
    let calls = 0;
    const client = clientWith(async () => Response.json({ call: ++calls }), { now: () => now, cacheTtlMs: 5_000 });
    try {
        const first = await client.get('/metadata', {});
        first.data.call = 99;
        const second = await client.get('/metadata', {});
        assert.equal(second.data.call, 1);
        assert.equal(second.meta.cacheStatus, 'hit');
        assert.equal(second.meta.fetchedAt, first.meta.fetchedAt);
        assert.equal(calls, 1);
        now += 5_001;
        await client.get('/metadata', {});
        assert.equal(calls, 2);
        client.clearCache();
        await client.get('/metadata', {});
        assert.equal(calls, 3);
    } finally {
        client.close();
    }
});

test('keeps cache entries isolated between client instances', async () => {
    let calls = 0;
    const options = { cacheTtlMs: 5_000 };
    const firstClient = clientWith(async () => Response.json({ call: ++calls }), options);
    const secondClient = clientWith(async () => Response.json({ call: ++calls }), options);
    try {
        assert.deepEqual((await firstClient.get('/metadata', {})).data, { call: 1 });
        assert.deepEqual((await secondClient.get('/metadata', {})).data, { call: 2 });
        assert.deepEqual((await firstClient.get('/metadata', {})).data, { call: 1 });
        assert.equal(calls, 2);
    } finally {
        firstClient.close();
        secondClient.close();
    }
});

test('retries a transient GET response within bounds and honors Retry-After', async () => {
    let calls = 0;
    const delays = [];
    const client = clientWith(async () => {
        calls += 1;
        return calls === 1
            ? new Response('busy', { status: 429, headers: { 'retry-after': '2' } })
            : Response.json({ ok: true });
    }, { maxRetries: 1, requestDeadlineMs: 5_000, sleep: async (milliseconds) => delays.push(milliseconds) });
    try {
        assert.deepEqual((await client.get('/metadata', {})).data, { ok: true });
        assert.equal(calls, 2);
        assert.deepEqual(delays, [2_000]);
    } finally {
        client.close();
    }
});

test('never retries POST requests', async () => {
    let calls = 0;
    const client = clientWith(async (_url, init) => {
        calls += 1;
        assert.equal(init.method, 'POST');
        return new Response('unavailable', { status: 503 });
    }, { maxRetries: 2 });
    try {
        await assert.rejects(client.post('/request/{match_id}', { path: { match_id: '123' } }),
            (error) => error instanceof OpenDotaError && error.code === 'http-error' && error.status === 503);
        assert.equal(calls, 1);
    } finally {
        client.close();
    }
});

test('classifies HTTP errors without including credential text or response bodies', async () => {
    const secret = 'private-test-api-key';
    const client = clientWith(async () => new Response(`Invalid API key ${secret}`, { status: 400 }), { apiKey: secret });
    try {
        await assert.rejects(client.get('/metadata', {}), (error) => {
            assert.equal(error.code, 'unauthorized');
            assert.equal(error.message.includes(secret), false);
            assert.equal(error.message.includes('Invalid API key'), false);
            return true;
        });
    } finally {
        client.close();
    }
});

test('reports malformed JSON and bounds hanging attempts', async () => {
    const malformed = clientWith(async () => new Response('<html>not json</html>', { status: 200 }));
    try {
        await assert.rejects(malformed.get('/metadata', {}), (error) => error.code === 'invalid-response');
    } finally {
        malformed.close();
    }

    let signal;
    const hanging = clientWith((_url, init) => new Promise((_resolve, reject) => {
        signal = init.signal;
        init.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
    }), { attemptTimeoutMs: 20, requestDeadlineMs: 200 });
    try {
        await assert.rejects(hanging.get('/metadata', {}), (error) => error.code === 'timeout');
        assert.equal(signal.aborted, true);
    } finally {
        hanging.close();
    }
});

test('overall request deadline includes time waiting in the start-rate queue', async () => {
    let calls = 0;
    const client = clientWith(async () => {
        calls += 1;
        return Response.json({ ok: true });
    }, { minimumRequestIntervalMs: 1_000, requestDeadlineMs: 50, attemptTimeoutMs: 500 });
    try {
        await client.get('/metadata', {});
        await assert.rejects(client.get('/health', {}), (error) => error instanceof OpenDotaError && error.code === 'timeout');
        assert.equal(calls, 1);
    } finally {
        client.close();
    }
});

test('rejects unsafe numeric identity inputs and queue overload', async () => {
    const held = [];
    const client = clientWith((_url, init) => new Promise((resolve) => {
        held.push({ init, resolve: () => resolve(Response.json({ ok: true })) });
    }), { maxConcurrency: 1, maxQueuedRequests: 0, attemptTimeoutMs: 800, requestDeadlineMs: 900 });
    try {
        await assert.rejects(client.get('/matches/{match_id}', { path: { match_id: 9007199254740992 } }),
            (error) => error instanceof OpenDotaError && error.code === 'invalid-input');
        const first = client.get('/metadata', {});
        await new Promise((resolve) => setTimeout(resolve, 0));
        await assert.rejects(client.get('/health', {}), (error) => error instanceof OpenDotaError && error.code === 'queue-full');
        held[0]?.resolve();
        assert.deepEqual((await first).data, { ok: true });
    } finally {
        client.close();
    }
});

test('client close aborts pending work and subsequent requests fail safely', async () => {
    let signal;
    const client = clientWith((_url, init) => new Promise((_resolve, reject) => {
        signal = init.signal;
        init.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
    }));
    const request = client.get('/metadata', {});
    await new Promise((resolve) => setTimeout(resolve, 0));
    client.close();
    await assert.rejects(request, (error) => error.code === 'client-closed' || error.code === 'aborted');
    assert.equal(signal.aborted, true);
    await assert.rejects(client.get('/metadata', {}), (error) => error.code === 'client-closed');
});
