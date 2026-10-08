# OpenDota operation index

Contract version 31.1.0; generated from OpenAPI 3.0.3.

| Method | Route | Operation | Description |
| --- | --- | --- | --- |
| GET | `/benchmarks` | `get_benchmarks` | Benchmarks of average stat values for a hero |
| GET | `/constants/{resource}` | `get_constants_by_resource` | Get static game data mirrored from the dotaconstants repository. |
| GET | `/distributions` | `get_distributions` | Distributions of MMR data by bracket and country |
| GET | `/explorer` | `get_explorer` | Submit arbitrary SQL queries to the database |
| GET | `/findMatches` | `get_find_matches` | Finds recent matches by heroes played |
| GET | `/health` | `get_health` | Get service health data |
| GET | `/heroes` | `get_heroes` | Get hero data |
| GET | `/heroes/{hero_id}/durations` | `get_heroes_by_hero_id_select_durations` | Get hero performance over a range of match durations |
| GET | `/heroes/{hero_id}/itemPopularity` | `get_heroes_by_hero_id_select_item_popularity` | Get item popularity of hero categoried by start, early, mid and late game, analyzed from professional games |
| GET | `/heroes/{hero_id}/matches` | `get_heroes_by_hero_id_select_matches` | Get recent matches with a hero |
| GET | `/heroes/{hero_id}/matchups` | `get_heroes_by_hero_id_select_matchups` | Get results against other heroes for a hero |
| GET | `/heroes/{hero_id}/players` | `get_heroes_by_hero_id_select_players` | Get players who have played this hero |
| GET | `/heroStats` | `get_hero_stats` | Get stats about hero performance in recent matches |
| GET | `/leagues` | `get_leagues` | Get league data |
| GET | `/leagues/{league_id}` | `get_leagues_by_league_id` | Get data for a league |
| GET | `/leagues/{league_id}/matches` | `get_leagues_by_league_id_select_matches` | Get matches for a league (excluding amateur leagues) |
| GET | `/leagues/{league_id}/matchIds` | `get_leagues_by_league_id_select_match_ids` | Get match IDs for a league (including amateur leagues) |
| GET | `/leagues/{league_id}/teams` | `get_leagues_by_league_id_select_teams` | Get teams for a league |
| GET | `/live` | `get_live` | Get top currently ongoing live games |
| GET | `/matches/{match_id}` | `get_matches_by_match_id` | Match data |
| GET | `/metadata` | `get_metadata` | Site metadata |
| GET | `/parsedMatches` | `get_parsed_matches` | Get list of parsed match IDs |
| GET | `/players/{account_id}` | `get_players_by_account_id` | Player data |
| GET | `/players/{account_id}/counts` | `get_players_by_account_id_select_counts` | Counts in categories |
| GET | `/players/{account_id}/heroes` | `get_players_by_account_id_select_heroes` | Heroes played |
| GET | `/players/{account_id}/histograms/{field}` | `get_players_by_account_id_histograms_by_field` | Distribution of matches in a single stat |
| GET | `/players/{account_id}/matches` | `get_players_by_account_id_select_matches` | Matches played (full history, and supports column selection) |
| GET | `/players/{account_id}/peers` | `get_players_by_account_id_select_peers` | Players played with |
| GET | `/players/{account_id}/pros` | `get_players_by_account_id_select_pros` | Pro players played with |
| GET | `/players/{account_id}/rankings` | `get_players_by_account_id_select_rankings` | Player hero rankings |
| GET | `/players/{account_id}/ratings` | `get_players_by_account_id_select_ratings` | Returns a history of the player rank tier/medal changes (replaces MMR) |
| GET | `/players/{account_id}/recentMatches` | `get_players_by_account_id_select_recent_matches` | Recent matches played (limited number of results) |
| POST | `/players/{account_id}/refresh` | `post_refresh` | Refresh player match history (up to 500), medal (rank), and profile name |
| GET | `/players/{account_id}/totals` | `get_players_by_account_id_select_totals` | Totals in stats |
| GET | `/players/{account_id}/wardmap` | `get_players_by_account_id_select_wardmap` | Wards placed in matches played |
| GET | `/players/{account_id}/wl` | `get_players_by_account_id_select_wl` | Win/Loss count |
| GET | `/players/{account_id}/wordcloud` | `get_players_by_account_id_select_wordcloud` | Words said/read in matches played |
| GET | `/proMatches` | `get_pro_matches` | Get list of pro matches |
| GET | `/proPlayers` | `get_pro_players` | Get list of pro players |
| GET | `/publicMatches` | `get_public_matches` | Get list of randomly sampled public matches |
| GET | `/rankings` | `get_rankings` | Top players by hero |
| GET | `/records/{field}` | `get_records_by_field` | Get top performances in a stat |
| GET | `/request/{jobId}` | `get_request_by_job_id` | Get parse request state |
| POST | `/request/{match_id}` | `post_request_by_job_id` | Submit a new parse request. This call counts as 10 calls for rate limit (but not billing) purposes. |
| GET | `/scenarios/itemTimings` | `get_scenarios_item_timings` | Win rates for certain item timings on a hero for items that cost at least 1400 gold |
| GET | `/scenarios/laneRoles` | `get_scenarios_lane_roles` | Win rates for heroes in certain lane roles |
| GET | `/scenarios/misc` | `get_scenarios_misc` | Miscellaneous team scenarios |
| GET | `/schema` | `get_schema` | Get database schema |
| GET | `/search` | `get_search` | Search players by personaname. |
| GET | `/teams` | `get_teams` | Get team data |
| GET | `/teams/{team_id}` | `get_teams_by_team_id` | Get data for a team |
| GET | `/teams/{team_id}/heroes` | `get_teams_by_team_id_select_heroes` | Get heroes for a team |
| GET | `/teams/{team_id}/matches` | `get_teams_by_team_id_select_matches` | Get matches for a team |
| GET | `/teams/{team_id}/players` | `get_teams_by_team_id_select_players` | Get players who have played for a team |
| GET | `/topPlayers` | `get_top_players` | Get list of highly ranked players |
