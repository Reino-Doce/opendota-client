import { OpenDotaClient, OpenDotaError, type DecimalId, type RequestOptions, type ResponseData, type Route } from '../dist/index.js';
import type { paths } from '../dist/openapi.generated.js';

const client = new OpenDotaClient({ apiKey: process.env.OPENDOTA_API_KEY });
const accountId: DecimalId = '123456789';
const matchId: DecimalId = '90071992547409931';
const unsafeNumericMatchId = Number.MAX_SAFE_INTEGER + 1;
const matchRoute: Route<'get'> = '/matches/{match_id}';
type GeneratedMatchPath = NonNullable<paths['/matches/{match_id}']['get']['parameters']['path']>;
const generatedPath: GeneratedMatchPath = { match_id: matchId };
const directRequestOptions: RequestOptions<'/matches/{match_id}', 'get'> = { path: generatedPath };

const matches = await client.get('/players/{account_id}/matches', {
    path: { account_id: accountId },
    query: { limit: 5, project: ['match_id', 'hero_id'] },
});
const recentMatches = await client.get('/players/{account_id}/recentMatches', { path: { account_id: accountId } });
const oneMatch = await client.get(matchRoute, { path: { match_id: matchId } });
const benchmarks = await client.get('/benchmarks', { query: { hero_id: 1, bracket: 8, role: 'core' } });
const wardmap = await client.get('/players/{account_id}/wardmap', {
    path: { account_id: accountId },
    query: { win: false, is_radiant: false },
});
const found = await client.get('/findMatches', { query: { teamA: [1, 2, 3], teamB: [4, 5] } });
const parsedMatches = await client.get('/parsedMatches', {});
const explorer = await client.get('/explorer', { query: { sql: 'select 1' } });
const job = await client.post('/request/{match_id}', { path: { match_id: matchId } });
const profileRefresh = await client.post('/players/{account_id}/refresh', { path: { account_id: accountId } });
const status = await client.get('/request/{jobId}', { path: { jobId: 'job-uuid-from-provider' } });

const returnedMatchId: string | undefined = matches.data[0]?.match_id;
const returnedRecentMatchId: string | undefined = recentMatches.data[0]?.match_id;
const optionalBenchmarkPercentile: number | null | undefined = benchmarks.data.result?.gold_per_min?.[0]?.percentile;
const unknownWardResponse: unknown = wardmap.data;
const unknownFoundMatch = found.data[0];
const parsedMatchId: string | undefined = parsedMatches.data[0]?.match_id;
const unknownExplorerRows = explorer.data;
const unknownJobState = status.data;
const parseJobResponse = job.data;
const refreshResponse = profileRefresh.data;
const detail = oneMatch.data;
const safeError: OpenDotaError | undefined = undefined;
const responseAlias: ResponseData<'/matches/{match_id}', 'get'> = detail;

void [directRequestOptions, returnedMatchId, returnedRecentMatchId, optionalBenchmarkPercentile, unknownWardResponse, unknownFoundMatch, parsedMatchId,
    unknownExplorerRows, unknownJobState, parseJobResponse, refreshResponse, safeError, responseAlias];

// @ts-expect-error Account identifiers are decimal strings, not JavaScript numbers.
client.get('/matches/{match_id}', { path: { match_id: unsafeNumericMatchId } });
// @ts-expect-error Hero identifiers are numeric rather than opaque decimal strings.
client.get('/heroes/{hero_id}/matches', { path: { hero_id: '1' } });
// @ts-expect-error OpenDota's parsing endpoint has no documented request body.
client.post('/request/{match_id}', { path: { match_id: matchId }, body: { force: true } });
// @ts-expect-error The SQL parameter is required by the actual OpenDota operation.
client.get('/explorer', {});

client.close();
