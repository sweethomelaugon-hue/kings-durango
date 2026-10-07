CREATE TABLE IF NOT EXISTS league_section_information (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  section_key VARCHAR(40) NOT NULL,
  title VARCHAR(120) NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (season_id, section_key)
);

ALTER TABLE league_section_information ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read league section information" ON league_section_information;
CREATE POLICY "Public can read league section information"
  ON league_section_information
  FOR SELECT
  TO anon, authenticated
  USING (true);

GRANT SELECT ON TABLE league_section_information TO anon, authenticated;
GRANT ALL ON TABLE league_section_information TO service_role;

CREATE INDEX IF NOT EXISTS idx_league_section_information_season
  ON league_section_information(season_id);

INSERT INTO league_section_information (season_id, section_key, title, content)
SELECT
  id,
  'clasificacion',
  'Criterios de clasificación',
  E'• Fase 1: puntos, enfrentamiento directo, golaveraje general, fair-play (suma de tarjetas en euros), goles a favor\n• Fase 2: puntos, clasificación en la fase 1'
FROM seasons
WHERE is_active = TRUE
ON CONFLICT (season_id, section_key) DO NOTHING;

UPDATE league_section_information
SET
  title = 'Plantillas, inscripciones y equipamiento',
  content = $information$
## Inscripciones y plantilla
Cada equipo deberá presentar su plantilla antes del 15 de julio, con un mínimo de 14 jugadores. Para identificar correctamente a cada participante, se deberán facilitar su nombre y apellidos.
- En agosto, una vez cerrada la plantilla, se podrán añadir hasta 3 jugadores, sin superar un máximo de 17.
- Durante el mercado de invierno se podrán realizar hasta 2 fichajes. Estos podrán utilizarse para sustituir a cualquier jugador o para completar la plantilla si todavía no se había alcanzado el máximo de 17.

## Balones
Al inicio de la temporada, cada equipo recibirá cinco balones y un inflador, que deberá devolver al final del año. Cada equipo será responsable de mantener sus balones en buenas condiciones. La organización no se responsabilizará de los balones que se pierdan o falten.
- Cada equipo aportará los balones para el partido: se jugará la primera parte con los de un equipo y la segunda parte con los del otro.
- Si el balón sale de las instalaciones, el equipo local deberá ir a buscarlo durante la primera parte y el equipo visitante durante la segunda.
- Incumplir esta norma conllevará una sanción económica de 10 euros.

## Equipaciones
Cada equipo deberá elegir un color de camiseta y de pantalón. Los colores de las camisetas no podrán coincidir entre equipos.
- Si dos equipos coinciden en el color, tendrá prioridad el que haya participado en ediciones anteriores. El equipo nuevo deberá jugar con petos proporcionados por la liga.
- Todos los jugadores de un equipo deberán llevar el mismo color de camiseta, excepto el portero.
- Los equipos que continúen de la temporada anterior tendrán prioridad para conservar el color de camiseta que utilizaron la temporada pasada.
$information$,
  updated_at = NOW()
WHERE section_key = 'equipos'
  AND title = 'Plantillas, inscripciones y equipamiento'
  AND content = $old_equipos_v2$
## Inscripciones y plantilla
Cada equipo deberá tener entre 15 y 17 jugadores en su plantilla. Para identificar correctamente a cada participante, se deberán facilitar su nombre y apellidos.
- La organización fijará una fecha límite para entregar la lista de inscritos. Después de esa fecha no se admitirán nuevas inscripciones.
- No habrá mercado de fichajes esta temporada. Ningún equipo podrá sustituir a jugadores incluidos en su lista, bajo ninguna circunstancia.

## Balones
Al inicio de la temporada, cada equipo recibirá cinco balones y un inflador, que deberá devolver al final del año. Cada equipo será responsable de mantener sus balones en buenas condiciones. La organización no se responsabilizará de los balones que se pierdan o falten.
- Cada equipo aportará los balones para el partido: se jugará la primera parte con los de un equipo y la segunda parte con los del otro.
- Si el balón sale de las instalaciones, el equipo local deberá ir a buscarlo durante la primera parte y el equipo visitante durante la segunda.
- Incumplir esta norma conllevará una sanción económica de 10 euros.

