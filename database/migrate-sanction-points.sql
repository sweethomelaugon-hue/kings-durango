ALTER TABLE disciplinary_records
  ADD COLUMN IF NOT EXISTS points_amount NUMERIC(10,2) NOT NULL DEFAULT 0;

UPDATE disciplinary_records
SET points_amount = CASE
  WHEN card_type = 'Amarilla' THEN 2
  WHEN card_type = 'Doble amarilla' THEN 4
  WHEN card_type = 'Roja' AND reason ILIKE '%antideportiv%' THEN 10
  WHEN card_type = 'Roja' THEN 5
  ELSE 0
END
WHERE points_amount = 0;

UPDATE disciplinary_records
SET cost_amount = points_amount;