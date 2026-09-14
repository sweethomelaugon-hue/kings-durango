BEGIN;

-- NOTE:
-- This script restores the historical goal scorers and sanctions from the valid backup
-- by matching the current Supabase data by team + player name.
-- It is safe to re-run because it only inserts rows that do not already exist.

-- 1) Restore match events from the backup data.
INSERT INTO match_events (match_id, player_id, team_id, event_type, minute, notes)
SELECT m.id,
       p.id,
       home_team.id,
       'goal',
       14,
       'Restaurado desde backup: Aston Birras vs Kalekantoi'
FROM matches m
JOIN teams home_team ON home_team.id = m.home_team_id
JOIN teams away_team ON away_team.id = m.away_team_id
JOIN players p ON p.team_id = home_team.id
WHERE home_team.name = 'Aston Birras'
  AND away_team.name = 'Kalekantoi'
  AND lower(trim(p.name)) = lower(trim('Aner Azpitarte Leaniz'))
  AND NOT EXISTS (
    SELECT 1
    FROM match_events e
    WHERE e.match_id = m.id
      AND e.team_id = home_team.id
      AND e.player_id = p.id
      AND e.event_type = 'goal'
      AND e.minute = 14
  );

INSERT INTO match_events (match_id, player_id, team_id, event_type, minute, notes)
SELECT m.id,
       p.id,
       home_team.id,
       'goal',
       39,
       'Restaurado desde backup: Inter Panda vs Parceros'
FROM matches m
JOIN teams home_team ON home_team.id = m.home_team_id
JOIN teams away_team ON away_team.id = m.away_team_id
JOIN players p ON p.team_id = home_team.id
WHERE home_team.name = 'Inter Panda'
  AND away_team.name = 'Parceros'
  AND lower(trim(p.name)) = lower(trim('Dani Xu Zhou'))
  AND NOT EXISTS (
    SELECT 1
    FROM match_events e
    WHERE e.match_id = m.id
      AND e.team_id = home_team.id
      AND e.player_id = p.id
      AND e.event_type = 'goal'
      AND e.minute = 39
  );

INSERT INTO match_events (match_id, player_id, team_id, event_type, minute, notes)
SELECT m.id,
       p.id,
       home_team.id,
       'goal',
       39,
       'Restaurado desde backup: Inter Panda vs Parceros'
FROM matches m
JOIN teams home_team ON home_team.id = m.home_team_id
JOIN teams away_team ON away_team.id = m.away_team_id
JOIN players p ON p.team_id = home_team.id
WHERE home_team.name = 'Inter Panda'
  AND away_team.name = 'Parceros'
  AND lower(trim(p.name)) = lower(trim('Iker González García'))
  AND NOT EXISTS (
    SELECT 1
    FROM match_events e
    WHERE e.match_id = m.id
      AND e.team_id = home_team.id
      AND e.player_id = p.id
      AND e.event_type = 'goal'
      AND e.minute = 39
  );

INSERT INTO match_events (match_id, player_id, team_id, event_type, minute, notes)
SELECT m.id,
       p.id,
       home_team.id,
       'goal',
       57,
       'Restaurado desde backup: Gure FC vs Pitxi FC'
FROM matches m
JOIN teams home_team ON home_team.id = m.home_team_id
JOIN teams away_team ON away_team.id = m.away_team_id
JOIN players p ON p.team_id = home_team.id
WHERE home_team.name = 'Gure FC'
  AND away_team.name = 'Pitxi FC'
  AND lower(trim(p.name)) = lower(trim('Oier Acosta Jayo'))
  AND NOT EXISTS (
    SELECT 1
    FROM match_events e
    WHERE e.match_id = m.id
      AND e.team_id = home_team.id
      AND e.player_id = p.id
      AND e.event_type = 'goal'
      AND e.minute = 57
  );

INSERT INTO match_events (match_id, player_id, team_id, event_type, minute, notes)
SELECT m.id,
       p.id,
       away_team.id,
       'goal',
       73,
       'Restaurado desde backup: Gure FC vs Pitxi FC'
