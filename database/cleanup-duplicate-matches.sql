BEGIN;

WITH ranked_matches AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY season_id, round_id, home_team_id, away_team_id
      ORDER BY created_at DESC NULLS LAST, id DESC
    ) AS row_number
  FROM matches
)
DELETE FROM matches
WHERE id IN (
  SELECT id
  FROM ranked_matches
  WHERE row_number > 1
);

COMMIT;