-- Modelo canónico de la liga: la capa pública y la administración deben compartirse
-- desde esta estructura para evitar que existan fuentes de datos separadas.
-- Las migraciones de datos válidos deben respetar los IDs estables del seed y no
-- destruir el histórico existente del proyecto.

CREATE TABLE IF NOT EXISTS seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL,
  year_start INTEGER NOT NULL,
  year_end INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (name, year_start, year_end)
);

CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  short_name VARCHAR(20),
  stadium_name VARCHAR(120) DEFAULT 'Tabira',
  primary_color VARCHAR(20),
  shield_image TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (season_id, name)
);

CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name VARCHAR(180) NOT NULL,
  dorsal INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (team_id, name),
  UNIQUE (season_id, team_id, name)
);

CREATE TABLE IF NOT EXISTS rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  title VARCHAR(80) NOT NULL,
  round_number INTEGER NOT NULL,
  date DATE,
  status VARCHAR(20) DEFAULT 'upcoming',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (season_id, round_number)
);

CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  round_id UUID REFERENCES rounds(id) ON DELETE SET NULL,
  home_team_id UUID NOT NULL REFERENCES teams(id),
  away_team_id UUID NOT NULL REFERENCES teams(id),
  scheduled_at TIMESTAMPTZ,
  stadium_name VARCHAR(120) DEFAULT 'Tabira',
  home_goals INTEGER DEFAULT 0,
  away_goals INTEGER DEFAULT 0,
  shootout_home_goals INTEGER,
  shootout_away_goals INTEGER,
  status VARCHAR(20) DEFAULT 'scheduled',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (home_team_id <> away_team_id),
  CHECK (home_goals >= 0 AND away_goals >= 0)
);

CREATE TABLE IF NOT EXISTS match_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id UUID REFERENCES players(id) ON DELETE SET NULL,
  team_id UUID NOT NULL REFERENCES teams(id),
  event_type VARCHAR(30) NOT NULL CHECK (event_type IN ('goal', 'own_goal', 'yellow_card', 'red_card')),
  minute INTEGER CHECK (minute BETWEEN 1 AND 120),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS disciplinary_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  match_id UUID REFERENCES matches(id) ON DELETE SET NULL,
  card_type VARCHAR(30) NOT NULL CHECK (card_type IN ('Amarilla', 'Doble amarilla', 'Roja', 'Otra')),
  reason TEXT NOT NULL,
  suspension_matches INTEGER NOT NULL DEFAULT 0 CHECK (suspension_matches >= 0),
  suspension_remaining INTEGER NOT NULL DEFAULT 0 CHECK (suspension_remaining >= 0),
  points_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  cost_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  paid_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS team_fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  fee_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  paid_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pending',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (team_id, season_id)
);

CREATE TABLE IF NOT EXISTS financial_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  concept VARCHAR(180) NOT NULL,
  movement_type VARCHAR(20) NOT NULL CHECK (movement_type IN ('income', 'expense')),
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  paid_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  pending_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  movement_kind VARCHAR(20) NOT NULL DEFAULT 'otro',
  category VARCHAR(120),
  movement_date DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'pendiente',
  previous_paid NUMERIC(10,2),
  settlement_only BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS league_standings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  played INTEGER NOT NULL DEFAULT 0 CHECK (played >= 0),
  wins INTEGER NOT NULL DEFAULT 0 CHECK (wins >= 0),
  draws INTEGER NOT NULL DEFAULT 0 CHECK (draws >= 0),
  losses INTEGER NOT NULL DEFAULT 0 CHECK (losses >= 0),
  goals_for INTEGER NOT NULL DEFAULT 0 CHECK (goals_for >= 0),
  goals_against INTEGER NOT NULL DEFAULT 0 CHECK (goals_against >= 0),
  goal_difference INTEGER NOT NULL DEFAULT 0,
  points INTEGER NOT NULL DEFAULT 0 CHECK (points >= 0),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (season_id, team_id)
);

CREATE INDEX IF NOT EXISTS idx_players_team_id ON players(team_id);
CREATE INDEX IF NOT EXISTS idx_matches_round_id ON matches(round_id);
CREATE INDEX IF NOT EXISTS idx_matches_season_id ON matches(season_id);
CREATE INDEX IF NOT EXISTS idx_financial_movements_season_id ON financial_movements(season_id);
CREATE INDEX IF NOT EXISTS idx_financial_movements_entity_id ON financial_movements(entity_id);
CREATE INDEX IF NOT EXISTS idx_finance_entities_season_id ON finance_entities(season_id);
CREATE INDEX IF NOT EXISTS idx_disciplinary_records_player_id ON disciplinary_records(player_id);
CREATE INDEX IF NOT EXISTS idx_league_standings_season_team ON league_standings(season_id, team_id);
