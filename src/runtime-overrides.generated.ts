export const runtimeOverrides = {
  "decimalIdArrayResponses": [
    "/leagues/{league_id}/matchIds"
  ],
  "numericBooleanQueryParameters": [
    "win",
    "is_radiant"
  ],
  "omitFalseQueryParameters": [
    "turbo"
  ],
  "requiredQueryParameters": {
    "/explorer": [
      "sql"
    ]
  },
  "stringPathParameters": {
    "/request/{jobId}": [
      "jobId"
    ]
  }
} as const;
