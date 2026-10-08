import { OpenDotaClient } from '../dist/index.js';

const jobId = process.argv[2];
if (!jobId) throw new Error('Pass the parsing job ID returned by the submit-parse example.');

const client = new OpenDotaClient({ apiKey: process.env.OPENDOTA_API_KEY });
try {
    const result = await client.get('/request/{jobId}', { path: { jobId } });
    process.stdout.write(`${JSON.stringify({ job: result.data, meta: result.meta }, null, 2)}\n`);
} finally {
    client.close();
}
