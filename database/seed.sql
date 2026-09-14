CREATE EXTENSION IF NOT EXISTS pgcrypto;

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
  cost_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
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
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

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
CREATE INDEX IF NOT EXISTS idx_disciplinary_records_player_id ON disciplinary_records(player_id);
CREATE INDEX IF NOT EXISTS idx_league_standings_season_team ON league_standings(season_id, team_id);

INSERT INTO seasons (id, name, year_start, year_end, is_active)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Temporada 2026/2027', 2026, 2027, TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO teams (id, season_id, name, short_name, stadium_name)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Aston Birras', 'AST', 'Tabira'),
  ('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Kalekantoi', 'KAL', 'Tabira'),
  ('33333333-3333-3333-3333-333333333333', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Inter Panda', 'INT', 'Tabira'),
  ('44444444-4444-4444-4444-444444444444', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Pitxi FC', 'PIT', 'Tabira'),
  ('55555555-5555-5555-5555-555555555555', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Zero Filtro', 'ZEF', 'Tabira'),
  ('66666666-6666-6666-6666-666666666666', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Tigres', 'TIG', 'Tabira')
ON CONFLICT (id) DO NOTHING;

INSERT INTO players (id, season_id, team_id, name, dorsal)
VALUES
  ('10000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Aner Azpitarte Leaniz', 0),
  ('10000000-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Beñat Castilla Areitioaurtena', 2),
  ('10000000-0000-0000-0000-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Ibai Aldalur Sanz', 4),
  ('10000000-0000-0000-0000-000000000004', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Aitor De La Torre Fernández', 6),
  ('10000000-0000-0000-0000-000000000005', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Alain Fernandez Igarza', 10),
  ('10000000-0000-0000-0000-000000000006', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'Ander Cifuentes', 1),
  ('10000000-0000-0000-0000-000000000007', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'Oier Calleja', 6),
  ('10000000-0000-0000-0000-000000000008', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'Lyon Cuenca', 7),
  ('10000000-0000-0000-0000-000000000009', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'Egoitz Bereziartua', 11),
  ('10000000-0000-0000-0000-000000000010', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'Iker Asategi', 17),
  ('10000000-0000-0000-0000-000000000011', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'David Xu Zhou', 2),
  ('10000000-0000-0000-0000-000000000012', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'Raúl Gallo Galerón', 7),
  ('10000000-0000-0000-0000-000000000013', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'Ibra Sane', 8),
  ('10000000-0000-0000-0000-000000000014', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'Aitor Setien Aguirre', 9),
  ('10000000-0000-0000-0000-000000000015', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', 'Omar Bouchlaghem', 1),
  ('10000000-0000-0000-0000-000000000016', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', 'Aimar Sevilla', 4),
  ('10000000-0000-0000-0000-000000000017', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', 'Anas Belaidi', 10),
  ('10000000-0000-0000-0000-000000000018', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', 'Nicolás Baruja', 11),
  ('10000000-0000-0000-0000-000000000019', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '55555555-5555-5555-5555-555555555555', 'Ignacio Cruzado', 0),
  ('10000000-0000-0000-0000-000000000020', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '55555555-5555-5555-5555-555555555555', 'Aritz Alberdi', 1),
  ('10000000-0000-0000-0000-000000000021', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '55555555-5555-5555-5555-555555555555', 'Adrián Vicandi', 7),
  ('10000000-0000-0000-0000-000000000022', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '55555555-5555-5555-5555-555555555555', 'Ander Santos', 10),
  ('10000000-0000-0000-0000-000000000023', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '66666666-6666-6666-6666-666666666666', 'Víctor Cardona', 1),
  ('10000000-0000-0000-0000-000000000024', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '66666666-6666-6666-6666-666666666666', 'Kevin Criollo Vivanco', 9),
  ('10000000-0000-0000-0000-000000000025', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '66666666-6666-6666-6666-666666666666', 'José María Moreno Zamora', 11)
ON CONFLICT (id) DO NOTHING;

INSERT INTO rounds (id, season_id, title, round_number, date, status)
VALUES
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Jornada 1', 1, '2026-09-06', 'completed'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Jornada 2', 2, '2026-09-13', 'completed'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Jornada 5', 5, '2026-09-27', 'in_progress')
ON CONFLICT (id) DO NOTHING;

INSERT INTO matches (id, season_id, round_id, home_team_id, away_team_id, scheduled_at, stadium_name, home_goals, away_goals, status)
VALUES
  ('20000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '2026-09-06T19:00:00+00:00', 'Tabira', 2, 1, 'finished'),
  ('20000000-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444', '2026-09-06T21:00:00+00:00', 'Tabira', 1, 0, 'finished'),
  ('20000000-0000-0000-0000-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '55555555-5555-5555-5555-555555555555', '66666666-6666-6666-6666-666666666666', '2026-09-13T19:00:00+00:00', 'Tabira', 3, 2, 'finished'),
  ('20000000-0000-0000-0000-000000000004', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', '2026-09-13T21:00:00+00:00', 'Tabira', 1, 1, 'finished')
ON CONFLICT (id) DO NOTHING;

INSERT INTO team_fees (id, team_id, season_id, fee_amount, paid_amount, status)
VALUES
  ('30000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 250, 180, 'pending'),
  ('30000000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 250, 250, 'paid'),
  ('30000000-0000-0000-0000-000000000003', '33333333-3333-3333-3333-333333333333', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 250, 125, 'pending'),
  ('30000000-0000-0000-0000-000000000004', '44444444-4444-4444-4444-444444444444', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 250, 250, 'paid'),
  ('30000000-0000-0000-0000-000000000005', '55555555-5555-5555-5555-555555555555', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 250, 100, 'pending'),
  ('30000000-0000-0000-0000-000000000006', '66666666-6666-6666-6666-666666666666', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 250, 210, 'pending')
ON CONFLICT (id) DO NOTHING;

INSERT INTO financial_movements (id, season_id, team_id, concept, movement_type, amount, notes)
VALUES
  ('40000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Cuota equipo', 'income', 250, 'Cuota de la temporada'),
  ('40000000-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', NULL, 'Balones', 'expense', 160, 'Material de la liga'),
  ('40000000-0000-0000-0000-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', NULL, 'Arbitraje', 'expense', 180, 'Fichas de arbitraje'),
  ('40000000-0000-0000-0000-000000000004', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'Patrocinio', 'income', 500, 'Aportación del patrocinador')
ON CONFLICT (id) DO NOTHING;

INSERT INTO league_standings (id, season_id, team_id, played, wins, draws, losses, goals_for, goals_against, goal_difference, points)
VALUES
  ('50000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 2, 2, 0, 0, 4, 2, 2, 6),
  ('50000000-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 2, 1, 1, 0, 3, 2, 1, 4),
  ('50000000-0000-0000-0000-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 2, 1, 1, 0, 3, 2, 1, 4),
  ('50000000-0000-0000-0000-000000000004', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', 2, 0, 1, 1, 2, 3, -1, 1),
  ('50000000-0000-0000-0000-000000000005', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '55555555-5555-5555-5555-555555555555', 2, 1, 0, 1, 4, 4, 0, 3),
  ('50000000-0000-0000-0000-000000000006', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '66666666-6666-6666-6666-666666666666', 2, 0, 0, 2, 3, 5, -2, 0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO disciplinary_records (id, player_id, team_id, match_id, card_type, reason, cost_amount)
VALUES
  ('60000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000023', '66666666-6666-6666-6666-666666666666', '20000000-0000-0000-0000-000000000003', 'Amarilla', 'Falta fuerte', 30),
  ('60000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000006', '22222222-2222-2222-2222-222222222222', '20000000-0000-0000-0000-000000000001', 'Roja', 'Entrada peligrosa', 80)
ON CONFLICT (id) DO NOTHING;

INSERT INTO match_events (id, match_id, player_id, team_id, event_type, minute, notes)
VALUES
  ('70000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000023', '66666666-6666-6666-6666-666666666666', 'goal', 14, 'Gol de Tigres'),
  ('70000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000006', '22222222-2222-2222-2222-222222222222', 'goal', 32, 'Gol de Kalekantoi')
ON CONFLICT (id) DO NOTHING;
