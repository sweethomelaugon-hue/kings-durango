BEGIN;

ALTER TABLE teams ADD COLUMN IF NOT EXISTS primary_color VARCHAR(20);
ALTER TABLE teams ADD COLUMN IF NOT EXISTS shield_image TEXT;

UPDATE teams
SET primary_color = '#22C55E', shield_image = 'Rayo Forestal Internacional.png'
WHERE lower(trim(name)) = lower('Rayo Forestal Internacional')
	AND (primary_color IS NULL OR primary_color = '');

UPDATE teams
SET primary_color = '#B0222E'
WHERE id = '10117fc0-60c4-5bde-9280-71e9ffa5b07f'
	AND (primary_color IS NULL OR primary_color = '');

COMMIT;