## Equipaciones
Cada equipo deberá elegir un color de camiseta y de pantalón. Los colores de las camisetas no podrán coincidir entre equipos.
- Si dos equipos coinciden en el color, tendrá prioridad el que haya participado en ediciones anteriores. El equipo nuevo deberá jugar con petos proporcionados por la liga.
- Todos los jugadores de un equipo deberán llevar el mismo color de camiseta, excepto el portero.
- Los equipos que continúen de la temporada anterior tendrán prioridad para conservar el color de camiseta que utilizaron la temporada pasada.
$old_equipos_v2$;

INSERT INTO league_section_information (season_id, section_key, title, content)
SELECT
  id,
  'calendario',
  'Formato de competición',
  $information$
## Fase 1 · Liga regular
Todos los equipos se enfrentan entre sí.
- Puestos 1–6: pasan a la Liga de Campeones.
- Puestos 7–12: pasan a la Liga del Hoyo.

## Fase 2 · Ligas por grupos
### Liga de Campeones
Los seis equipos empiezan de cero y compiten por el título de la Liga de Campeones.
- Puestos 1–4: pasan directamente a playoffs.
- Puestos 5–6: disputan la repesca.

### Liga del Hoyo
Los seis equipos empiezan de cero.
- Puestos 1–2: pasan directamente a playoffs.
- Puestos 3–4: disputan la repesca.
- Puestos 5–6: quedan eliminados.

## Fase 3 · Repesca y playoffs
### Repesca · partido único
- 5.º de la Liga de Campeones vs 4.º de la Liga del Hoyo.
- 6.º de la Liga de Campeones vs 3.º de la Liga del Hoyo.

### Playoffs · partido único
Se sortearán los cruces entre cuatro equipos de la Liga de Campeones, los dos ganadores de la repesca y dos equipos de la Liga del Hoyo. Se disputarán cuartos de final, semifinal y final.

Las fechas, horas y emparejamientos programados se muestran en el calendario de cada fase.
$information$
FROM seasons
WHERE is_active = TRUE
ON CONFLICT (season_id, section_key) DO NOTHING;

INSERT INTO league_section_information (season_id, section_key, title, content)
SELECT
  id,
  'jornadas',
  'Reglas de juego',
  $information$
## Duración y puntuación
Cada parte durará 22 minutos. El árbitro podrá añadir tiempo si lo considera necesario.
- El equipo ganador del partido obtendrá 3 puntos.

### Empates y penaltis shootout
En caso de empate, se disputará una tanda de tres penaltis shootout. En cada intento, el jugador dispondrá de 8 segundos para salir desde el centro del campo y tirar a portería. Si supera ese tiempo, el lanzamiento se considerará fallado.
- El lanzador no podrá volver a tocar el balón si, tras el lanzamiento, este rebota en el portero o en los postes.
- Si el portero toca el balón fuera del área o comete una falta sobre el atacante, el árbitro concederá un penalti convencional a favor del atacante.
- Si el lanzamiento rebota en el larguero o en un poste, el atacante no podrá volver a golpear el balón para marcar, aunque el portero no lo haya tocado.
- El ganador de la tanda obtendrá 2 puntos y el perdedor, 1 punto.

## Jugadores en el campo
Los partidos se disputarán con 7 jugadores por equipo. El mínimo para iniciar el partido es de 7 jugadores.
- Si un equipo no alcanza el mínimo por falta de jugadores, perderá el partido y se le restarán 3 puntos de la clasificación.
- Si un equipo empieza con suficientes jugadores y durante el encuentro baja de 7 por una expulsión o lesión, podrá continuar con los jugadores disponibles.
- Una alineación indebida supondrá la derrota del partido y la resta de 3 puntos de la clasificación.
- Si un equipo tiene 8 jugadores o más en el campo, el árbitro concederá un penalti a favor del rival y mostrará tarjeta amarilla al capitán del equipo infractor.

## Sustituciones
Las sustituciones se realizarán con el balón parado y cuando el equipo tenga la posesión.
- Solo se podrá sustituir sin tener la posesión cuando el equipo rival esté realizando una sustitución.
- Los cambios se efectuarán siempre por el lado de los banquillos.

$information$
FROM seasons
WHERE is_active = TRUE
ON CONFLICT (season_id, section_key) DO NOTHING;

