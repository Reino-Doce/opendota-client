import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { OpenDotaClient, apiContractVersion, supportedOperations } from '../dist/index.js';

const specUrl = new URL('../spec/openapi.json', import.meta.url);
const spec = JSON.parse(await readFile(specUrl, 'utf8'));

function parameterValue(parameter) {
    const schema = parameter.schema ?? {};
    if (schema.type === 'array') {
        const itemType = schema.items?.type;
        return [itemType === 'string' ? 'example' : 1];
    }
    if (schema.type === 'integer' || schema.type === 'number') return 1;
    if (schema.type === 'boolean') return true;
    return 'example';
}

function operationParameters(operation) {
    return (operation.parameters ?? []).map((parameter) => {
        const reference = parameter.$ref?.split('/').at(-1);
        return reference ? spec.components.parameters[reference] : parameter;
    });
}

test('inventory contains all published operations and each can build a typed route request', async () => {
    assert.equal(apiContractVersion, '31.1.0');
    assert.equal(supportedOperations.length, 55);
    assert.equal(supportedOperations.filter((operation) => operation.method === 'GET').length, 53);
    assert.equal(supportedOperations.filter((operation) => operation.method === 'POST').length, 2);

    const calls = [];
    const client = new OpenDotaClient({
        baseUrl: 'https://opendota.test/api',
        fetchImpl: async (url, init) => {
            calls.push({ url: new URL(url), init });
            return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
        },
        maxConcurrency: 64,
        maxQueuedRequests: 64,
        minimumRequestIntervalMs: 0,
        requestDeadlineMs: 2_000,
        attemptTimeoutMs: 1_000,
        maxRetries: 0,
    });

    try {
        await Promise.all(supportedOperations.map((entry) => {
            const specOperation = spec.paths[entry.path][entry.method.toLowerCase()];
            const path = Object.fromEntries([...entry.path.matchAll(/\{([^}]+)\}/g)].map((match) => [
                match[1], match[1] === 'jobId' ? 'parse-job-uuid' : /(?:account|match|team|league)_id/.test(match[1]) ? '9007199254740993123' : match[1].includes('id') ? 1 : 'example',
            ]));
            const query = Object.fromEntries(operationParameters(specOperation)
                .filter((parameter) => parameter.in === 'query' && parameter.required)
                .map((parameter) => [parameter.name, parameterValue(parameter)]));
            if (entry.path === '/explorer') query.sql = 'select 1';
            const method = entry.method.toLowerCase();
            return client[method](entry.path, {
                ...(Object.keys(path).length === 0 ? {} : { path }),
                ...(Object.keys(query).length === 0 ? {} : { query }),
            });
        }));

        assert.equal(calls.length, supportedOperations.length);
        assert.equal(calls.filter((call) => call.init.method === 'POST').length, 2);
        assert.ok(calls.some((call) => call.url.pathname === '/api/request/9007199254740993123'));
    } finally {
        client.close();
    }
});

test('saved contract and generated type inventory have a fixed offline check', async () => {
    const contract = JSON.parse(await readFile(new URL('../spec/contract.json', import.meta.url), 'utf8'));
    const lock = JSON.parse(await readFile(new URL('../spec/operations.lock.json', import.meta.url), 'utf8'));
    assert.equal(contract.operationCount, 55);
    assert.equal(Object.keys(lock).length, 55);
    assert.ok(Object.hasOwn(lock, 'get_players_by_account_id_select_wardmap'));
    assert.ok(Object.hasOwn(lock, 'post_request_by_job_id'));
});
