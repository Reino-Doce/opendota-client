export const apiContractVersion = "31.1.0";

export const supportedOperations = [
  {
    "method": "GET",
    "path": "/benchmarks",
    "operationId": "get_benchmarks",
    "summary": "Benchmarks of average stat values for a hero"
  },
  {
    "method": "GET",
    "path": "/constants/{resource}",
    "operationId": "get_constants_by_resource",
    "summary": "Get static game data mirrored from the dotaconstants repository."
  },
  {
    "method": "GET",
    "path": "/distributions",
    "operationId": "get_distributions",
    "summary": "Distributions of MMR data by bracket and country"
  },
  {
    "method": "GET",
    "path": "/explorer",
    "operationId": "get_explorer",
    "summary": "Submit arbitrary SQL queries to the database"
  },
  {
    "method": "GET",
    "path": "/findMatches",
    "operationId": "get_find_matches",
    "summary": "Finds recent matches by heroes played"
  },
  {
    "method": "GET",
    "path": "/health",
    "operationId": "get_health",
    "summary": "Get service health data"
  },
  {
    "method": "GET",
    "path": "/heroes",
    "operationId": "get_heroes",
    "summary": "Get hero data"
  },
  {
    "method": "GET",
    "path": "/heroes/{hero_id}/durations",
    "operationId": "get_heroes_by_hero_id_select_durations",
    "summary": "Get hero performance over a range of match durations"
  },
  {
    "method": "GET",
    "path": "/heroes/{hero_id}/itemPopularity",
    "operationId": "get_heroes_by_hero_id_select_item_popularity",
    "summary": "Get item popularity of hero categoried by start, early, mid and late game, analyzed from professional games"
  },
  {
    "method": "GET",
    "path": "/heroes/{hero_id}/matches",
    "operationId": "get_heroes_by_hero_id_select_matches",
    "summary": "Get recent matches with a hero"
  },
  {
    "method": "GET",
    "path": "/heroes/{hero_id}/matchups",
    "operationId": "get_heroes_by_hero_id_select_matchups",
    "summary": "Get results against other heroes for a hero"
  },
  {
    "method": "GET",
    "path": "/heroes/{hero_id}/players",
    "operationId": "get_heroes_by_hero_id_select_players",
    "summary": "Get players who have played this hero"
  },
  {
    "method": "GET",
    "path": "/heroStats",
    "operationId": "get_hero_stats",
    "summary": "Get stats about hero performance in recent matches"
  },
  {
    "method": "GET",
    "path": "/leagues",
    "operationId": "get_leagues",
    "summary": "Get league data"
  },
  {
    "method": "GET",
    "path": "/leagues/{league_id}",
    "operationId": "get_leagues_by_league_id",
    "summary": "Get data for a league"
  },
  {
    "method": "GET",
    "path": "/leagues/{league_id}/matches",
    "operationId": "get_leagues_by_league_id_select_matches",
    "summary": "Get matches for a league (excluding amateur leagues)"
  },
  {
    "method": "GET",
    "path": "/leagues/{league_id}/matchIds",
    "operationId": "get_leagues_by_league_id_select_match_ids",
    "summary": "Get match IDs for a league (including amateur leagues)"
  },
  {
    "method": "GET",
    "path": "/leagues/{league_id}/teams",
    "operationId": "get_leagues_by_league_id_select_teams",
    "summary": "Get teams for a league"
  },
  {
    "method": "GET",
    "path": "/live",
    "operationId": "get_live",
    "summary": "Get top currently ongoing live games"
  },
  {
    "method": "GET",
    "path": "/matches/{match_id}",
    "operationId": "get_matches_by_match_id",
    "summary": "Match data"
  },
  {
    "method": "GET",
    "path": "/metadata",
    "operationId": "get_metadata",
    "summary": "Site metadata"
  },
  {
    "method": "GET",
    "path": "/parsedMatches",
    "operationId": "get_parsed_matches",
    "summary": "Get list of parsed match IDs"
  },
  {
    "method": "GET",
    "path": "/players/{account_id}",
    "operationId": "get_players_by_account_id",
    "summary": "Player data"
  },
  {
    "method": "GET",
    "path": "/players/{account_id}/counts",
    "operationId": "get_players_by_account_id_select_counts",
    "summary": "Counts in categories"
  },
  {
    "method": "GET",
    "path": "/players/{account_id}/heroes",
    "operationId": "get_players_by_account_id_select_heroes",
    "summary": "Heroes played"
  },
  {
    "method": "GET",
    "path": "/players/{account_id}/histograms/{field}",
    "operationId": "get_players_by_account_id_histograms_by_field",
    "summary": "Distribution of matches in a single stat"
  },
  {
    "method": "GET",
    "path": "/players/{account_id}/matches",
    "operationId": "get_players_by_account_id_select_matches",
    "summary": "Matches played (full history, and supports column selection)"
  },
  {
    "method": "GET",
    "path": "/players/{account_id}/peers",
    "operationId": "get_players_by_account_id_select_peers",
    "summary": "Players played with"
  },
  {
    "method": "GET",
    "path": "/players/{account_id}/pros",
    "operationId": "get_players_by_account_id_select_pros",
    "summary": "Pro players played with"
  },
  {
    "method": "GET",
    "path": "/players/{account_id}/rankings",
    "operationId": "get_players_by_account_id_select_rankings",
    "summary": "Player hero rankings"
  },
  {
    "method": "GET",
    "path": "/players/{account_id}/ratings",
    "operationId": "get_players_by_account_id_select_ratings",
    "summary": "Returns a history of the player rank tier/medal changes (replaces MMR)"
  },
  {
    "method": "GET",
    "path": "/players/{account_id}/recentMatches",
    "operationId": "get_players_by_account_id_select_recent_matches",
    "summary": "Recent matches played (limited number of results)"
  },
  {
    "method": "POST",
    "path": "/players/{account_id}/refresh",
    "operationId": "post_refresh",
    "summary": "Refresh player match history (up to 500), medal (rank), and profile name"
  },
  {
    "method": "GET",
    "path": "/players/{account_id}/totals",
    "operationId": "get_players_by_account_id_select_totals",
    "summary": "Totals in stats"
  },
  {
    "method": "GET",
    "path": "/players/{account_id}/wardmap",
    "operationId": "get_players_by_account_id_select_wardmap",
    "summary": "Wards placed in matches played"
  },
  {
    "method": "GET",
    "path": "/players/{account_id}/wl",
    "operationId": "get_players_by_account_id_select_wl",
    "summary": "Win/Loss count"
  },
  {
    "method": "GET",
    "path": "/players/{account_id}/wordcloud",
    "operationId": "get_players_by_account_id_select_wordcloud",
    "summary": "Words said/read in matches played"
  },
  {
    "method": "GET",
    "path": "/proMatches",
    "operationId": "get_pro_matches",
    "summary": "Get list of pro matches"
  },
  {
    "method": "GET",
    "path": "/proPlayers",
    "operationId": "get_pro_players",
    "summary": "Get list of pro players"
  },
  {
    "method": "GET",
    "path": "/publicMatches",
    "operationId": "get_public_matches",
    "summary": "Get list of randomly sampled public matches"
  },
  {
    "method": "GET",
    "path": "/rankings",
    "operationId": "get_rankings",
    "summary": "Top players by hero"
  },
  {
    "method": "GET",
    "path": "/records/{field}",
    "operationId": "get_records_by_field",
    "summary": "Get top performances in a stat"
  },
  {
    "method": "GET",
    "path": "/request/{jobId}",
    "operationId": "get_request_by_job_id",
    "summary": "Get parse request state"
  },
  {
    "method": "POST",
    "path": "/request/{match_id}",
    "operationId": "post_request_by_job_id",
    "summary": "Submit a new parse request. This call counts as 10 calls for rate limit (but not billing) purposes."
  },
  {
    "method": "GET",
    "path": "/scenarios/itemTimings",
    "operationId": "get_scenarios_item_timings",
    "summary": "Win rates for certain item timings on a hero for items that cost at least 1400 gold"
  },
  {
    "method": "GET",
    "path": "/scenarios/laneRoles",
    "operationId": "get_scenarios_lane_roles",
    "summary": "Win rates for heroes in certain lane roles"
  },
  {
    "method": "GET",
    "path": "/scenarios/misc",
    "operationId": "get_scenarios_misc",
    "summary": "Miscellaneous team scenarios"
  },
  {
    "method": "GET",
    "path": "/schema",
    "operationId": "get_schema",
    "summary": "Get database schema"
  },
  {
    "method": "GET",
    "path": "/search",
    "operationId": "get_search",
    "summary": "Search players by personaname."
  },
  {
    "method": "GET",
    "path": "/teams",
    "operationId": "get_teams",
    "summary": "Get team data"
  },
  {
    "method": "GET",
    "path": "/teams/{team_id}",
    "operationId": "get_teams_by_team_id",
    "summary": "Get data for a team"
  },
  {
    "method": "GET",
    "path": "/teams/{team_id}/heroes",
    "operationId": "get_teams_by_team_id_select_heroes",
    "summary": "Get heroes for a team"
  },
  {
    "method": "GET",
    "path": "/teams/{team_id}/matches",
    "operationId": "get_teams_by_team_id_select_matches",
    "summary": "Get matches for a team"
  },
  {
    "method": "GET",
    "path": "/teams/{team_id}/players",
    "operationId": "get_teams_by_team_id_select_players",
    "summary": "Get players who have played for a team"
  },
  {
    "method": "GET",
    "path": "/topPlayers",
    "operationId": "get_top_players",
    "summary": "Get list of highly ranked players"
  }
] as const;
