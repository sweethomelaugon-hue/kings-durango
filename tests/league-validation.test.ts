import assert from "node:assert/strict";
import test from "node:test";

import { validateDisciplinaryRecords } from "../app/api/league/route";
import { readLeagueStore } from "../lib/league-store";

test("ignora sanciones históricas con jugadores sin plantilla y conserva las válidas", async () => {
  const store = await readLeagueStore();

  const records = validateDisciplinaryRecords(store, [
    {
      player: "J. Raya",
      team: "Gure FC",
      card: "Amarilla",
      reason: "Registro histórico sin jugador válido",
    },
    {
      player: "Aner Azpitarte Leaniz",
      team: "Aston Birras",
      card: "Roja",
      reason: "Falta grave",
    },
  ]);

  assert.equal(records.length, 1);
  assert.equal(records[0].player, "Aner Azpitarte Leaniz");
  assert.equal(records[0].team, "Aston Birras");
  assert.equal(records[0].card, "Roja");
});

test("resuelve una sanción por ID aunque el nombre enviado esté desactualizado", async () => {
  const store = await readLeagueStore();
  const team = store.teams.find((candidate) => candidate.players.length > 0);
  assert.ok(team);
  const player = team.players[0];

  const records = validateDisciplinaryRecords(store, [{
    id: 987654321,
    player: "Nombre anterior",
    playerId: player.id,
    team: team.name,
    card: "Roja",
    reason: "Falta grave",
    suspensionMatches: 4,
    suspensionRemaining: 4,
  }]);

  assert.equal(records.length, 1);
  assert.equal(records[0].player, player.name);
  assert.equal(records[0].playerId, player.id);
  assert.equal(records[0].suspensionMatches, 4);
});

test("rechaza una sanción vinculada a partido si no encuentra al jugador", async () => {
  const store = await readLeagueStore();
  const team = store.teams.find((candidate) => candidate.players.length > 0);
  assert.ok(team);

  assert.throws(() => validateDisciplinaryRecords(store, [{
    player: "Jugador que no existe",
    team: team.name,
    card: "Roja",
    reason: "Falta grave",
    matchId: "match-1",
    suspensionMatches: 4,
  }]), /no está en la plantilla/);
});

test("las rojas directas mantienen equivalencia entre euros y puntos Fair Play", async () => {
  const store = await readLeagueStore();
  const team = store.teams.find((candidate) => candidate.players.length > 0);
  assert.ok(team);
  const player = team.players[0];
  store.finances.points = { yellow: 2, doubleYellow: 4, red: 5, other: 0 };

  const records = validateDisciplinaryRecords(store, [
    "Encararse con otro jugador o juego brusco",
    "Falta de respeto al árbitro",
    "Entrada antideportiva o amenazas",
  ].map((suspensionReason, index) => ({
    id: index + 1,
    player: player.name,
    playerId: player.id,
    team: team.name,
    card: "Roja",
    reason: "Motivos antideportivos",
    suspensionReason,
    suspensionMatches: suspensionReason === "Entrada antideportiva o amenazas" ? 4 : 2,
  })));

  assert.deepEqual(records.map((record) => [record.costAmount, record.points]), [[5, 5], [5, 5], [10, 10]]);
});