UPDATE league_section_information
SET
  title = 'Reglas de juego',
  content = $information$
## Duración y puntuación
Cada parte durará 22 minutos. El árbitro podrá añadir tiempo si lo considera necesario.
- El equipo ganador del partido obtendrá 3 puntos.

### Empates y penaltis shootout
En caso de empate, se disputará una tanda de tres penaltis shootout. En cada intento, el jugador dispondrá de 8 segundos para salir desde el centro del campo y tirar a portería. Si supera ese tiempo, el lanzamiento se considerará fallado.
- El lanzador no podrá volver a tocar el balón si, tras el lanzamiento, este rebota en el portero o en los postes.
- Si el portero toca el balón fuera del área o comete una falta sobre el atacante, el árbitro concederá un penalti convencional a favor del atacante.
- Si el lanzamiento rebota en el larguero o en un poste, el atacante no podrá volver a golpear el balón para marcar, aunque el portero no lo haya tocado.
- El ganador de la tanda obtendrá 2 puntos y el perdedor, 1 punto.

## Jugadores en el campo
Los partidos se disputarán con 7 jugadores por equipo. El mínimo para iniciar el partido es de 7 jugadores.
- Si un equipo no alcanza el mínimo por falta de jugadores, perderá el partido y se le restarán 3 puntos de la clasificación.
- Si un equipo empieza con suficientes jugadores y durante el encuentro baja de 7 por una expulsión o lesión, podrá continuar con los jugadores disponibles.
- Una alineación indebida supondrá la derrota del partido y la resta de 3 puntos de la clasificación.
- Si un equipo tiene 8 jugadores o más en el campo, el árbitro concederá un penalti a favor del rival y mostrará tarjeta amarilla al capitán del equipo infractor.

## Sustituciones
Las sustituciones se realizarán con el balón parado y cuando el equipo tenga la posesión.
- Solo se podrá sustituir sin tener la posesión cuando el equipo rival esté realizando una sustitución.
- Los cambios se efectuarán siempre por el lado de los banquillos.
$information$,
  updated_at = NOW()
WHERE section_key = 'jornadas'
  AND title = 'Reglas de juego'
  AND content = $old_jornadas$
## Duración y puntuación
Cada parte durará 22 minutos. El árbitro podrá añadir tiempo si lo considera necesario.
- El equipo ganador del partido obtendrá 3 puntos.
- En caso de empate, se disputará una tanda de tres penaltis shootout. En cada intento, el jugador dispondrá de 8 segundos para salir desde el centro del campo y tirar a portería. Si supera ese tiempo, el lanzamiento se considerará fallado.
- El lanzador no podrá volver a tocar el balón si, tras el lanzamiento, este rebota en el portero o en los postes.
- El ganador de la tanda obtendrá 2 puntos y el perdedor, 1 punto.

## Jugadores en el campo
Los partidos se disputarán con 7 jugadores por equipo. El mínimo para iniciar el partido es de 7 jugadores.
- Si un equipo no alcanza el mínimo por falta de jugadores, perderá el partido y se le restarán 3 puntos de la clasificación.
- Si un equipo empieza con suficientes jugadores y durante el encuentro baja de 7 por una expulsión o lesión, podrá continuar con los jugadores disponibles.
- Una alineación indebida supondrá la derrota del partido y la resta de 3 puntos de la clasificación.
- Si un equipo tiene 8 jugadores o más en el campo, el árbitro concederá un penalti a favor del rival y mostrará tarjeta amarilla al capitán del equipo infractor.

## Sustituciones
Las sustituciones se realizarán con el balón parado y cuando el equipo tenga la posesión.
- Solo se podrá sustituir sin tener la posesión cuando el equipo rival esté realizando una sustitución.
- Los cambios se efectuarán siempre por el lado de los banquillos.

## Situaciones especiales en el shootout
- Si el portero toca el balón fuera del área o comete una falta sobre el atacante, el árbitro concederá un penalti convencional a favor del atacante.
- Si el lanzamiento rebota en el larguero o en un poste, el atacante no podrá volver a golpear el balón para marcar, aunque el portero no lo haya tocado.
$old_jornadas$;