FROM matches m
JOIN teams home_team ON home_team.id = m.home_team_id
JOIN teams away_team ON away_team.id = m.away_team_id
JOIN players p ON p.team_id = away_team.id
WHERE home_team.name = 'Gure FC'
  AND away_team.name = 'Pitxi FC'
  AND lower(trim(p.name)) = lower(trim('El Mostafa El Arbaoui'))
  AND NOT EXISTS (
    SELECT 1
    FROM match_events e
    WHERE e.match_id = m.id
      AND e.team_id = away_team.id
      AND e.player_id = p.id
      AND e.event_type = 'goal'
      AND e.minute = 73
  );

INSERT INTO match_events (match_id, player_id, team_id, event_type, minute, notes)
SELECT m.id,
       p.id,
       home_team.id,
       'goal',
       18,
       'Restaurado desde backup: Zero Filtro vs Gora Gora'
FROM matches m
JOIN teams home_team ON home_team.id = m.home_team_id
JOIN teams away_team ON away_team.id = m.away_team_id
JOIN players p ON p.team_id = home_team.id
WHERE home_team.name = 'Zero Filtro'
  AND away_team.name = 'Gora Gora'
  AND lower(trim(p.name)) = lower(trim('Pelayo Pereira'))
  AND NOT EXISTS (
    SELECT 1
    FROM match_events e
    WHERE e.match_id = m.id
      AND e.team_id = home_team.id
      AND e.player_id = p.id
      AND e.event_type = 'goal'
      AND e.minute = 18
  );

INSERT INTO match_events (match_id, player_id, team_id, event_type, minute, notes)
SELECT m.id,
       p.id,
       away_team.id,
       'goal',
       77,
       'Restaurado desde backup: Zero Filtro vs Gora Gora'
FROM matches m
JOIN teams home_team ON home_team.id = m.home_team_id
JOIN teams away_team ON away_team.id = m.away_team_id
JOIN players p ON p.team_id = away_team.id
WHERE home_team.name = 'Zero Filtro'
  AND away_team.name = 'Gora Gora'
  AND lower(trim(p.name)) = lower(trim('Nestor Ibañez González'))
  AND NOT EXISTS (
    SELECT 1
    FROM match_events e
    WHERE e.match_id = m.id
      AND e.team_id = away_team.id
      AND e.player_id = p.id
      AND e.event_type = 'goal'
      AND e.minute = 77
  );

INSERT INTO match_events (match_id, player_id, team_id, event_type, minute, notes)
SELECT m.id,
       p.id,
       away_team.id,
       'goal',
       77,
       'Restaurado desde backup: Zero Filtro vs Gora Gora'
FROM matches m
JOIN teams home_team ON home_team.id = m.home_team_id
JOIN teams away_team ON away_team.id = m.away_team_id
JOIN players p ON p.team_id = away_team.id
WHERE home_team.name = 'Zero Filtro'
  AND away_team.name = 'Gora Gora'
  AND lower(trim(p.name)) = lower(trim('Iker Pinilla Perez'))
  AND NOT EXISTS (
    SELECT 1
    FROM match_events e
    WHERE e.match_id = m.id
      AND e.team_id = away_team.id
      AND e.player_id = p.id
      AND e.event_type = 'goal'
      AND e.minute = 77
  );

INSERT INTO match_events (match_id, player_id, team_id, event_type, minute, notes)
SELECT m.id,
       p.id,
       home_team.id,
       'goal',
       64,
       'Restaurado desde backup: Rayo Forestal Internacional vs Tigres'
FROM matches m
JOIN teams home_team ON home_team.id = m.home_team_id
JOIN teams away_team ON away_team.id = m.away_team_id
JOIN players p ON p.team_id = home_team.id
WHERE home_team.name = 'Rayo Forestal Internacional'
  AND away_team.name = 'Tigres'
  AND lower(trim(p.name)) = lower(trim('Luis Miguel Criollo Vivanco'))
  AND NOT EXISTS (
    SELECT 1
    FROM match_events e
    WHERE e.match_id = m.id
      AND e.team_id = home_team.id
      AND e.player_id = p.id
      AND e.event_type = 'goal'
      AND e.minute = 64
  );

INSERT INTO match_events (match_id, player_id, team_id, event_type, minute, notes)
SELECT m.id,
       p.id,
       away_team.id,
       'goal',
       66,
       'Restaurado desde backup: Rayo Forestal Internacional vs Tigres'
