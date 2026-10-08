import { OpenDotaClient } from '../dist/index.js';

const client = new OpenDotaClient({ apiKey: process.env.OPENDOTA_API_KEY });
try {
    const checks = [
        ['/metadata', {}],
        ['/heroes', {}],
        ['/benchmarks', { query: { hero_id: 1, bracket: 8, role: 'core' } }],
    ];
    for (const [path, options] of checks) {
        const result = await client.get(path, options);
        process.stdout.write(`${path}: ok (${result.meta.contractVersion})\n`);
    }
} finally {
    client.close();
}
