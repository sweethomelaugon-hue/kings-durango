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