FROM matches m
JOIN teams home_team ON home_team.id = m.home_team_id
JOIN teams away_team ON away_team.id = m.away_team_id
JOIN players p ON p.team_id = away_team.id
WHERE home_team.name = 'Rayo Forestal Internacional'
  AND away_team.name = 'Tigres'
  AND lower(trim(p.name)) = lower(trim('Patxi Criollo'))
  AND NOT EXISTS (
    SELECT 1
    FROM match_events e
    WHERE e.match_id = m.id
      AND e.team_id = away_team.id
      AND e.player_id = p.id
      AND e.event_type = 'goal'
      AND e.minute = 66
  );

INSERT INTO match_events (match_id, player_id, team_id, event_type, minute, notes)
SELECT m.id,
       p.id,
       away_team.id,
       'goal',
       81,
       'Restaurado desde backup: Rayo Forestal Internacional vs Tigres'
FROM matches m
JOIN teams home_team ON home_team.id = m.home_team_id
JOIN teams away_team ON away_team.id = m.away_team_id
JOIN players p ON p.team_id = away_team.id
WHERE home_team.name = 'Rayo Forestal Internacional'
  AND away_team.name = 'Tigres'
  AND lower(trim(p.name)) = lower(trim('Andres Quevedo'))
  AND NOT EXISTS (
    SELECT 1
    FROM match_events e
    WHERE e.match_id = m.id
      AND e.team_id = away_team.id
      AND e.player_id = p.id
      AND e.event_type = 'goal'
      AND e.minute = 81
  );

INSERT INTO match_events (match_id, player_id, team_id, event_type, minute, notes)
SELECT m.id,
       p.id,
       home_team.id,
       'goal',
       57,
       'Restaurado desde backup: Pitxi FC vs Rayo Forestal Internacional'
FROM matches m
JOIN teams home_team ON home_team.id = m.home_team_id
JOIN teams away_team ON away_team.id = m.away_team_id
JOIN players p ON p.team_id = home_team.id
WHERE home_team.name = 'Pitxi FC'
  AND away_team.name = 'Rayo Forestal Internacional'
  AND lower(trim(p.name)) = lower(trim('Aimar Sevilla'))
  AND NOT EXISTS (
    SELECT 1
    FROM match_events e
    WHERE e.match_id = m.id
      AND e.team_id = home_team.id
      AND e.player_id = p.id
      AND e.event_type = 'goal'
      AND e.minute = 57
  );

INSERT INTO match_events (match_id, player_id, team_id, event_type, minute, notes)
SELECT m.id,
       p.id,
       home_team.id,
       'goal',
       61,
       'Restaurado desde backup: Kalekantoi vs Martxel Juniors'
FROM matches m
JOIN teams home_team ON home_team.id = m.home_team_id
JOIN teams away_team ON away_team.id = m.away_team_id
JOIN players p ON p.team_id = home_team.id
WHERE home_team.name = 'Kalekantoi'
  AND away_team.name = 'Martxel Juniors'
  AND lower(trim(p.name)) = lower(trim('Alex Sanchez'))
  AND NOT EXISTS (
    SELECT 1
    FROM match_events e
    WHERE e.match_id = m.id
      AND e.team_id = home_team.id
      AND e.player_id = p.id
      AND e.event_type = 'goal'
      AND e.minute = 61
  );

INSERT INTO match_events (match_id, player_id, team_id, event_type, minute, notes)
SELECT m.id,
       p.id,
       home_team.id,
       'goal',
       53,
       'Restaurado desde backup: Gora Gora vs Lojanos'
FROM matches m
JOIN teams home_team ON home_team.id = m.home_team_id
JOIN teams away_team ON away_team.id = m.away_team_id
JOIN players p ON p.team_id = home_team.id
WHERE home_team.name = 'Gora Gora'
  AND away_team.name = 'Lojanos'
  AND lower(trim(p.name)) = lower(trim('Xabier Bilbao Bilbao'))
  AND NOT EXISTS (
    SELECT 1
    FROM match_events e
    WHERE e.match_id = m.id
      AND e.team_id = home_team.id
      AND e.player_id = p.id
      AND e.event_type = 'goal'
      AND e.minute = 53
  );