UPDATE league_section_information
SET
  title = 'Plantillas, inscripciones y equipamiento',
  content = $information$
## Inscripciones y plantilla
Cada equipo deberá presentar su plantilla antes del 15 de julio, con un mínimo de 14 jugadores. Para identificar correctamente a cada participante, se deberán facilitar su nombre y apellidos.
- En agosto, una vez cerrada la plantilla, se podrán añadir hasta 3 jugadores, sin superar un máximo de 17.
- Durante el mercado de invierno se podrán realizar hasta 2 fichajes. Estos podrán utilizarse para sustituir a cualquier jugador o para completar la plantilla si todavía no se había alcanzado el máximo de 17.

## Balones
Al inicio de la temporada, cada equipo recibirá cinco balones y un inflador, que deberá devolver al final del año. Cada equipo será responsable de mantener sus balones en buenas condiciones. La organización no se responsabilizará de los balones que se pierdan o falten.
- Cada equipo aportará los balones para el partido: se jugará la primera parte con los de un equipo y la segunda parte con los del otro.
- Si el balón sale de las instalaciones, el equipo local deberá ir a buscarlo durante la primera parte y el equipo visitante durante la segunda.
- Incumplir esta norma conllevará una sanción económica de 10 euros.

## Equipaciones
Cada equipo deberá elegir un color de camiseta y de pantalón. Los colores de las camisetas no podrán coincidir entre equipos.
- Si dos equipos coinciden en el color, tendrá prioridad el que haya participado en ediciones anteriores. El equipo nuevo deberá jugar con petos proporcionados por la liga.
- Todos los jugadores de un equipo deberán llevar el mismo color de camiseta, excepto el portero.
- Los equipos que continúen de la temporada anterior tendrán prioridad para conservar el color de camiseta que utilizaron la temporada pasada.
$information$,
  updated_at = NOW()
WHERE section_key = 'equipos'
  AND title = 'Desarrollo y normativa de los partidos'
  AND content = $old_default$
## Desarrollo de los partidos
### Duración y puntuación
Cada parte durará 22 minutos. El árbitro podrá añadir tiempo si lo considera necesario.
- El equipo ganador del partido obtendrá 3 puntos.
- En caso de empate, se disputará una tanda de tres penaltis shootout. En cada intento, el jugador dispondrá de 8 segundos para salir desde el centro del campo y tirar a portería. Si supera ese tiempo, el lanzamiento se considerará fallado.
- El lanzador no podrá volver a tocar el balón si, tras el lanzamiento, este rebota en el portero o en los postes.
- El ganador de la tanda obtendrá 2 puntos y el perdedor, 1 punto.

### Inscripciones y plantilla
Cada equipo deberá tener entre 15 y 17 jugadores en su plantilla. Para identificar correctamente a cada participante, se deberán facilitar su nombre y apellidos.
- La organización fijará una fecha límite para entregar la lista de inscritos. Después de esa fecha no se admitirán nuevas inscripciones.
- No habrá mercado de fichajes esta temporada. Ningún equipo podrá sustituir a jugadores incluidos en su lista, bajo ninguna circunstancia.

### Alineación y número de jugadores
Los partidos se disputarán con 7 jugadores por equipo. El mínimo para iniciar el partido es de 7 jugadores.
- Si un equipo no alcanza el mínimo por falta de jugadores, perderá el partido y se le restarán 3 puntos de la clasificación.
- Si un equipo empieza el partido con suficientes jugadores y durante el encuentro baja de 7 por una expulsión o una lesión, podrá continuar con los jugadores disponibles.
- Una alineación indebida supondrá la derrota del partido y la resta de 3 puntos de la clasificación.

### Sustituciones
Las sustituciones se realizarán con el balón parado y cuando el equipo tenga la posesión.
- Solo se podrá sustituir sin tener la posesión cuando el equipo rival esté realizando una sustitución.
- Los cambios se efectuarán siempre por el lado de los banquillos.

## Situaciones especiales
### Jugador de más
Si un equipo tiene 8 jugadores o más en el campo, el árbitro concederá un penalti a favor del rival y mostrará tarjeta amarilla al capitán del equipo infractor.

