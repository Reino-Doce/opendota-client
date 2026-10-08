import { OpenDotaClient } from '../dist/index.js';

const client = new OpenDotaClient({ apiKey: process.env.OPENDOTA_API_KEY });
try {
    const result = await client.get('/benchmarks', { query: { hero_id: 1, bracket: 8, role: 'core' } });
    process.stdout.write(`${JSON.stringify({ benchmarks: result.data, meta: result.meta }, null, 2)}\n`);
} finally {
    client.close();
}
