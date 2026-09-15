-- Preserve the complete economy movement entered from the admin panel.
ALTER TABLE financial_movements
  ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pending_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS movement_kind VARCHAR(20) NOT NULL DEFAULT 'otro',
  ADD COLUMN IF NOT EXISTS category VARCHAR(120),
  ADD COLUMN IF NOT EXISTS entity VARCHAR(180),
  ADD COLUMN IF NOT EXISTS movement_date DATE,
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'pendiente',
  ADD COLUMN IF NOT EXISTS previous_paid NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS settlement_only BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE disciplinary_records
  ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(10,2) NOT NULL DEFAULT 0;

UPDATE financial_movements
SET
  paid_amount = CASE WHEN movement_type = 'income' THEN amount ELSE 0 END,
  pending_amount = CASE WHEN movement_type = 'income' THEN 0 ELSE amount END,
  movement_kind = COALESCE(NULLIF(movement_kind, ''), 'otro'),
  status = CASE WHEN movement_type = 'income' THEN 'pagado' ELSE 'pendiente' END
WHERE paid_amount = 0 AND pending_amount = 0;

UPDATE financial_movements
SET movement_kind = 'sancion'
WHERE category = 'Sanción';