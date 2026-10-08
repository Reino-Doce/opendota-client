import { OpenDotaClient } from '../dist/index.js';

const matchId = process.argv[2];
if (!matchId || !/^\d+$/.test(matchId)) throw new Error('Pass a match ID as a decimal string.');

const client = new OpenDotaClient({ apiKey: process.env.OPENDOTA_API_KEY });
try {
    const result = await client.get('/matches/{match_id}', { path: { match_id: matchId } });
    process.stdout.write(`${JSON.stringify({ match: result.data, meta: result.meta }, null, 2)}\n`);
} finally {
    client.close();
}