INSERT INTO match_events (match_id, player_id, team_id, event_type, minute, notes)
SELECT m.id,
       p.id,
       home_team.id,
       'goal',
       66,
       'Restaurado desde backup: Parceros vs Aston Birras'
FROM matches m
JOIN teams home_team ON home_team.id = m.home_team_id
JOIN teams away_team ON away_team.id = m.away_team_id
JOIN players p ON p.team_id = home_team.id
WHERE home_team.name = 'Parceros'
  AND away_team.name = 'Aston Birras'
  AND lower(trim(p.name)) = lower(trim('Kell Reyes'))
  AND NOT EXISTS (
    SELECT 1
    FROM match_events e
    WHERE e.match_id = m.id
      AND e.team_id = home_team.id
      AND e.player_id = p.id
      AND e.event_type = 'goal'
      AND e.minute = 66
  );

INSERT INTO match_events (match_id, player_id, team_id, event_type, minute, notes)
SELECT m.id,
       p.id,
       home_team.id,
       'goal',
       45,
       'Restaurado desde backup: Inter Panda vs Tigres'
FROM matches m
JOIN teams home_team ON home_team.id = m.home_team_id
JOIN teams away_team ON away_team.id = m.away_team_id
JOIN players p ON p.team_id = home_team.id
WHERE home_team.name = 'Inter Panda'
  AND away_team.name = 'Tigres'
  AND lower(trim(p.name)) = lower(trim('Aitor Setien Aguirre'))
  AND NOT EXISTS (
    SELECT 1
    FROM match_events e
    WHERE e.match_id = m.id
      AND e.team_id = home_team.id
      AND e.player_id = p.id
      AND e.event_type = 'goal'
      AND e.minute = 45
  );

INSERT INTO match_events (match_id, player_id, team_id, event_type, minute, notes)
SELECT m.id,
       p.id,
       away_team.id,
       'goal',
       45,
       'Restaurado desde backup: Zero Filtro vs Tigres'
FROM matches m
JOIN teams home_team ON home_team.id = m.home_team_id
JOIN teams away_team ON away_team.id = m.away_team_id
JOIN players p ON p.team_id = away_team.id
WHERE home_team.name = 'Zero Filtro'
  AND away_team.name = 'Tigres'
  AND lower(trim(p.name)) = lower(trim('Camilo Jaramillo'))
  AND NOT EXISTS (
    SELECT 1
    FROM match_events e
    WHERE e.match_id = m.id
      AND e.team_id = away_team.id
      AND e.player_id = p.id
      AND e.event_type = 'goal'
      AND e.minute = 45
  );

INSERT INTO match_events (match_id, player_id, team_id, event_type, minute, notes)
SELECT m.id,
       p.id,
       home_team.id,
       'goal',
       61,
       'Restaurado desde backup: Rayo Forestal Internacional vs Lojanos'
FROM matches m
JOIN teams home_team ON home_team.id = m.home_team_id
JOIN teams away_team ON away_team.id = m.away_team_id
JOIN players p ON p.team_id = home_team.id
WHERE home_team.name = 'Rayo Forestal Internacional'
  AND away_team.name = 'Lojanos'
  AND lower(trim(p.name)) = lower(trim('Alejandro Marin'))
  AND NOT EXISTS (
    SELECT 1
    FROM match_events e
    WHERE e.match_id = m.id
      AND e.team_id = home_team.id
      AND e.player_id = p.id
      AND e.event_type = 'goal'
      AND e.minute = 61
  );

INSERT INTO match_events (match_id, player_id, team_id, event_type, minute, notes)
SELECT m.id,
       p.id,
       away_team.id,
       'goal',
       87,
       'Restaurado desde backup: Aston Birras vs Martxel Juniors'
FROM matches m
JOIN teams home_team ON home_team.id = m.home_team_id
JOIN teams away_team ON away_team.id = m.away_team_id
JOIN players p ON p.team_id = away_team.id
WHERE home_team.name = 'Aston Birras'
  AND away_team.name = 'Martxel Juniors'
  AND lower(trim(p.name)) = lower(trim('Oier de Arriba'))
  AND NOT EXISTS (
    SELECT 1
    FROM match_events e
    WHERE e.match_id = m.id
      AND e.team_id = away_team.id
      AND e.player_id = p.id
      AND e.event_type = 'goal'
      AND e.minute = 87
  );