### Tanda de penaltis shootout
- Si el portero toca el balón fuera del área o comete una falta sobre el atacante, el árbitro concederá un penalti convencional a favor del atacante.
- Si el lanzamiento rebota en el larguero o en un poste, el atacante no podrá volver a golpear el balón para marcar, aunque el portero no lo haya tocado.

## Material y equipaciones
### Balones
Al inicio de la temporada, cada equipo recibirá cinco balones y un inflador, que deberá devolver al final del año. Cada equipo será responsable de mantener sus balones en buenas condiciones. La organización no se responsabilizará de los balones que se pierdan o falten.
- Cada equipo aportará los balones para el partido: se jugará la primera parte con los de un equipo y la segunda parte con los del otro.
- Si el balón sale de las instalaciones, el equipo local deberá ir a buscarlo durante la primera parte y el equipo visitante durante la segunda.
- Incumplir esta norma conllevará una sanción económica de 10 euros.

### Equipaciones
Cada equipo deberá elegir un color de camiseta y de pantalón. Los colores de las camisetas no podrán coincidir entre equipos.
- Si dos equipos coinciden en el color, tendrá prioridad el que haya participado en ediciones anteriores. El equipo nuevo deberá jugar con petos proporcionados por la liga.
- Todos los jugadores de un equipo deberán llevar el mismo color de camiseta, excepto el portero.
- Los equipos que continúen de la temporada anterior tendrán prioridad para conservar el color de camiseta que utilizaron la temporada pasada.
$old_default$;

INSERT INTO league_section_information (season_id, section_key, title, content)
SELECT
  id,
  'equipos',
  'Plantillas, inscripciones y equipamiento',
  $information$
## Inscripciones y plantilla
Cada equipo deberá presentar su plantilla antes del 15 de julio, con un mínimo de 14 jugadores. Para identificar correctamente a cada participante, se deberán facilitar su nombre y apellidos.
- En agosto, una vez cerrada la plantilla, se podrán añadir hasta 3 jugadores, sin superar un máximo de 17.
- Durante el mercado de invierno se podrán realizar hasta 2 fichajes. Estos podrán utilizarse para sustituir a cualquier jugador o para completar la plantilla si todavía no se había alcanzado el máximo de 17.

## Balones
Al inicio de la temporada, cada equipo recibirá cinco balones y un inflador, que deberá devolver al final del año. Cada equipo será responsable de mantener sus balones en buenas condiciones. La organización no se responsabilizará de los balones que se pierdan o falten.
- Cada equipo aportará los balones para el partido: se jugará la primera parte con los de un equipo y la segunda parte con los del otro.
- Si el balón sale de las instalaciones, el equipo local deberá ir a buscarlo durante la primera parte y el equipo visitante durante la segunda.
- Incumplir esta norma conllevará una sanción económica de 10 euros.

## Equipaciones
Cada equipo deberá elegir un color de camiseta y de pantalón. Los colores de las camisetas no podrán coincidir entre equipos.
- Si dos equipos coinciden en el color, tendrá prioridad el que haya participado en ediciones anteriores. El equipo nuevo deberá jugar con petos proporcionados por la liga.
- Todos los jugadores de un equipo deberán llevar el mismo color de camiseta, excepto el portero.
- Los equipos que continúen de la temporada anterior tendrán prioridad para conservar el color de camiseta que utilizaron la temporada pasada.
$information$
FROM seasons
WHERE is_active = TRUE
ON CONFLICT (season_id, section_key) DO NOTHING;

INSERT INTO league_section_information (season_id, section_key, title, content)
SELECT
  id,
  'sanciones',
  'Sanciones y amonestaciones',
  $information$
## Tarjetas y reinicio
- Las tarjetas rojas no se anulan durante la temporada.
- Al finalizar la 2.ª fase y antes de los playoffs, se reiniciará el contador de tarjetas amarillas y las suspensiones pendientes debidas exclusivamente a la acumulación de amarillas. Así, ningún jugador se perderá un partido de playoffs por acumulación.
- Las tarjetas rojas recibidas en los playoffs de la temporada anterior se mantienen; las amarillas sí se reinician.

## Sanciones económicas
### Importe por tarjeta
- Tarjeta amarilla: 2 €.
- Tarjeta roja por doble amarilla: 4 €.
- Tarjeta roja directa por motivos deportivos: 5 €.
- Tarjeta roja directa por motivos antideportivos: 10 €.

