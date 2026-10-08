import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import openapiTS, { astToString } from 'openapi-typescript';
import ts from 'typescript';

const root = new URL('../', import.meta.url);
const specUrl = new URL('spec/openapi.json', root);
const manifestUrl = new URL('spec/contract.json', root);
const lockUrl = new URL('spec/operations.lock.json', root);
const overridesUrl = new URL('spec/overrides.json', root);
const pathsUrl = new URL('src/openapi.generated.ts', root);
const operationsUrl = new URL('src/operations.generated.ts', root);
const runtimeOverridesUrl = new URL('src/runtime-overrides.generated.ts', root);
const operationDocsUrl = new URL('docs/operations.md', root);
const isCheck = process.argv.includes('--check');

const rawSpec = await readFile(specUrl);
const spec = JSON.parse(rawSpec.toString('utf8'));
const overrides = JSON.parse(await readFile(overridesUrl, 'utf8'));
const lock = JSON.parse(await readFile(lockUrl, 'utf8'));
const contract = JSON.parse(await readFile(manifestUrl, 'utf8'));

if (spec.openapi !== contract.openapi || spec.info.version !== contract.version) {
    throw new Error(`OpenAPI contract version mismatch: found ${spec.openapi}/${spec.info.version}.`);
}

const operations = Object.entries(spec.paths).flatMap(([path, pathItem]) => Object.entries(pathItem)
    .filter(([method]) => ['get', 'post'].includes(method))
    .map(([method, operation]) => ({
        method: method.toUpperCase(),
        path,
        operationId: operation.operationId,
        summary: operation.summary === `${method.toUpperCase()} /`
            ? operation.description ?? `${method.toUpperCase()} ${path}`
            : operation.description ?? operation.summary ?? `${method.toUpperCase()} ${path}`,
    })));
operations.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));

const coverage = Object.fromEntries(operations.map(({ method, path, operationId }) => [operationId, { method, path }]));
const sortedCoverage = Object.fromEntries(Object.entries(coverage).sort(([left], [right]) => left.localeCompare(right)));
if (JSON.stringify(sortedCoverage) !== JSON.stringify(lock)) {
    throw new Error('The OpenDota operation inventory changed. Review the schema and corrections, then update spec/operations.lock.json deliberately.');
}
if (operations.length !== 55 || operations.filter((operation) => operation.method === 'GET').length !== 53 || operations.filter((operation) => operation.method === 'POST').length !== 2) {
    throw new Error(`Unexpected OpenDota operation count: ${operations.length}.`);
}

const patchedSpec = structuredClone(spec);
const decimalIds = new Set(overrides.decimalIdProperties);
const decimalParameters = new Set(overrides.decimalIdParameters);
const numericBooleanParameters = new Set(overrides.numericBooleanParameters);
const decimalIdArrayParameters = new Set(overrides.decimalIdArrayParameters);

function markSchema(schema, propertyName = undefined) {
    if (!schema || typeof schema !== 'object') return;
    const hasNoProperties = !schema.properties || Object.keys(schema.properties).length === 0;
    if (schema.type === 'object' && hasNoProperties && schema.additionalProperties === undefined) {
        schema.additionalProperties = true;
    }
    if (propertyName && decimalIds.has(propertyName) && schema.type === 'integer') {
        schema.format = 'opendota-decimal-id';
    }
    if (schema.properties && typeof schema.properties === 'object') {
        for (const [name, property] of Object.entries(schema.properties)) markSchema(property, name);
    }
    for (const key of ['items', 'additionalProperties', 'not']) {
        if (schema[key] && typeof schema[key] === 'object') markSchema(schema[key]);
    }
    for (const key of ['oneOf', 'anyOf', 'allOf']) {
        if (Array.isArray(schema[key])) schema[key].forEach((part) => markSchema(part));
    }
}

for (const [name, parameter] of Object.entries(patchedSpec.components.parameters)) {
    if (decimalParameters.has(name)) markSchema(parameter.schema, 'account_id');
    if (numericBooleanParameters.has(name)) parameter.schema.format = 'opendota-numeric-boolean';
    const arrayItemType = overrides.arrayParameters[name];
    if (arrayItemType) {
        parameter.style = 'form';
        parameter.explode = true;
        parameter.schema = { type: 'array', items: { type: arrayItemType } };
        if (decimalIdArrayParameters.has(name)) parameter.schema.items.format = 'opendota-decimal-id';
    }
}
for (const [name, schema] of Object.entries(patchedSpec.components.schemas)) markSchema(schema, name);

const benchmarks = patchedSpec.components.schemas.BenchmarksResponse;
for (const metric of Object.values(benchmarks?.properties?.result?.properties ?? {})) {
    for (const property of overrides.nullableBenchmarkMetrics) {
        const field = metric?.items?.properties?.[property];
        if (field) field.nullable = true;
    }
}

