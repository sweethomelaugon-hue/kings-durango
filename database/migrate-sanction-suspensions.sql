ALTER TABLE disciplinary_records
  ADD COLUMN IF NOT EXISTS suspension_matches INTEGER NOT NULL DEFAULT 0;

ALTER TABLE disciplinary_records
  ADD COLUMN IF NOT EXISTS suspension_remaining INTEGER NOT NULL DEFAULT 0;

UPDATE disciplinary_records
SET suspension_matches = CASE
  WHEN card_type = 'Roja' AND reason ILIKE 'Motivos deportivos' THEN 1
  ELSE suspension_matches
END,
    suspension_remaining = CASE
      WHEN card_type = 'Roja' AND reason ILIKE 'Motivos deportivos' THEN 1
      ELSE suspension_remaining
    END;