CREATE TABLE IF NOT EXISTS finance_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  name VARCHAR(180) NOT NULL,
  entity_type VARCHAR(30) NOT NULL CHECK (entity_type IN ('patrocinador', 'entidad')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (season_id, name, entity_type)
);

ALTER TABLE financial_movements
  ADD COLUMN IF NOT EXISTS entity_id UUID REFERENCES finance_entities(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_finance_entities_season_id ON finance_entities(season_id);
CREATE INDEX IF NOT EXISTS idx_financial_movements_entity_id ON financial_movements(entity_id);

INSERT INTO finance_entities (season_id, name, entity_type)
SELECT DISTINCT season_id, entity, CASE WHEN movement_kind = 'patrocinio' THEN 'patrocinador' ELSE 'entidad' END
FROM financial_movements
WHERE NULLIF(TRIM(entity), '') IS NOT NULL
ON CONFLICT (season_id, name, entity_type) DO NOTHING;

UPDATE financial_movements AS movements
SET entity_id = entities.id
FROM finance_entities AS entities
WHERE movements.season_id = entities.season_id
  AND movements.entity = entities.name
  AND entities.entity_type = CASE WHEN movements.movement_kind = 'patrocinio' THEN 'patrocinador' ELSE 'entidad' END
  AND movements.entity_id IS NULL;

ALTER TABLE financial_movements
  DROP COLUMN IF EXISTS entity,
  DROP COLUMN IF EXISTS notes;