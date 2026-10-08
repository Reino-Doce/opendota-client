import assert from 'node:assert/strict';
import test from 'node:test';
import { parseLosslessJson } from '../dist/json.js';

test('preserves documented identity values larger than Number.MAX_SAFE_INTEGER', () => {
    const result = parseLosslessJson('{"match_id":9007199254740993123,"match_seq_num":9007199254740993999,"players":[{"account_id":4294967295,"steamid":"76561198000000000","hero_id":1}]}');
    assert.deepEqual(result, {
        match_id: '9007199254740993123',
        match_seq_num: '9007199254740993999',
        players: [{ account_id: '4294967295', steamid: '76561198000000000', hero_id: 1 }],
    });
});

test('keeps unsafe non-identifier integers exact instead of rounding them', () => {
    assert.deepEqual(parseLosslessJson('{"games_played":9007199254740993123}'), {
        games_played: '9007199254740993123',
    });
});

test('retains nulls, empty collections, strings, UUID job IDs, and provider sentinels', () => {
    assert.deepEqual(parseLosslessJson('{"players":[],"match_id":null,"team_id":0,"jobId":"parse-job-uuid","optional":null}'), {
        players: [],
        match_id: null,
        team_id: '0',
        jobId: 'parse-job-uuid',
        optional: null,
    });
});

test('preserves partial match data and additive provider fields', () => {
    assert.deepEqual(parseLosslessJson('{"match_id":9007199254740993123,"players":[{"account_id":4294967295,"hero_id":1,"future_field":"provider-sentinel"}],"future_object":{"value":null}}'), {
        match_id: '9007199254740993123',
        players: [{ account_id: '4294967295', hero_id: 1, future_field: 'provider-sentinel' }],
        future_object: { value: null },
    });
});

test('keeps numeric hero identifiers and converts league match ID arrays', () => {
    assert.deepEqual(parseLosslessJson('[9007199254740993123,0]', { decimalIdArrayResponse: true }), [
        '9007199254740993123',
        '0',
    ]);
    assert.deepEqual(parseLosslessJson('{"hero_id":1,"item_id":12}'), { hero_id: 1, item_id: 12 });
});

test('rejects malformed JSON with a safe structured error', () => {
    assert.throws(() => parseLosslessJson('<html>gateway unavailable</html>'), {
        code: 'invalid-response',
        message: 'OpenDota returned a response that was not valid JSON.',
    });
});
