export const runtimeOverrides = {
  "decimalIdProperties": [
    "account_id",
    "included_account_id",
    "excluded_account_id",
    "match_id",
    "match_seq_num",
    "steamid",
    "steam_id",
    "lobby_id",
    "server_id",
    "server_steam_id",
    "game_server_id",
    "watch_server_id",
    "team_id",
    "radiant_team_id",
    "dire_team_id",
    "opposing_team_id",
    "league_id",
    "leagueid",
    "jobId"
  ],
  "decimalIdResponseProperties": {
    "/request/{jobId}": [
      "id"
    ]
  },
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