INSERT INTO match_events (match_id, player_id, team_id, event_type, minute, notes)
SELECT m.id,
       p.id,
       home_team.id,
       'goal',
       42,
       'Restaurado desde backup: Gure FC vs Kalekantoi'
FROM matches m
JOIN teams home_team ON home_team.id = m.home_team_id
JOIN teams away_team ON away_team.id = m.away_team_id
JOIN players p ON p.team_id = home_team.id
WHERE home_team.name = 'Gure FC'
  AND away_team.name = 'Kalekantoi'
  AND lower(trim(p.name)) = lower(trim('Pello Bengoa Meabe'))
  AND NOT EXISTS (
    SELECT 1
    FROM match_events e
    WHERE e.match_id = m.id
      AND e.team_id = home_team.id
      AND e.player_id = p.id
      AND e.event_type = 'goal'
      AND e.minute = 42
  );

INSERT INTO match_events (match_id, player_id, team_id, event_type, minute, notes)
SELECT m.id,
       p.id,
       home_team.id,
       'goal',
       43,
       'Restaurado desde backup: Parceros vs Gora Gora'
FROM matches m
JOIN teams home_team ON home_team.id = m.home_team_id
JOIN teams away_team ON away_team.id = m.away_team_id
JOIN players p ON p.team_id = home_team.id
WHERE home_team.name = 'Parceros'
  AND away_team.name = 'Gora Gora'
  AND lower(trim(p.name)) = lower(trim('Kell Reyes'))
  AND NOT EXISTS (
    SELECT 1
    FROM match_events e
    WHERE e.match_id = m.id
      AND e.team_id = home_team.id
      AND e.player_id = p.id
      AND e.event_type = 'goal'
      AND e.minute = 43
  );

INSERT INTO match_events (match_id, player_id, team_id, event_type, minute, notes)
SELECT m.id,
       p.id,
       home_team.id,
       'goal',
       77,
       'Restaurado desde backup: Parceros vs Gora Gora'
FROM matches m
JOIN teams home_team ON home_team.id = m.home_team_id
JOIN teams away_team ON away_team.id = m.away_team_id
JOIN players p ON p.team_id = home_team.id
WHERE home_team.name = 'Parceros'
  AND away_team.name = 'Gora Gora'
  AND lower(trim(p.name)) = lower(trim('Henry Trujillo'))
  AND NOT EXISTS (
    SELECT 1
    FROM match_events e
    WHERE e.match_id = m.id
      AND e.team_id = home_team.id
      AND e.player_id = p.id
      AND e.event_type = 'goal'
      AND e.minute = 77
  );

INSERT INTO match_events (match_id, player_id, team_id, event_type, minute, notes)
SELECT m.id,
       p.id,
       home_team.id,
       'goal',
       58,
       'Restaurado desde backup: Parceros vs Lojanos'
FROM matches m
JOIN teams home_team ON home_team.id = m.home_team_id
JOIN teams away_team ON away_team.id = m.away_team_id
JOIN players p ON p.team_id = home_team.id
WHERE home_team.name = 'Parceros'
  AND away_team.name = 'Lojanos'
  AND lower(trim(p.name)) = lower(trim('Cristian Díaz'))
  AND NOT EXISTS (
    SELECT 1
    FROM match_events e
    WHERE e.match_id = m.id
      AND e.team_id = home_team.id
      AND e.player_id = p.id
      AND e.event_type = 'goal'
      AND e.minute = 58
  );

INSERT INTO match_events (match_id, player_id, team_id, event_type, minute, notes)
SELECT m.id,
       p.id,
       home_team.id,
       'goal',
       61,
       'Restaurado desde backup: Zero Filtro vs Aston Birras'
FROM matches m
JOIN teams home_team ON home_team.id = m.home_team_id
JOIN teams away_team ON away_team.id = m.away_team_id
JOIN players p ON p.team_id = home_team.id
WHERE home_team.name = 'Zero Filtro'
  AND away_team.name = 'Aston Birras'
  AND lower(trim(p.name)) = lower(trim('Markel Zenikaonandia'))
  AND NOT EXISTS (
    SELECT 1
    FROM match_events e
    WHERE e.match_id = m.id
      AND e.team_id = home_team.id
      AND e.player_id = p.id
      AND e.event_type = 'goal'
      AND e.minute = 61
  );