for (const [path, pathItem] of Object.entries(patchedSpec.paths)) {
    for (const method of ['get', 'post']) {
        const operation = pathItem[method];
        if (!operation) continue;
        for (const response of Object.values(operation.responses ?? {})) {
            for (const media of Object.values(response.content ?? {})) markSchema(media.schema);
        }
        operation.parameters = (operation.parameters ?? []).filter((parameter) => {
            const parameterName = parameter.$ref?.split('/').at(-1);
            return !overrides.removeParameters[path]?.includes(parameterName);
        });
        if (overrides.requiredQueryParameters[path]) {
            for (const parameter of operation.parameters) {
                const resolved = parameter.$ref
                    ? patchedSpec.components.parameters[parameter.$ref.split('/').at(-1)]
                    : parameter;
                if (resolved?.in === 'query' && overrides.requiredQueryParameters[path].includes(resolved.name)) {
                    resolved.required = true;
                }
            }
        }
        const correctedParameterTypes = overrides.parameterTypes[path] ?? {};
        const booleanParameters = new Set(overrides.booleanPathParameters[path] ?? []);
        for (const parameter of operation.parameters) {
            const resolved = parameter.$ref
                ? patchedSpec.components.parameters[parameter.$ref.split('/').at(-1)]
                : parameter;
            if (Object.hasOwn(correctedParameterTypes, resolved?.name)) {
                resolved.schema.type = correctedParameterTypes[resolved.name];
            }
            if (booleanParameters.has(resolved?.name)) resolved.schema.format = 'opendota-turbo-boolean';
        }
        const itemReference = overrides.responseItemReferences[path];
        if (itemReference) {
            const media = operation.responses?.['200']?.content?.['application/json; charset=utf-8']?.schema;
            if (media?.type === 'array') media.items = { $ref: itemReference };
        }
        if (overrides.decimalIdArrayResponses.includes(path)) {
            const schema = operation.responses?.['200']?.content?.['application/json; charset=utf-8']?.schema;
            if (schema?.items?.type === 'integer') schema.items.format = 'opendota-decimal-id';
        }
        if (path === '/findMatches') {
            for (const parameter of operation.parameters) {
                const resolved = parameter.$ref
                    ? patchedSpec.components.parameters[parameter.$ref.split('/').at(-1)]
                    : parameter;
                if (resolved?.in === 'query' && resolved.schema?.type === 'array') {
                    resolved.style = 'form';
                    resolved.explode = true;
                }
            }
        }
    }
}

const generatedAst = await openapiTS(patchedSpec, {
    transform(schemaObject) {
        if (schemaObject.format === 'opendota-decimal-id') {
            return ts.factory.createTypeReferenceNode(ts.factory.createIdentifier('DecimalId'));
        }
        if (schemaObject.format === 'opendota-numeric-boolean') {
            return ts.factory.createUnionTypeNode([
                ts.factory.createLiteralTypeNode(ts.factory.createNumericLiteral(0)),
                ts.factory.createLiteralTypeNode(ts.factory.createNumericLiteral(1)),
                ts.factory.createKeywordTypeNode(ts.SyntaxKind.BooleanKeyword),
            ]);
        }
        if (schemaObject.format === 'opendota-turbo-boolean') {
            return ts.factory.createUnionTypeNode([
                ts.factory.createLiteralTypeNode(ts.factory.createNumericLiteral(0)),
                ts.factory.createLiteralTypeNode(ts.factory.createNumericLiteral(1)),
                ts.factory.createKeywordTypeNode(ts.SyntaxKind.BooleanKeyword),
            ]);
        }
    },
    inject: 'export type DecimalId = string;\nexport type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };',
    alphabetize: true,
});
const generatedPaths = `${astToString(generatedAst).replaceAll('"', "'").trimEnd()}\n`;
const generatedOperations = `export const apiContractVersion = ${JSON.stringify(contract.version)};\n\nexport const supportedOperations = ${JSON.stringify(operations, null, 2)} as const;\n`;
const generatedRuntimeOverrides = `export const runtimeOverrides = ${JSON.stringify({
    decimalIdArrayResponses: overrides.decimalIdArrayResponses,
    numericBooleanQueryParameters: overrides.numericBooleanQueryParameters,
    omitFalseQueryParameters: overrides.omitFalseQueryParameters,
    requiredQueryParameters: overrides.requiredQueryParameters,
    stringPathParameters: overrides.stringPathParameters,
}, null, 2)} as const;\n`;
const generatedOperationDocs = [
    '# OpenDota operation index',
    '',
    `Contract version ${contract.version}; generated from OpenAPI ${contract.openapi}.`,
    '',
    '| Method | Route | Operation | Description |',
    '| --- | --- | --- | --- |',
    ...operations.map(({ method, path, operationId, summary }) => `| ${method} | \`${path}\` | \`${operationId}\` | ${summary.replaceAll('|', '\\|')} |`),
    '',
].join('\n');
const generationHash = createHash('sha256').update(rawSpec).digest('hex');
if (generationHash !== contract.sha256) throw new Error('The saved OpenDota schema hash does not match spec/contract.json.');

async function emit(url, contents) {
    if (isCheck) {
        const existing = await readFile(url, 'utf8').catch(() => undefined);
        if (existing !== contents) throw new Error(`${fileURLToPath(url)} is stale; run npm run generate.`);
        return;
    }
    await writeFile(url, contents, 'utf8');
}

await emit(pathsUrl, generatedPaths);
await emit(operationsUrl, generatedOperations);
await emit(runtimeOverridesUrl, generatedRuntimeOverrides);
await emit(operationDocsUrl, generatedOperationDocs);
process.stdout.write(`${isCheck ? 'Checked' : 'Generated'} ${operations.length} operations from OpenDota ${contract.version}.\n`);
