import { OpenDotaError } from './errors.js';
import type { JsonValue } from './types.js';

const decimalIdFields = new Set([
    'account_id',
    'included_account_id',
    'excluded_account_id',
    'match_id',
    'match_seq_num',
    'steamid',
    'steam_id',
    'lobby_id',
    'server_id',
    'server_steam_id',
    'game_server_id',
    'watch_server_id',
    'team_id',
    'radiant_team_id',
    'dire_team_id',
    'opposing_team_id',
    'league_id',
    'leagueid',
]);

export function parseLosslessJson(text: string, decimalIdArrayResponse = false): JsonValue {
    let parsed: unknown;
    try {
        parsed = JSON.parse(text, (key: string, value: unknown, context?: { source?: string }) => {
            if (typeof value === 'number' && Number.isInteger(value) && !Number.isSafeInteger(value)) {
                return context?.source ?? String(value);
            }
            return value;
        });
    } catch {
        throw new OpenDotaError({ code: 'invalid-response' });
    }
    if (decimalIdArrayResponse && Array.isArray(parsed)) {
        return parsed.map(normalizeDecimalIdArrayEntry) as JsonValue;
    }
    return normalizeIdentifiers(parsed) as JsonValue;
}

function normalizeIdentifiers(value: unknown, key?: string): unknown {
    if (Array.isArray(value)) {
        return value.map((entry) => normalizeIdentifiers(entry));
    }
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([childKey, child]) => [
            childKey,
            normalizeIdentifiers(child, childKey),
        ]));
    }
    if (value === null || key === undefined) return value;
    if (!decimalIdFields.has(key) || typeof value !== 'number' && typeof value !== 'string') return value;
    const decimal = String(value);
    return /^\d+$/.test(decimal) ? decimal : value;
}

function normalizeDecimalIdArrayEntry(value: unknown): unknown {
    if (typeof value === 'number' || typeof value === 'string') {
        const decimal = String(value);
        return /^\d+$/.test(decimal) ? decimal : value;
    }
    return normalizeIdentifiers(value);
}
