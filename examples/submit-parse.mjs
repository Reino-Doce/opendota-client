import { OpenDotaClient } from '../dist/index.js';

const matchId = process.argv[2];
if (!matchId || !/^\d+$/.test(matchId)) throw new Error('Pass the match ID to submit for parsing.');

const client = new OpenDotaClient({ apiKey: process.env.OPENDOTA_API_KEY });
try {
    const result = await client.post('/request/{match_id}', { path: { match_id: matchId } });
    process.stdout.write(`${JSON.stringify(result.data, null, 2)}\n`);
} finally {
    client.close();
}
