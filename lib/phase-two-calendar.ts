export type PhaseTwoGroup = "champions" | "hoyo";

export type PhaseTwoFixture = {
  time: string;
  homePosition: number;
  awayPosition: number;
  group: PhaseTwoGroup;
};

export type PhaseTwoRound = {
  title: string;
  date: string;
  fixtures: PhaseTwoFixture[];
};

const fixture = (time: string, homePosition: number, awayPosition: number, group: PhaseTwoGroup): PhaseTwoFixture => ({
  time,
  homePosition,
  awayPosition,
  group,
});

export const phaseTwoRounds: PhaseTwoRound[] = [
  {
    title: "Jornada 1",
    date: "2027-02-21",
    fixtures: [fixture("16:00", 8, 9, "hoyo"), fixture("17:00", 10, 11, "hoyo"), fixture("18:00", 7, 12, "hoyo")],
  },
  {
    title: "Jornada 2",
    date: "2027-02-28",
    fixtures: [
      fixture("15:00", 11, 12, "hoyo"), fixture("16:00", 7, 10, "hoyo"),
      fixture("17:00", 1, 4, "champions"), fixture("18:00", 2, 5, "champions"), fixture("19:00", 3, 6, "champions"),
    ],
  },
  {
    title: "Jornada 3",
    date: "2027-03-07",
    fixtures: [
      fixture("15:00", 8, 11, "hoyo"), fixture("16:00", 9, 12, "hoyo"),
      fixture("17:00", 1, 5, "champions"), fixture("18:00", 2, 6, "champions"), fixture("19:00", 3, 4, "champions"),
    ],
  },
  {
    title: "Jornada 4",
    date: "2027-03-14",
    fixtures: [
      fixture("15:00", 1, 6, "champions"), fixture("16:00", 2, 3, "champions"), fixture("17:00", 4, 5, "champions"),
      fixture("18:00", 7, 11, "hoyo"), fixture("19:00", 8, 12, "hoyo"),
    ],
  },
  {
    title: "Jornada 5",
    date: "2027-04-11",
    fixtures: [fixture("16:00", 7, 8, "hoyo"), fixture("17:00", 9, 11, "hoyo"), fixture("18:00", 10, 12, "hoyo")],
  },
  {
    title: "Jornada 6",
    date: "2027-04-18",
    fixtures: [
      fixture("15:00", 1, 3, "champions"), fixture("16:00", 2, 4, "champions"), fixture("17:00", 5, 6, "champions"),
      fixture("18:00", 7, 9, "hoyo"), fixture("19:00", 8, 10, "hoyo"),
    ],
  },
  {
    title: "Jornada 7",
    date: "2027-04-25",
    fixtures: [
      fixture("16:00", 9, 10, "hoyo"), fixture("17:00", 1, 2, "champions"),
      fixture("18:00", 3, 5, "champions"), fixture("19:00", 4, 6, "champions"),
    ],
  },
];

export const phaseTwoEvents = {
  repechage: {
    title: "Repesca",
    date: "2027-05-08",
    fixtures: [
      { time: "17:00", description: "5.º Champions vs 4.º Hoyo" },
      { time: "18:00", description: "6.º Champions vs 3.º Hoyo" },
    ],
    note: "Sorteo de playoffs: 4 equipos de Champions, los 2 ganadores de la repesca y 2 equipos de Hoyo.",
  },
  playoffs: [
    { title: "Cuartos de final", date: "2027-05-16", matches: [{ time: "16:00", label: "Partido 1" }, { time: "17:00", label: "Partido 2" }, { time: "18:00", label: "Partido 3" }, { time: "19:00", label: "Partido 4" }] },
    { title: "Semifinal", date: "2027-05-23", matches: [{ time: "17:00", label: "Partido 5" }, { time: "18:00", label: "Partido 6" }] },
    { title: "Final", date: "2027-05-29", matches: [{ time: "17:00 o 18:00", label: "Partido 7" }] },
  ],
};