INSERT INTO match_events (match_id, player_id, team_id, event_type, minute, notes)
SELECT m.id,
       p.id,
       home_team.id,
       'goal',
       64,
       'Restaurado desde backup: Inter Panda vs Kalekantoi'
FROM matches m
JOIN teams home_team ON home_team.id = m.home_team_id
JOIN teams away_team ON away_team.id = m.away_team_id
JOIN players p ON p.team_id = home_team.id
WHERE home_team.name = 'Inter Panda'
  AND away_team.name = 'Kalekantoi'
  AND lower(trim(p.name)) = lower(trim('Milton Melgar Muñoz'))
  AND NOT EXISTS (
    SELECT 1
    FROM match_events e
    WHERE e.match_id = m.id
      AND e.team_id = home_team.id
      AND e.player_id = p.id
      AND e.event_type = 'goal'
      AND e.minute = 64
  );

INSERT INTO match_events (match_id, player_id, team_id, event_type, minute, notes)
SELECT m.id,
       p.id,
       home_team.id,
       'goal',
       42,
       'Restaurado desde backup: Pitxi FC vs Martxel Juniors'
FROM matches m
JOIN teams home_team ON home_team.id = m.home_team_id
JOIN teams away_team ON away_team.id = m.away_team_id
JOIN players p ON p.team_id = home_team.id
WHERE home_team.name = 'Pitxi FC'
  AND away_team.name = 'Martxel Juniors'
  AND lower(trim(p.name)) = lower(trim('Nicolás Baruja'))
  AND NOT EXISTS (
    SELECT 1
    FROM match_events e
    WHERE e.match_id = m.id
      AND e.team_id = home_team.id
      AND e.player_id = p.id
      AND e.event_type = 'goal'
      AND e.minute = 42
  );

INSERT INTO match_events (match_id, player_id, team_id, event_type, minute, notes)
SELECT m.id,
       p.id,
       home_team.id,
       'goal',
       76,
       'Restaurado desde backup: Gure FC vs Rayo Forestal Internacional'
FROM matches m
JOIN teams home_team ON home_team.id = m.home_team_id
JOIN teams away_team ON away_team.id = m.away_team_id
JOIN players p ON p.team_id = home_team.id
WHERE home_team.name = 'Gure FC'
  AND away_team.name = 'Rayo Forestal Internacional'
  AND lower(trim(p.name)) = lower(trim('Urtzi Etxebarrieta Ruiz de Loizaga'))
  AND NOT EXISTS (
    SELECT 1
    FROM match_events e
    WHERE e.match_id = m.id
      AND e.team_id = home_team.id
      AND e.player_id = p.id
      AND e.event_type = 'goal'
      AND e.minute = 76
  );

INSERT INTO match_events (match_id, player_id, team_id, event_type, minute, notes)
SELECT m.id,
       p.id,
       home_team.id,
       'goal',
       48,
       'Restaurado desde backup: Gora Gora vs Tigres'
FROM matches m
JOIN teams home_team ON home_team.id = m.home_team_id
JOIN teams away_team ON away_team.id = m.away_team_id
JOIN players p ON p.team_id = home_team.id
WHERE home_team.name = 'Gora Gora'
  AND away_team.name = 'Tigres'
  AND lower(trim(p.name)) = lower(trim('Edorta Olabarrieta Rodríguez'))
  AND NOT EXISTS (
    SELECT 1
    FROM match_events e
    WHERE e.match_id = m.id
      AND e.team_id = home_team.id
      AND e.player_id = p.id
      AND e.event_type = 'goal'
      AND e.minute = 48
  );

INSERT INTO match_events (match_id, player_id, team_id, event_type, minute, notes)
SELECT m.id,
       p.id,
       home_team.id,
       'goal',
       72,
       'Restaurado desde backup: Gora Gora vs Tigres'
FROM matches m
JOIN teams home_team ON home_team.id = m.home_team_id
JOIN teams away_team ON away_team.id = m.away_team_id
JOIN players p ON p.team_id = home_team.id
WHERE home_team.name = 'Gora Gora'
  AND away_team.name = 'Tigres'
  AND lower(trim(p.name)) = lower(trim('Unai Azkune Ansa'))
  AND NOT EXISTS (
    SELECT 1
    FROM match_events e
    WHERE e.match_id = m.id
      AND e.team_id = home_team.id
      AND e.player_id = p.id
      AND e.event_type = 'goal'
      AND e.minute = 72
  );

