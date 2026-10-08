import { OpenDotaClient } from '../dist/index.js';

const client = new OpenDotaClient({ apiKey: process.env.OPENDOTA_API_KEY });
try {
    const result = await client.get('/parsedMatches', {});
    process.stdout.write(`${JSON.stringify({ matches: result.data, meta: result.meta }, null, 2)}\n`);
} finally {
    client.close();
}
