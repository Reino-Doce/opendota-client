import { OpenDotaError } from './errors.js';
import { runtimeOverrides } from './runtime-overrides.generated.js';
import type { JsonValue } from './types.js';

const decimalIdFields = new Set<string>(runtimeOverrides.decimalIdProperties);

interface JsonParseOptions {
    readonly decimalIdArrayResponse?: boolean;
    readonly decimalIdProperties?: readonly string[];
}

export function parseLosslessJson(text: string, options: JsonParseOptions = {}): JsonValue {
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
    const responseDecimalIdFields = options.decimalIdProperties?.length
        ? new Set([...decimalIdFields, ...options.decimalIdProperties])
        : decimalIdFields;
    if (options.decimalIdArrayResponse && Array.isArray(parsed)) {
        return parsed.map((entry) => normalizeDecimalIdArrayEntry(entry, responseDecimalIdFields)) as JsonValue;
    }
    return normalizeIdentifiers(parsed, undefined, responseDecimalIdFields) as JsonValue;
}

function normalizeIdentifiers(value: unknown, key?: string, idFields: ReadonlySet<string> = decimalIdFields): unknown {
    if (Array.isArray(value)) {
        return value.map((entry) => normalizeIdentifiers(entry, undefined, idFields));
    }
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([childKey, child]) => [
            childKey,
            normalizeIdentifiers(child, childKey, idFields),
        ]));
    }
    if (value === null || key === undefined) return value;
    if (!idFields.has(key) || typeof value !== 'number' && typeof value !== 'string') return value;
    const decimal = String(value);
    return /^\d+$/.test(decimal) ? decimal : value;
}

function normalizeDecimalIdArrayEntry(value: unknown, idFields: ReadonlySet<string>): unknown {
    if (typeof value === 'number' || typeof value === 'string') {
        const decimal = String(value);
        return /^\d+$/.test(decimal) ? decimal : value;
    }
    return normalizeIdentifiers(value, undefined, idFields);
}