-- 2) Restore disciplinary records from the same backup.
INSERT INTO disciplinary_records (player_id, team_id, match_id, card_type, reason, cost_amount)
SELECT p.id,
       t.id,
       NULL,
       'Amarilla',
       'Motivos deportivos',
       0
FROM players p
JOIN teams t ON t.id = p.team_id
WHERE t.name = 'Aston Birras'
  AND lower(trim(p.name)) = lower(trim('Alain Fernandez Igarza'))
  AND NOT EXISTS (
    SELECT 1
    FROM disciplinary_records d
    WHERE d.player_id = p.id
      AND d.team_id = t.id
      AND d.card_type = 'Amarilla'
      AND d.reason = 'Motivos deportivos'
  );

INSERT INTO disciplinary_records (player_id, team_id, match_id, card_type, reason, cost_amount)
SELECT p.id,
       t.id,
       NULL,
       'Roja',
       'Entrada peligrosa',
       0
FROM players p
JOIN teams t ON t.id = p.team_id
WHERE t.name = 'Aston Birras'
  AND lower(trim(p.name)) = lower(trim('Ibai Aldalur Sanz'))
  AND NOT EXISTS (
    SELECT 1
    FROM disciplinary_records d
    WHERE d.player_id = p.id
      AND d.team_id = t.id
      AND d.card_type = 'Roja'
      AND d.reason = 'Entrada peligrosa'
  );

INSERT INTO disciplinary_records (player_id, team_id, match_id, card_type, reason, cost_amount)
SELECT p.id,
       t.id,
       NULL,
       'Doble amarilla',
       'Acumulación',
       0
FROM players p
JOIN teams t ON t.id = p.team_id
WHERE t.name = 'Kalekantoi'
  AND lower(trim(p.name)) = lower(trim('Egoitz Bereziartua'))
  AND NOT EXISTS (
    SELECT 1
    FROM disciplinary_records d
    WHERE d.player_id = p.id
      AND d.team_id = t.id
      AND d.card_type = 'Doble amarilla'
      AND d.reason = 'Acumulación'
  );

INSERT INTO disciplinary_records (player_id, team_id, match_id, card_type, reason, cost_amount)
SELECT p.id,
       t.id,
       NULL,
       'Amarilla',
       'Empujón',
       0
FROM players p
JOIN teams t ON t.id = p.team_id
WHERE t.name = 'Lojanos'
  AND lower(trim(p.name)) = lower(trim('Aitor Parada'))
  AND NOT EXISTS (
    SELECT 1
    FROM disciplinary_records d
    WHERE d.player_id = p.id
      AND d.team_id = t.id
      AND d.card_type = 'Amarilla'
      AND d.reason = 'Empujón'
  );

INSERT INTO disciplinary_records (player_id, team_id, match_id, card_type, reason, cost_amount)
SELECT p.id,
       t.id,
       NULL,
       'Amarilla',
       'Falta táctica',
       0
FROM players p
JOIN teams t ON t.id = p.team_id
WHERE t.name = 'Parceros'
  AND lower(trim(p.name)) = lower(trim('Henry Trujillo'))
  AND NOT EXISTS (
    SELECT 1
    FROM disciplinary_records d
    WHERE d.player_id = p.id
      AND d.team_id = t.id
      AND d.card_type = 'Amarilla'
      AND d.reason = 'Falta táctica'
  );

INSERT INTO disciplinary_records (player_id, team_id, match_id, card_type, reason, cost_amount)
SELECT p.id,
       t.id,
       NULL,
       'Roja',
       'Mano deliberada',
       0
FROM players p
JOIN teams t ON t.id = p.team_id
WHERE t.name = 'Zero Filtro'
  AND lower(trim(p.name)) = lower(trim('Aritz Alberdi'))
  AND NOT EXISTS (
    SELECT 1
    FROM disciplinary_records d
    WHERE d.player_id = p.id
      AND d.team_id = t.id
      AND d.card_type = 'Roja'
      AND d.reason = 'Mano deliberada'
  );

COMMIT;