### Pago
Las cantidades acumuladas deberán abonarse al cierre de cada mes y, en todo caso, antes del inicio de la jornada. Si un equipo no ha pagado antes de que comience la jornada, perderá su partido.

## Suspensiones
- Tres tarjetas amarillas acumuladas: 1 partido.
- Tarjeta roja por doble amarilla: 1 partido.
- Tarjeta roja directa por motivos deportivos: 1 partido.
- Tarjeta roja por encararse con otro jugador: 2 partidos.
- Tarjeta roja por insultar o faltar al respeto al árbitro: 3 partidos.
- Tarjeta roja por una acción violenta de carácter deportivo (por ejemplo, una entrada a destiempo que ponga en peligro al rival): 4 partidos.
- Si un jugador agrede a otro, el jugador y su equipo serán expulsados de la liga de forma inmediata. El equipo perderá también la fianza.

### Otros motivos
Si el motivo no está incluido en las categorías anteriores, la dirección de la liga valorará los hechos de forma objetiva y determinará, cuando corresponda, la sanción.

## Expulsión durante el partido
Cuando el árbitro muestre una tarjeta roja, el equipo jugará con un jugador menos durante 3 minutos. Transcurrido ese tiempo, podrá incorporarse otro jugador, pero no el expulsado. El jugador expulsado deberá abandonar el campo; el juego no se reanudará hasta que lo haya hecho.

## Conducta y equipación
La liga no tolerará la violencia. Cada entrenador o capitán es responsable de la conducta de los jugadores de su equipo. Las consultas o reclamaciones sobre sanciones deberán dirigirse por los canales oficiales; no se atenderán reclamaciones enviadas en privado a los organizadores.

Al inicio de la temporada, cada equipo deberá disponer de todas sus camisetas. Por cada camiseta que falte, se aplicará un cargo equivalente al alquiler de un peto: 3,95 € por unidad (por ejemplo, 7 unidades: 27,65 €).
$information$
FROM seasons
WHERE is_active = TRUE
ON CONFLICT (season_id, section_key) DO UPDATE
SET title = EXCLUDED.title,
    content = EXCLUDED.content,
    updated_at = NOW()
WHERE BTRIM(league_section_information.content) = '';

UPDATE league_section_information
SET content = RTRIM(content) || E'\n\n' || $fianza$
## Inscripción y fianza
Cada equipo deberá abonar 700 € por la inscripción y 150 € de fianza para participar.
- La fianza se perderá si el equipo no se presenta a un partido, no reúne al menos 7 jugadores al inicio o si uno de sus jugadores agrede a un rival. La agresión también se rige por la normativa del apartado Sanciones.
- Si no se produce ninguno de estos supuestos, la fianza se devolverá al final de la temporada.
$fianza$,
    updated_at = NOW()
WHERE section_key = 'jornadas'
  AND season_id IN (SELECT id FROM seasons WHERE is_active = TRUE)
  AND BTRIM(content) <> ''
  AND content NOT LIKE '%## Inscripción y fianza%';

UPDATE league_section_information
SET title = 'Criterios de clasificación y premios',
    content = '## Criterios de clasificación' || E'\n' || REGEXP_REPLACE(BTRIM(content), '^[•*-][[:space:]]*', '- ', 'gm') || E'\n\n' || $premios$
## Premios de la temporada
### Premios de equipo
- Campeón de la Kings Durango: inscripción gratuita para la próxima temporada (valorada en 700 €), premio de Café Dromedario (pendiente de confirmar) y 300 € de la Kings Durango.
- Subcampeón de la Kings Durango: 150 €.
- Ganador de la 1.ª Fase: 100 €.
- Ganador de la Liga de Campeones: 200 €.

### Premios individuales
- Mejor jugador de la Kings Durango: 150 €.
- Trofeo Pitxitxi: 100 €.
- Trofeo Zamora: 100 €.
- Trofeo Fair Play: 100 €.
$premios$,
    updated_at = NOW()
WHERE section_key = 'clasificacion'
  AND season_id IN (SELECT id FROM seasons WHERE is_active = TRUE)
  AND BTRIM(content) <> ''
  AND content NOT LIKE '%## Premios de la temporada%';