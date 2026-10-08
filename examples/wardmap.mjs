import { OpenDotaClient } from '../dist/index.js';

const accountId = process.argv[2];
if (!accountId || !/^\d+$/.test(accountId)) throw new Error('Pass a Steam32 account ID as a decimal string.');

const client = new OpenDotaClient({ apiKey: process.env.OPENDOTA_API_KEY });
try {
    const result = await client.get('/players/{account_id}/wardmap', {
        path: { account_id: accountId },
        query: { date: 365 },
    });
    process.stdout.write(`${JSON.stringify({ density: result.data, meta: result.meta }, null, 2)}\n`);
} finally {
    client.close();
}
