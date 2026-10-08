import { OpenDotaClient } from '../dist/index.js';

const accountId = process.argv[2];
if (!accountId || !/^\d+$/.test(accountId)) throw new Error('Pass a Steam32 account ID as a decimal string.');

const client = new OpenDotaClient({ apiKey: process.env.OPENDOTA_API_KEY });
try {
    const result = await client.get('/players/{account_id}/matches', {
        path: { account_id: accountId },
        query: { limit: 5 },
    });
    process.stdout.write(`${JSON.stringify({ matches: result.data, meta: result.meta }, null, 2)}\n`);
} finally {
    client.close();
}
