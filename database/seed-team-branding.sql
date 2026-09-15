BEGIN;

ALTER TABLE teams ADD COLUMN IF NOT EXISTS primary_color VARCHAR(20);
ALTER TABLE teams ADD COLUMN IF NOT EXISTS shield_image TEXT;

UPDATE teams SET primary_color = '#FF7E2D', shield_image = 'Aston Birras.png' WHERE lower(trim(name)) = lower('Aston Birras');
UPDATE teams SET primary_color = '#B0232B', shield_image = 'Kalekantoi.png' WHERE lower(trim(name)) = lower('Kalekantoi');
UPDATE teams
SET primary_color = '#B0222E', shield_image = 'Inter Panda.png'
WHERE id = '10117fc0-60c4-5bde-9280-71e9ffa5b07f'
	OR lower(trim(name)) IN (lower('Inter Panda'), lower('Inter Pandurrio'), lower('Inter Pandurrios'));
UPDATE teams SET primary_color = '#83512C', shield_image = 'Pitxi FC.png' WHERE lower(trim(name)) = lower('Pitxi FC');
UPDATE teams SET primary_color = '#1D9649', shield_image = 'Zero Filtro.png' WHERE lower(trim(name)) = lower('Zero Filtro');
UPDATE teams SET primary_color = '#F3DA13', shield_image = 'Tigres.png' WHERE lower(trim(name)) = lower('Tigres');
UPDATE teams SET primary_color = '#2E4980', shield_image = 'Lojanos.png' WHERE lower(trim(name)) = lower('Lojanos');
UPDATE teams SET primary_color = '#E21D1D', shield_image = 'Martxel Juniors.png' WHERE lower(trim(name)) = lower('Martxel Juniors');
UPDATE teams SET primary_color = '#FFFAD8', shield_image = 'Parceros.png' WHERE lower(trim(name)) = lower('Parceros');
UPDATE teams SET primary_color = '#22C55E', shield_image = 'Rayo Forestal Internacional.png' WHERE lower(trim(name)) = lower('Rayo Forestal Internacional');
UPDATE teams SET primary_color = '#DE81B1', shield_image = 'Gora Gora.png' WHERE lower(trim(name)) = lower('Gora Gora');
UPDATE teams SET primary_color = '#9ED6D7', shield_image = 'Gure FC.png' WHERE lower(trim(name)) = lower('Gure FC');

-- No se inventan rutas de escudos: rellenar shield_image cuando los archivos
-- estén subidos a Supabase Storage, por ejemplo:
-- UPDATE teams SET shield_image = 'teams/aston-birras.png'
-- WHERE lower(trim(name)) = lower('Aston Birras');

COMMIT;
