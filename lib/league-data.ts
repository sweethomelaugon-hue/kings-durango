export type Player = {
  id?: string;
  teamId?: string;
  seasonId?: string;
  teamName?: string;
  name: string;
  dorsal: number | string;
  isGoalkeeper?: boolean;
};

export type Team = {
  id: string;
  name: string;
  shortName: string;
  primaryColor?: string;
  shieldImage?: string;
  players: Player[];
};

export type TeamPalette = {
  primary: string;
  secondary: string;
  accent: string;
};

export type TeamStanding = {
  position: number;
  name: string;
  played: number;
  wins: number;
  eg: number;
  ep: number;
  losses: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
  form: string[];
  positionDelta?: number;
};

export type GoalScorer = {
  player: string;
  team: string;
  minute?: number;
};

export type Match = {
  id: number;
  jornada: string;
  date: string;
  time: string;
  home: string;
  away: string;
  score: string;
  shootoutScore?: string;
  winner?: string;
  stadium: string;
  events: {
    home: string;
    away: string;
  };
  goalScorers?: GoalScorer[];
};

export type TopScorer = {
  name: string;
  team: string;
  goals: number;
  matches: number;
  positionDelta?: number;
};

export type Zamora = {
  name: string;
  team: string;
  matches: number;
  goalsAgainst: number;
  cleanSheets: number;
  average: number;
  positionDelta?: number;
};

export type DebtRecord = {
  team: string;
  amount: string;
  concept: string;
  status: "Pendiente" | "Parcial" | "Pagado";
};

export type CardRecord = {
  player: string;
  team: string;
  cards: string;
  reason: string;
};

export type CalendarMatch = {
  time: string;
  home: string;
  away: string;
  stadium?: string;
  result?: string;
  shootout?: string;
  winner?: string;
};

export type CalendarRound = {
  id: number;
  title: string;
  date: string;
  status: "completed" | "in-progress" | "upcoming";
  matches: CalendarMatch[];
  descansan: string[];
};

export type DisciplinaryRecord = {
  id: number;
  jornada?: string;
  player: string;
  team: string;
  playerId?: string;
  teamId?: string;
  card: "Amarilla" | "Doble amarilla" | "Roja" | "Otra";
  card_type?: string;
  matches: number;
  remaining: number;
  reason: string;
  suspensionReason?: string;
  suspensionMatches?: number;
  suspensionRemaining?: number;
  points?: number;
  pointsAmount?: number;
  costAmount?: number;
  cost_amount?: number;
};

export const teamColors: Record<string, TeamPalette> = {
  "Aston Birras": { primary: "#FF7E2D", secondary: "#fef3c7", accent: "#c2410c" },
  "Kalekantoi": { primary: "#B0232B", secondary: "#fecaca", accent: "#7f1d1d" },
  "Inter Panda": { primary: "#B0222E", secondary: "#fecaca", accent: "#7f1d1d" },
  "Pitxi FC": { primary: "#83512C", secondary: "#fed7aa", accent: "#5f371e" },
  "Zero Filtro": { primary: "#1D9649", secondary: "#bbf7d0", accent: "#166534" },
  "Tigres": { primary: "#F3DA13", secondary: "#fef3c7", accent: "#a16207" },
  "Lojanos": { primary: "#2E4980", secondary: "#bfdbfe", accent: "#1e3a68" },
  "Martxel Juniors": { primary: "#E21D1D", secondary: "#fecaca", accent: "#991b1b" },
  "Parceros": { primary: "#FFFAD8", secondary: "#fffef0", accent: "#d5ac50" },
  "Rayo Forestal Internacional": { primary: "#193E2C", secondary: "#bbf7d0", accent: "#0b2419" },
  "Gora Gora": { primary: "#DE81B1", secondary: "#fce7f3", accent: "#9d456f" },
  "Gure FC": { primary: "#9ED6D7", secondary: "#ecfeff", accent: "#4f9fa2" },
};

export const leagueSeedUuidMap: Record<string, string> = {
  "Aston Birras": "11111111-1111-1111-1111-111111111111",
  "Kalekantoi": "22222222-2222-2222-2222-222222222222",
  "Inter Panda": "33333333-3333-3333-3333-333333333333",
  "Pitxi FC": "44444444-4444-4444-4444-444444444444",
  "Zero Filtro": "55555555-5555-5555-5555-555555555555",
  "Tigres": "66666666-6666-6666-6666-666666666666",
};

export const teams: Team[] = [
  {
    id: "aston-birras",
    name: "Aston Birras",
    shortName: "AST",
    players: [
      { name: "Aner Azpitarte Leaniz", dorsal: "00" },
      { name: "Beñat Castilla Areitioaurtena", dorsal: 2 },
      { name: "Ibai Aldalur Sanz", dorsal: 4 },
      { name: "Aitor De La Torre Fernández", dorsal: 6 },
      { name: "Juan Ángel Piriz Zuheros", dorsal: 7 },
      { name: "Jonatan Ruiz Piriz", dorsal: 8 },
      { name: "Peru Caminos Solaguren", dorsal: 9 },
      { name: "Alain Fernandez Igarza", dorsal: 10 },
      { name: "Kristian Cayetano Vadillo", dorsal: 11 },
      { name: "Lamin Sane Sagna", dorsal: 15 },
      { name: "Mário Jorge Morgado Martins", dorsal: 17 },
      { name: "Benito Jorge Jorge", dorsal: 18 },
      { name: "Alex Mamani Alvarado", dorsal: 20 },
      { name: "Aratz Azpiri Maurtua", dorsal: 21 },
      { name: "Josu Zenitagoia Arexolaleiba", dorsal: 23 },
      { name: "Mossab Elouazzani Elmakhoud", dorsal: 30 },
    ],
  },
  {
    id: "kalekantoi",
    name: "Kalekantoi",
    shortName: "KAL",
    players: [
      { name: "Ander Cifuentes", dorsal: 1 },
      { name: "Oier Calleja", dorsal: 6 },
      { name: "Lyon Cuenca", dorsal: 7 },
      { name: "Eric Figueredo", dorsal: 9 },
      { name: "Jon Noriega", dorsal: 10 },
      { name: "Egoitz Bereziartua", dorsal: 11 },
      { name: "Iker Asategi", dorsal: 17 },
      { name: "Ander Bastida", dorsal: 19 },
      { name: "Jon Garcia", dorsal: 20 },
      { name: "Markel Rodriguez", dorsal: 22 },
      { name: "Liher Lorenzo", dorsal: 23 },
      { name: "Alex Sanchez", dorsal: 24 },
      { name: "Peio Cerro", dorsal: 25 },
      { name: "Eneko Usategi", dorsal: 44 },
      { name: "Haimar Otxoa", dorsal: 45 },
      { name: "Aimar Torres", dorsal: 69 },
      { name: "Iñaki Iglesias", dorsal: 80 },
    ],
  },
  {
    id: "inter-panda",
    name: "Inter Panda",
    shortName: "INT",
    players: [
      { name: "David Xu Zhou", dorsal: 2 },
      { name: "Jon Barahona García", dorsal: 3 },
      { name: "Beñat Etxebarria Uranga", dorsal: 4 },
      { name: "Iker González García", dorsal: 5 },
      { name: "Raúl Gallo Galerón", dorsal: 7 },
      { name: "Ibra Sane", dorsal: 8 },
      { name: "Aitor Setien Aguirre", dorsal: 9 },
      { name: "Ander Pérez", dorsal: 11 },
      { name: "Milton Melgar Muñoz", dorsal: 14 },
      { name: "Egoitz Vazquez Barragan", dorsal: 15 },
      { name: "Joseba Valladares Santibañez", dorsal: 16 },
      { name: "David Vilumbrales Gómez", dorsal: 19 },
      { name: "Dani Xu Zhou", dorsal: 21 },
      { name: "Sergio Zapatero Crespo", dorsal: 26 },
      { name: "Mikel Velasco Eguen", dorsal: 33 },
    ],
  },
  {
    id: "pitxi-fc",
    name: "Pitxi FC",
    shortName: "PIT",
    players: [
      { name: "Omar Bouchlaghem", dorsal: 1 },
      { name: "Aimar Sevilla", dorsal: 4 },
      { name: "Daniel Jorge", dorsal: 5 },
      { name: "Yassine Taouil", dorsal: 6 },
      { name: "Hamsa Belaidi", dorsal: 7 },
      { name: "Oier Ruiz", dorsal: 8 },
      { name: "El Mostafa El Arbaoui", dorsal: 9 },
      { name: "Anas Belaidi", dorsal: 10 },
      { name: "Nicolás Baruja", dorsal: 11 },
      { name: "Kevin Sierra", dorsal: 13 },
      { name: "Arkaitz Sepúlveda", dorsal: 14 },
      { name: "Eihar Igartua", dorsal: 20 },
      { name: "Joseph Diatta", dorsal: 21 },
      { name: "Unax Osuna", dorsal: 22 },
      { name: "Urko Iza", dorsal: 25 },
      { name: "Ivan Sierra", dorsal: 30 },
      { name: "Eneko Manzano", dorsal: 69 },
    ],
  },
  {
    id: "zero-filtro",
    name: "Zero Filtro",
    shortName: "ZEF",
    players: [
      { name: "Ignacio Cruzado", dorsal: 0 },
      { name: "Aritz Alberdi", dorsal: 1 },
      { name: "Jon Tinoko", dorsal: 2 },
      { name: "Juan Gogeascoechea", dorsal: 4 },
      { name: "Asier Zenikaonandia", dorsal: 6 },
      { name: "Adrián Vicandi", dorsal: 7 },
      { name: "Eder Asategi", dorsal: 8 },
      { name: "Guillermo Zugaza", dorsal: 9 },
      { name: "Ander Santos", dorsal: 10 },
      { name: "Eder del Valle", dorsal: 11 },
      { name: "Markel Zenikaonandia", dorsal: 13 },
      { name: "Javier Atutxa", dorsal: 15 },
      { name: "Javier Alonso", dorsal: 18 },
      { name: "Gorka Iglesias", dorsal: 21 },
      { name: "Pelayo Pereira", dorsal: 22 },
      { name: "Niko Capelastegui", dorsal: 45 },
      { name: "Iñaki Bidarte", dorsal: 97 },
    ],
  },
  {
    id: "tigres",
    name: "Tigres",
    shortName: "TIG",
    players: [
      { name: "Víctor Cardona", dorsal: 1 },
      { name: "Jonathan Sisalima", dorsal: 2 },
      { name: "Diego Cordoba", dorsal: 4 },
      { name: "Julen Tejón", dorsal: 5 },
      { name: "Andres Quevedo", dorsal: 6 },
      { name: "Jonathan Nsue Nchama", dorsal: 7 },
      { name: "Steven Valencia", dorsal: 8 },
      { name: "Kevin Criollo Vivanco", dorsal: 9 },
      { name: "Patxi Criollo", dorsal: 10 },
      { name: "José María Moreno Zamora", dorsal: 11 },
      { name: "Javier Rivera", dorsal: 12 },
      { name: "Camilo Jaramillo", dorsal: 13 },
      { name: "Jon Ander Vivanco Rubia", dorsal: 15 },
      { name: "Jorge Mora", dorsal: 17 },
      { name: "Iván Sao Roque Mateus", dorsal: 23 },
      { name: "Hugo Da Silva", dorsal: 28 },
      { name: "Jhonier Criollo Obaco", dorsal: 30 },
    ],
  },
  {
    id: "lojanos",
    name: "Lojanos",
    shortName: "LOJ",
    players: [
      { name: "Anthony Rueda", dorsal: "00" },
      { name: "Dorian Aponte", dorsal: 1 },
      { name: "Javier Zalduegui", dorsal: 3 },
      { name: "Limbert Trujillo", dorsal: 5 },
      { name: "Asier López", dorsal: 6 },
      { name: "Julen Uchuari", dorsal: 7 },
      { name: "Jeyson Rueda", dorsal: 8 },
      { name: "Ivan Andrade", dorsal: 9 },
      { name: "Carlos Quevedo", dorsal: 10 },
      { name: "Carlos Daniel", dorsal: 11 },
      { name: "Alejandro Cabrera", dorsal: 12 },
      { name: "Patricio Tonguino", dorsal: 14 },
      { name: "Ander Torres", dorsal: 21 },
      { name: "Javier Valdiviezo", dorsal: 22 },
      { name: "Aitor Parada", dorsal: 23 },
      { name: "José Luis Torres", dorsal: 25 },
      { name: "Cristian Torres", dorsal: 80 },
    ],
  },
  {
    id: "martxel-juniors",
    name: "Martxel Juniors",
    shortName: "MAR",
    players: [
      { name: "Eneko Calvo", dorsal: 2 },
      { name: "Oier de Arriba", dorsal: 3 },
      { name: "Paul de Arriba", dorsal: 5 },
      { name: "Iker Reneo", dorsal: 6 },
      { name: "Javi Jauregui", dorsal: 7 },
      { name: "Ekain Montecelo", dorsal: 8 },
      { name: "Ekain Atutxa", dorsal: 9 },
      { name: "Santiago Martinez", dorsal: 10 },
      { name: "Iker Molina", dorsal: 11 },
      { name: "Danel Barrutia", dorsal: 13 },
      { name: "Unax Diaz", dorsal: 17 },
      { name: "Xabier Urretxa", dorsal: 20 },
      { name: "Julen Perez", dorsal: 21 },
      { name: "Julen Tapiz", dorsal: 77 },
      { name: "Paul Molina", dorsal: 33 },
      { name: "Beñat Mendibe", dorsal: 66 },
      { name: "Ekain Odriozola", dorsal: 90 },
    ],
  },
  {
    id: "parceros",
    name: "Parceros",
    shortName: "PAR",
    players: [
      { name: "Julen Benito", dorsal: 1 },
      { name: "Andres León", dorsal: 5 },
      { name: "Santiago Gallego", dorsal: 6 },
      { name: "Javi Vega", dorsal: 7 },
      { name: "Juanjo Valencia", dorsal: 8 },
      { name: "Josué Cardoza", dorsal: 9 },
      { name: "Henry Trujillo", dorsal: 10 },
      { name: "Kell Reyes", dorsal: 11 },
      { name: "Maicol Sánchez", dorsal: 12 },
      { name: "Diego Bejarano", dorsal: 13 },
      { name: "Johao Reyes", dorsal: 24 },
      { name: "Cristian Díaz", dorsal: 30 },
      { name: "Jheiner Almeida", dorsal: 80 },
      { name: "Wilson Henao", dorsal: 88 },
    ],
  },
  {
    id: "rayo-forestal",
    name: "Rayo Forestal Internacional",
    shortName: "RFI",
    players: [
      { name: "Hamid Jaafari", dorsal: 1 },
      { name: "Hugo Marin", dorsal: 5 },
      { name: "Asier Legido", dorsal: 6 },
      { name: "Dylan Marin", dorsal: 7 },
      { name: "Alejandro Marin", dorsal: 8 },
      { name: "Jonathan Bolívar", dorsal: 9 },
      { name: "Pablo Fidalgo", dorsal: 10 },
      { name: "Bernat Robledo", dorsal: 11 },
      { name: "Junior José Castillo Lara", dorsal: 14 },
      { name: "Luis Miguel Sarmiento", dorsal: 16 },
      { name: "Luis Miguel Criollo Vivanco", dorsal: 17 },
      { name: "Edval Da Silva Nascimento", dorsal: 18 },
      { name: "Carlos Lagos", dorsal: 19 },
      { name: "Mikel Ortega", dorsal: 21 },
      { name: "Jose Manuel Orol", dorsal: 28 },
      { name: "Martin Pereira", dorsal: 33 },
      { name: "Jonatan Gomes Martín", dorsal: 99 },
    ],
  },
  {
    id: "gora-gora",
    name: "Gora Gora",
    shortName: "GOR",
    players: [
      { name: "Javier Castrillo Sampedro", dorsal: 0 },
      { name: "Edorta Olabarrieta Rodríguez", dorsal: 2 },
      { name: "Igor Arana Amado", dorsal: 3 },
      { name: "Jon Carracedo Lopez", dorsal: 5 },
      { name: "Iker Pinilla Perez", dorsal: 7 },
      { name: "Aitor Mendilibar Otamendi", dorsal: 8 },
      { name: "Roberto Barquín Aguirre", dorsal: 9 },
      { name: "Kevin Doyle Martinez", dorsal: 10 },
      { name: "Aitzol Arregi Arruabarrena", dorsal: 11 },
      { name: "Unai Azkune Ansa", dorsal: 13 },
      { name: "Xabier Bilbao Bilbao", dorsal: 14 },
      { name: "Aitor Martinez Barrutieta", dorsal: 18 },
      { name: "Raúl Ramos García", dorsal: 19 },
      { name: "Nestor Ibañez González", dorsal: 21 },
      { name: "Jon Ander Navarro Goikoetxea", dorsal: 30 },
      { name: "Kepa Uriarteb Amantegui", dorsal: 37 },
      { name: "Adrián Abasolo Amantegui", dorsal: 69 },
    ],
  },
  {
    id: "gure-fc",
    name: "Gure FC",
    shortName: "GUR",
    players: [
      { name: "Gorka Zabala Goienetxea", dorsal: 1 },
      { name: "Ekain Sarriugarte Irisarri", dorsal: 4 },
      { name: "Alvaro Oñate Erdoiza", dorsal: 6 },
      { name: "Oier Costana Derteano", dorsal: 7 },
      { name: "Urtzi Etxebarrieta Ruiz de Loizaga", dorsal: 8 },
      { name: "Oier Acosta Jayo", dorsal: 9 },
      { name: "Manex Asategi Arrondo", dorsal: 10 },
      { name: "Unai Barrutia Ruiz", dorsal: 13 },
      { name: "Xabi Arbonies Jauregi", dorsal: 14 },
      { name: "Urko Sarriugarte Irisarri", dorsal: 17 },
      { name: "Pello Bengoa Meabe", dorsal: 18 },
      { name: "Peru Arestu Gabiola", dorsal: 19 },
      { name: "Ekaitz Larrinaga Madariaga", dorsal: 20 },
      { name: "Ander Bejarano Martin", dorsal: 21 },
      { name: "Iker Ortega Arquellada", dorsal: 66 },
      { name: "Bradcol Nyarko Behelo", dorsal: 77 },
      { name: "Unai Duran Turienzo", dorsal: 80 },
    ],
  },
];

export const standings: TeamStanding[] = [
  { position: 1, name: "Aston Birras", played: 5, wins: 4, eg: 1, ep: 0, losses: 0, gf: 12, ga: 5, gd: 7, points: 13, form: ["G", "G", "EG", "G", "G"], positionDelta: 2 },
  { position: 2, name: "Kalekantoi", played: 5, wins: 3, eg: 1, ep: 0, losses: 1, gf: 9, ga: 6, gd: 3, points: 10, form: ["G", "P", "G", "G", "EG"], positionDelta: -1 },
  { position: 3, name: "Inter Panda", played: 5, wins: 3, eg: 1, ep: 0, losses: 1, gf: 10, ga: 7, gd: 3, points: 10, form: ["EG", "G", "G", "P", "G"], positionDelta: 1 },
  { position: 4, name: "Gure FC", played: 5, wins: 3, eg: 1, ep: 0, losses: 1, gf: 8, ga: 6, gd: 2, points: 10, form: ["G", "G", "P", "G", "EG"], positionDelta: 3 },
  { position: 5, name: "Zero Filtro", played: 5, wins: 2, eg: 0, ep: 2, losses: 1, gf: 9, ga: 8, gd: 1, points: 8, form: ["G", "EG", "P", "G", "EP"], positionDelta: -2 },
  { position: 6, name: "Tigres", played: 5, wins: 2, eg: 1, ep: 0, losses: 2, gf: 7, ga: 8, gd: -1, points: 7, form: ["P", "G", "EG", "P", "G"], positionDelta: 0 },
  { position: 7, name: "Lojanos", played: 5, wins: 1, eg: 0, ep: 2, losses: 2, gf: 6, ga: 9, gd: -3, points: 5, form: ["EP", "P", "G", "EP", "P"], positionDelta: -1 },
  { position: 8, name: "Martxel Juniors", played: 5, wins: 1, eg: 0, ep: 1, losses: 3, gf: 7, ga: 9, gd: -2, points: 4, form: ["P", "G", "P", "EP", "P"], positionDelta: -2 },
  { position: 9, name: "Parceros", played: 5, wins: 1, eg: 0, ep: 2, losses: 2, gf: 8, ga: 10, gd: -2, points: 5, form: ["EP", "P", "G", "EP", "P"], positionDelta: 1 },
  { position: 10, name: "Rayo Forestal Internacional", played: 5, wins: 1, eg: 0, ep: 1, losses: 3, gf: 8, ga: 11, gd: -3, points: 4, form: ["P", "P", "EP", "G", "P"], positionDelta: -1 },
  { position: 11, name: "Gora Gora", played: 5, wins: 1, eg: 0, ep: 1, losses: 3, gf: 6, ga: 11, gd: -5, points: 4, form: ["P", "G", "P", "P", "EP"], positionDelta: 1 },
  { position: 12, name: "Pitxi FC", played: 5, wins: 0, eg: 0, ep: 2, losses: 3, gf: 5, ga: 11, gd: -6, points: 2, form: ["P", "EP", "P", "EP", "P"], positionDelta: -2 },
];

export const matches: Match[] = [
  { id: 1, jornada: "Jornada 1", date: "20 sep 2026", time: "15:00", home: "Aston Birras", away: "Kalekantoi", score: "2 - 1", stadium: "Tabira", events: { home: "G. Ramos 18', R. Soler 73'", away: "D. Salgado 81'" } },
  { id: 2, jornada: "Jornada 1", date: "20 sep 2026", time: "16:00", home: "Inter Panda", away: "Parceros", score: "1 - 0", stadium: "Tabira", events: { home: "J. Cuevas 66'", away: "" } },
  { id: 3, jornada: "Jornada 1", date: "20 sep 2026", time: "17:00", home: "Gure FC", away: "Pitxi FC", score: "2 - 2", shootoutScore: "5 - 4", winner: "Gure FC", stadium: "Tabira", events: { home: "P. Tena 11', 63'", away: "J. Gómez 27', 59'" } },
  { id: 4, jornada: "Jornada 1", date: "20 sep 2026", time: "18:00", home: "Zero Filtro", away: "Gora Gora", score: "1 - 1", shootoutScore: "4 - 2", winner: "Zero Filtro", stadium: "Tabira", events: { home: "A. Díaz 71'", away: "I. Baeza 82'" } },
  { id: 5, jornada: "Jornada 1", date: "20 sep 2026", time: "19:00", home: "Rayo Forestal Internacional", away: "Tigres", score: "2 - 3", stadium: "Tabira", events: { home: "K. Romero 34', 50'", away: "B. Ibarra 17', 74', 90'" } },
  { id: 6, jornada: "Jornada 2", date: "4 oct 2026", time: "15:00", home: "Pitxi FC", away: "Rayo Forestal Internacional", score: "0 - 2", stadium: "Tabira", events: { home: "", away: "K. Romero 41', 77'" } },
  { id: 7, jornada: "Jornada 2", date: "4 oct 2026", time: "16:00", home: "Kalekantoi", away: "Martxel Juniors", score: "3 - 1", stadium: "Tabira", events: { home: "D. Salgado 13', 55', 80'", away: "M. Arostegui 48'" } },
  { id: 8, jornada: "Jornada 2", date: "4 oct 2026", time: "17:00", home: "Gora Gora", away: "Lojanos", score: "2 - 1", stadium: "Tabira", events: { home: "I. Baeza 22', 65'", away: "C. Daniel 70'" } },
  { id: 9, jornada: "Jornada 2", date: "4 oct 2026", time: "18:00", home: "Parceros", away: "Aston Birras", score: "1 - 3", stadium: "Tabira", events: { home: "E. Aramendi 83'", away: "G. Ramos 24', 68', 88'" } },
  { id: 10, jornada: "Jornada 2", date: "4 oct 2026", time: "19:00", home: "Inter Panda", away: "Tigres", score: "2 - 1", stadium: "Tabira", events: { home: "J. Cuevas 12', 76'", away: "B. Ibarra 90'" } },
  { id: 11, jornada: "Jornada 3", date: "25 oct 2026", time: "15:00", home: "Zero Filtro", away: "Tigres", score: "2 - 0", stadium: "Tabira", events: { home: "A. Díaz 21', 51'", away: "" } },
  { id: 12, jornada: "Jornada 3", date: "25 oct 2026", time: "16:00", home: "Rayo Forestal Internacional", away: "Lojanos", score: "1 - 1", shootoutScore: "3 - 2", winner: "Rayo Forestal Internacional", stadium: "Tabira", events: { home: "K. Romero 45'", away: "C. Daniel 67'" } },
  { id: 13, jornada: "Jornada 3", date: "25 oct 2026", time: "17:00", home: "Aston Birras", away: "Martxel Juniors", score: "3 - 0", stadium: "Tabira", events: { home: "G. Ramos 17', 44', 90'", away: "" } },
  { id: 14, jornada: "Jornada 3", date: "25 oct 2026", time: "18:00", home: "Gure FC", away: "Kalekantoi", score: "1 - 2", stadium: "Tabira", events: { home: "P. Tena 75'", away: "D. Salgado 31', 71'" } },
  { id: 15, jornada: "Jornada 3", date: "25 oct 2026", time: "19:00", home: "Parceros", away: "Gora Gora", score: "2 - 2", shootoutScore: "2 - 4", winner: "Gora Gora", stadium: "Tabira", events: { home: "E. Aramendi 9', 53'", away: "I. Baeza 38', 78'" } },
  { id: 16, jornada: "Jornada 4", date: "8 nov 2026", time: "15:00", home: "Parceros", away: "Lojanos", score: "1 - 1", shootoutScore: "4 - 3", winner: "Parceros", stadium: "Tabira", events: { home: "E. Aramendi 58'", away: "J. Rueda 62'" } },
  { id: 17, jornada: "Jornada 4", date: "8 nov 2026", time: "16:00", home: "Zero Filtro", away: "Aston Birras", score: "2 - 2", shootoutScore: "5 - 4", winner: "Zero Filtro", stadium: "Tabira", events: { home: "A. Díaz 21', 69'", away: "G. Ramos 40', 82'" } },
  { id: 18, jornada: "Jornada 4", date: "8 nov 2026", time: "17:00", home: "Inter Panda", away: "Kalekantoi", score: "0 - 1", stadium: "Tabira", events: { home: "", away: "D. Salgado 51'" } },
  { id: 19, jornada: "Jornada 4", date: "8 nov 2026", time: "18:00", home: "Pitxi FC", away: "Martxel Juniors", score: "2 - 1", stadium: "Tabira", events: { home: "J. Gómez 18', 49'", away: "M. Arostegui 61'" } },
  { id: 20, jornada: "Jornada 4", date: "8 nov 2026", time: "19:00", home: "Gure FC", away: "Rayo Forestal Internacional", score: "1 - 3", stadium: "Tabira", events: { home: "P. Tena 72'", away: "K. Romero 12', 48', 88'" } },
  { id: 21, jornada: "Jornada 5", date: "15 nov 2026", time: "16:00", home: "Gora Gora", away: "Tigres", score: "1 - 1", shootoutScore: "4 - 5", winner: "Tigres", stadium: "Tabira", events: { home: "I. Baeza 39'", away: "B. Ibarra 75'" } },
  { id: 22, jornada: "Jornada 5", date: "15 nov 2026", time: "17:00", home: "Aston Birras", away: "Rayo Forestal Internacional", score: "2 - 2", shootoutScore: "4 - 2", winner: "Aston Birras", stadium: "Tabira", events: { home: "G. Ramos 19', 80'", away: "K. Romero 41', 70'" } },
  { id: 23, jornada: "Jornada 5", date: "15 nov 2026", time: "18:00", home: "Inter Panda", away: "Pitxi FC", score: "1 - 1", shootoutScore: "5 - 4", winner: "Inter Panda", stadium: "Tabira", events: { home: "J. Cuevas 64'", away: "J. Gómez 58'" } },
  { id: 24, jornada: "Jornada 5", date: "15 nov 2026", time: "19:00", home: "Lojanos", away: "Martxel Juniors", score: "1 - 2", stadium: "Tabira", events: { home: "C. Daniel 52'", away: "M. Arostegui 33', 77'" } },
  { id: 25, jornada: "Jornada 6", date: "22 nov 2026", time: "16:00", home: "Gure FC", away: "Zero Filtro", score: "-", stadium: "Tabira", events: { home: "", away: "" } },
  { id: 26, jornada: "Jornada 6", date: "22 nov 2026", time: "17:00", home: "Inter Panda", away: "Lojanos", score: "-", stadium: "Tabira", events: { home: "", away: "" } },
  { id: 27, jornada: "Jornada 6", date: "22 nov 2026", time: "18:00", home: "Kalekantoi", away: "Parceros", score: "-", stadium: "Tabira", events: { home: "", away: "" } },
  { id: 28, jornada: "Jornada 6", date: "22 nov 2026", time: "19:00", home: "Aston Birras", away: "Pitxi FC", score: "-", stadium: "Tabira", events: { home: "", away: "" } },
  { id: 29, jornada: "Jornada 7", date: "29 nov 2026", time: "16:00", home: "Inter Panda", away: "Martxel Juniors", score: "-", stadium: "Tabira", events: { home: "", away: "" } },
  { id: 30, jornada: "Jornada 7", date: "29 nov 2026", time: "17:00", home: "Kalekantoi", away: "Rayo Forestal Internacional", score: "-", stadium: "Tabira", events: { home: "", away: "" } },
  { id: 31, jornada: "Jornada 7", date: "29 nov 2026", time: "18:00", home: "Gora Gora", away: "Aston Birras", score: "-", stadium: "Tabira", events: { home: "", away: "" } },
  { id: 32, jornada: "Jornada 7", date: "29 nov 2026", time: "19:00", home: "Pitxi FC", away: "Zero Filtro", score: "-", stadium: "Tabira", events: { home: "", away: "" } },
  { id: 33, jornada: "Jornada 8", date: "13 dec 2026", time: "16:00", home: "Parceros", away: "Gure FC", score: "-", stadium: "Tabira", events: { home: "", away: "" } },
  { id: 34, jornada: "Jornada 8", date: "13 dec 2026", time: "17:00", home: "Martxel Juniors", away: "Gora Gora", score: "-", stadium: "Tabira", events: { home: "", away: "" } },
  { id: 35, jornada: "Jornada 8", date: "13 dec 2026", time: "18:00", home: "Tigres", away: "Lojanos", score: "-", stadium: "Tabira", events: { home: "", away: "" } },
  { id: 36, jornada: "Jornada 8", date: "13 dec 2026", time: "19:00", home: "Rayo Forestal Internacional", away: "Zero Filtro", score: "-", stadium: "Tabira", events: { home: "", away: "" } },
  { id: 37, jornada: "Jornada 9", date: "20 dec 2026", time: "15:00", home: "Inter Panda", away: "Gora Gora", score: "-", stadium: "Tabira", events: { home: "", away: "" } },
  { id: 38, jornada: "Jornada 9", date: "20 dec 2026", time: "16:00", home: "Pitxi FC", away: "Kalekantoi", score: "-", stadium: "Tabira", events: { home: "", away: "" } },
  { id: 39, jornada: "Jornada 9", date: "20 dec 2026", time: "17:00", home: "Parceros", away: "Tigres", score: "-", stadium: "Tabira", events: { home: "", away: "" } },
  { id: 40, jornada: "Jornada 9", date: "20 dec 2026", time: "18:00", home: "Gure FC", away: "Martxel Juniors", score: "-", stadium: "Tabira", events: { home: "", away: "" } },
  { id: 41, jornada: "Jornada 9", date: "20 dec 2026", time: "19:00", home: "Zero Filtro", away: "Lojanos", score: "-", stadium: "Tabira", events: { home: "", away: "" } },
  { id: 42, jornada: "Jornada 10", date: "10 jan 2027", time: "15:00", home: "Lojanos", away: "Gure FC", score: "-", stadium: "Tabira", events: { home: "", away: "" } },
  { id: 43, jornada: "Jornada 10", date: "10 jan 2027", time: "16:00", home: "Tigres", away: "Pitxi FC", score: "-", stadium: "Tabira", events: { home: "", away: "" } },
  { id: 44, jornada: "Jornada 10", date: "10 jan 2027", time: "17:00", home: "Martxel Juniors", away: "Parceros", score: "-", stadium: "Tabira", events: { home: "", away: "" } },
  { id: 45, jornada: "Jornada 10", date: "10 jan 2027", time: "18:00", home: "Kalekantoi", away: "Gora Gora", score: "-", stadium: "Tabira", events: { home: "", away: "" } },
  { id: 46, jornada: "Jornada 10", date: "10 jan 2027", time: "19:00", home: "Inter Panda", away: "Aston Birras", score: "-", stadium: "Tabira", events: { home: "", away: "" } },
  { id: 47, jornada: "Jornada 11", date: "17 jan 2027", time: "15:00", home: "Martxel Juniors", away: "Rayo Forestal Internacional", score: "-", stadium: "Tabira", events: { home: "", away: "" } },
  { id: 48, jornada: "Jornada 11", date: "17 jan 2027", time: "16:00", home: "Tigres", away: "Aston Birras", score: "-", stadium: "Tabira", events: { home: "", away: "" } },
  { id: 49, jornada: "Jornada 11", date: "17 jan 2027", time: "17:00", home: "Kalekantoi", away: "Zero Filtro", score: "-", stadium: "Tabira", events: { home: "", away: "" } },
  { id: 50, jornada: "Jornada 11", date: "17 jan 2027", time: "18:00", home: "Pitxi FC", away: "Parceros", score: "-", stadium: "Tabira", events: { home: "", away: "" } },
  { id: 51, jornada: "Jornada 11", date: "17 jan 2027", time: "19:00", home: "Gora Gora", away: "Gure FC", score: "-", stadium: "Tabira", events: { home: "", away: "" } },
  { id: 52, jornada: "Jornada 12", date: "24 jan 2027", time: "15:00", home: "Martxel Juniors", away: "Zero Filtro", score: "-", stadium: "Tabira", events: { home: "", away: "" } },
  { id: 53, jornada: "Jornada 12", date: "24 jan 2027", time: "16:00", home: "Lojanos", away: "Aston Birras", score: "-", stadium: "Tabira", events: { home: "", away: "" } },
  { id: 54, jornada: "Jornada 12", date: "24 jan 2027", time: "17:00", home: "Tigres", away: "Gure FC", score: "-", stadium: "Tabira", events: { home: "", away: "" } },
  { id: 55, jornada: "Jornada 12", date: "24 jan 2027", time: "18:00", home: "Inter Panda", away: "Rayo Forestal Internacional", score: "-", stadium: "Tabira", events: { home: "", away: "" } },
  { id: 56, jornada: "Jornada 12", date: "24 jan 2027", time: "19:00", home: "Gora Gora", away: "Pitxi FC", score: "-", stadium: "Tabira", events: { home: "", away: "" } },
  { id: 57, jornada: "Jornada 13", date: "31 jan 2027", time: "15:00", home: "Inter Panda", away: "Gure FC", score: "-", stadium: "Tabira", events: { home: "", away: "" } },
  { id: 58, jornada: "Jornada 13", date: "31 jan 2027", time: "16:00", home: "Rayo Forestal Internacional", away: "Gora Gora", score: "-", stadium: "Tabira", events: { home: "", away: "" } },
  { id: 59, jornada: "Jornada 13", date: "31 jan 2027", time: "17:00", home: "Zero Filtro", away: "Parceros", score: "-", stadium: "Tabira", events: { home: "", away: "" } },
  { id: 60, jornada: "Jornada 13", date: "31 jan 2027", time: "18:00", home: "Martxel Juniors", away: "Tigres", score: "-", stadium: "Tabira", events: { home: "", away: "" } },
  { id: 61, jornada: "Jornada 13", date: "31 jan 2027", time: "19:00", home: "Lojanos", away: "Kalekantoi", score: "-", stadium: "Tabira", events: { home: "", away: "" } },
  { id: 62, jornada: "Jornada 14", date: "7 feb 2027", time: "15:00", home: "Tigres", away: "Kalekantoi", score: "-", stadium: "Tabira", events: { home: "", away: "" } },
  { id: 63, jornada: "Jornada 14", date: "7 feb 2027", time: "16:00", home: "Rayo Forestal Internacional", away: "Parceros", score: "-", stadium: "Tabira", events: { home: "", away: "" } },
  { id: 64, jornada: "Jornada 14", date: "7 feb 2027", time: "17:00", home: "Lojanos", away: "Pitxi FC", score: "-", stadium: "Tabira", events: { home: "", away: "" } },
  { id: 65, jornada: "Jornada 14", date: "7 feb 2027", time: "18:00", home: "Inter Panda", away: "Zero Filtro", score: "-", stadium: "Tabira", events: { home: "", away: "" } },
  { id: 66, jornada: "Jornada 14", date: "7 feb 2027", time: "19:00", home: "Aston Birras", away: "Gure FC", score: "-", stadium: "Tabira", events: { home: "", away: "" } },
];

export const topScorers: TopScorer[] = [
  { name: "G. Ramos", team: "Aston Birras", goals: 11, matches: 12, positionDelta: 1 },
  { name: "D. Salgado", team: "Kalekantoi", goals: 10, matches: 11, positionDelta: -1 },
  { name: "A. Díaz", team: "Zero Filtro", goals: 9, matches: 12, positionDelta: 2 },
  { name: "N. Silva", team: "Aston Birras", goals: 8, matches: 12, positionDelta: 0 },
  { name: "J. Cuevas", team: "Inter Panda", goals: 8, matches: 11, positionDelta: -2 },
];

export const allScorers: TopScorer[] = [
  { name: "G. Ramos", team: "Aston Birras", goals: 11, matches: 12, positionDelta: 1 },
  { name: "D. Salgado", team: "Kalekantoi", goals: 10, matches: 11, positionDelta: -1 },
  { name: "A. Díaz", team: "Zero Filtro", goals: 9, matches: 12, positionDelta: 2 },
  { name: "N. Silva", team: "Aston Birras", goals: 8, matches: 12, positionDelta: 0 },
  { name: "J. Cuevas", team: "Inter Panda", goals: 8, matches: 11, positionDelta: -2 },
  { name: "J. Gómez", team: "Pitxi FC", goals: 7, matches: 11, positionDelta: 1 },
  { name: "P. Tena", team: "Gure FC", goals: 7, matches: 12, positionDelta: -1 },
  { name: "K. Romero", team: "Rayo Forestal Internacional", goals: 6, matches: 10, positionDelta: 2 },
  { name: "I. Baeza", team: "Gora Gora", goals: 6, matches: 10, positionDelta: -1 },
  { name: "M. Arostegui", team: "Martxel Juniors", goals: 5, matches: 9, positionDelta: 1 },
  { name: "E. Aramendi", team: "Parceros", goals: 5, matches: 9, positionDelta: -2 },
  { name: "B. Ibarra", team: "Tigres", goals: 4, matches: 8, positionDelta: 0 },
];

export const zamora: Zamora[] = [
  { name: "I. Márquez", team: "Aston Birras", matches: 12, goalsAgainst: 8, cleanSheets: 7, average: 0.67, positionDelta: 1 },
  { name: "R. Cárdenas", team: "Kalekantoi", matches: 11, goalsAgainst: 10, cleanSheets: 6, average: 0.91, positionDelta: -1 },
  { name: "T. Benítez", team: "Tigres", matches: 12, goalsAgainst: 11, cleanSheets: 5, average: 0.92, positionDelta: 2 },
  { name: "M. Pons", team: "Inter Panda", matches: 12, goalsAgainst: 14, cleanSheets: 4, average: 1.17, positionDelta: -2 },
  { name: "A. León", team: "Zero Filtro", matches: 12, goalsAgainst: 16, cleanSheets: 3, average: 1.33, positionDelta: 0 },
];

export const debtRecords: DebtRecord[] = [
  { team: "Gure FC", amount: "€420", concept: "Alquiler y material", status: "Pendiente" },
  { team: "Zero Filtro", amount: "€180", concept: "Inscripción y arbitraje", status: "Parcial" },
  { team: "Parceros", amount: "€0", concept: "Sin deuda", status: "Pagado" },
  { team: "Aston Birras", amount: "€260", concept: "Traslado y logística", status: "Pendiente" },
];

export const cardRecords: CardRecord[] = [
  { player: "J. Raya", team: "Gure FC", cards: "2 amarillas", reason: "Faltas acumuladas" },
  { player: "M. Domínguez", team: "Kalekantoi", cards: "1 roja", reason: "Entrada peligrosa" },
  { player: "P. Lugo", team: "Zero Filtro", cards: "3 amarillas", reason: "Acumulación" },
  { player: "L. Ortega", team: "Inter Panda", cards: "1 amarilla", reason: "Empujón" },
];

export const calendar: CalendarRound[] = [
  { id: 1, title: "Jornada 1", date: "2026-09-20", status: "completed", matches: [
    { time: "15:00", home: "Aston Birras", away: "Kalekantoi", stadium: "Tabira" },
    { time: "16:00", home: "Inter Panda", away: "Parceros", stadium: "Tabira" },
    { time: "17:00", home: "Gure FC", away: "Pitxi FC", stadium: "Tabira" },
    { time: "18:00", home: "Zero Filtro", away: "Gora Gora", stadium: "Tabira" },
    { time: "19:00", home: "Rayo Forestal Internacional", away: "Tigres", stadium: "Tabira" },
  ], descansan: ["Lojanos", "Martxel Juniors"] },
  { id: 2, title: "Jornada 2", date: "2026-10-04", status: "completed", matches: [
    { time: "15:00", home: "Pitxi FC", away: "Rayo Forestal Internacional", stadium: "Tabira" },
    { time: "16:00", home: "Kalekantoi", away: "Martxel Juniors", stadium: "Tabira" },
    { time: "17:00", home: "Gora Gora", away: "Lojanos", stadium: "Tabira" },
    { time: "18:00", home: "Parceros", away: "Aston Birras", stadium: "Tabira" },
    { time: "19:00", home: "Inter Panda", away: "Tigres", stadium: "Tabira" },
  ], descansan: ["Gure FC", "Zero Filtro"] },
  { id: 3, title: "Jornada 3", date: "2026-10-25", status: "completed", matches: [
    { time: "15:00", home: "Zero Filtro", away: "Tigres", stadium: "Tabira" },
    { time: "16:00", home: "Rayo Forestal Internacional", away: "Lojanos", stadium: "Tabira" },
    { time: "17:00", home: "Aston Birras", away: "Martxel Juniors", stadium: "Tabira" },
    { time: "18:00", home: "Gure FC", away: "Kalekantoi", stadium: "Tabira" },
    { time: "19:00", home: "Parceros", away: "Gora Gora", stadium: "Tabira" },
  ], descansan: ["Inter Panda", "Pitxi FC"] },
  { id: 4, title: "Jornada 4", date: "2026-11-08", status: "completed", matches: [
    { time: "15:00", home: "Parceros", away: "Lojanos", stadium: "Tabira" },
    { time: "16:00", home: "Zero Filtro", away: "Aston Birras", stadium: "Tabira" },
    { time: "17:00", home: "Inter Panda", away: "Kalekantoi", stadium: "Tabira" },
    { time: "18:00", home: "Pitxi FC", away: "Martxel Juniors", stadium: "Tabira" },
    { time: "19:00", home: "Gure FC", away: "Rayo Forestal Internacional", stadium: "Tabira" },
  ], descansan: ["Gora Gora", "Tigres"] },
  { id: 5, title: "Jornada 5", date: "2026-11-15", status: "in-progress", matches: [
    { time: "16:00", home: "Gora Gora", away: "Tigres", stadium: "Tabira" },
    { time: "17:00", home: "Aston Birras", away: "Rayo Forestal Internacional", stadium: "Tabira" },
    { time: "18:00", home: "Inter Panda", away: "Pitxi FC", stadium: "Tabira" },
    { time: "19:00", home: "Lojanos", away: "Martxel Juniors", stadium: "Tabira" },
  ], descansan: ["Gure FC", "Zero Filtro", "Kalekantoi", "Parceros"] },
  { id: 6, title: "Jornada 6", date: "2026-11-22", status: "upcoming", matches: [
    { time: "16:00", home: "Gure FC", away: "Zero Filtro", stadium: "Tabira" },
    { time: "17:00", home: "Inter Panda", away: "Lojanos", stadium: "Tabira" },
    { time: "18:00", home: "Kalekantoi", away: "Parceros", stadium: "Tabira" },
    { time: "19:00", home: "Aston Birras", away: "Pitxi FC", stadium: "Tabira" },
  ], descansan: ["Rayo Forestal Internacional", "Martxel Juniors", "Tigres", "Gora Gora"] },
  { id: 7, title: "Jornada 7", date: "2026-11-29", status: "upcoming", matches: [
    { time: "16:00", home: "Inter Panda", away: "Martxel Juniors", stadium: "Tabira" },
    { time: "17:00", home: "Kalekantoi", away: "Rayo Forestal Internacional", stadium: "Tabira" },
    { time: "18:00", home: "Gora Gora", away: "Aston Birras", stadium: "Tabira" },
    { time: "19:00", home: "Pitxi FC", away: "Zero Filtro", stadium: "Tabira" },
  ], descansan: ["Parceros", "Gure FC", "Tigres", "Lojanos"] },
  { id: 8, title: "Jornada 8", date: "2026-12-13", status: "upcoming", matches: [
    { time: "16:00", home: "Parceros", away: "Gure FC", stadium: "Tabira" },
    { time: "17:00", home: "Martxel Juniors", away: "Gora Gora", stadium: "Tabira" },
    { time: "18:00", home: "Tigres", away: "Lojanos", stadium: "Tabira" },
    { time: "19:00", home: "Rayo Forestal Internacional", away: "Zero Filtro", stadium: "Tabira" },
  ], descansan: ["Inter Panda", "Aston Birras", "Kalekantoi", "Pitxi FC"] },
  { id: 9, title: "Jornada 9", date: "2026-12-20", status: "upcoming", matches: [
    { time: "15:00", home: "Inter Panda", away: "Gora Gora", stadium: "Tabira" },
    { time: "16:00", home: "Pitxi FC", away: "Kalekantoi", stadium: "Tabira" },
    { time: "17:00", home: "Parceros", away: "Tigres", stadium: "Tabira" },
    { time: "18:00", home: "Gure FC", away: "Martxel Juniors", stadium: "Tabira" },
    { time: "19:00", home: "Zero Filtro", away: "Lojanos", stadium: "Tabira" },
  ], descansan: ["Aston Birras", "Rayo Forestal Internacional"] },
  { id: 10, title: "Jornada 10", date: "2027-01-10", status: "upcoming", matches: [
    { time: "15:00", home: "Lojanos", away: "Gure FC", stadium: "Tabira" },
    { time: "16:00", home: "Tigres", away: "Pitxi FC", stadium: "Tabira" },
    { time: "17:00", home: "Martxel Juniors", away: "Parceros", stadium: "Tabira" },
    { time: "18:00", home: "Kalekantoi", away: "Gora Gora", stadium: "Tabira" },
    { time: "19:00", home: "Inter Panda", away: "Aston Birras", stadium: "Tabira" },
  ], descansan: ["Rayo Forestal Internacional", "Zero Filtro"] },
  { id: 11, title: "Jornada 11", date: "2027-01-17", status: "upcoming", matches: [
    { time: "15:00", home: "Martxel Juniors", away: "Rayo Forestal Internacional", stadium: "Tabira" },
    { time: "16:00", home: "Tigres", away: "Aston Birras", stadium: "Tabira" },
    { time: "17:00", home: "Kalekantoi", away: "Zero Filtro", stadium: "Tabira" },
    { time: "18:00", home: "Pitxi FC", away: "Parceros", stadium: "Tabira" },
    { time: "19:00", home: "Gora Gora", away: "Gure FC", stadium: "Tabira" },
  ], descansan: ["Inter Panda", "Lojanos"] },
  { id: 12, title: "Jornada 12", date: "2027-01-24", status: "upcoming", matches: [
    { time: "15:00", home: "Martxel Juniors", away: "Zero Filtro", stadium: "Tabira" },
    { time: "16:00", home: "Lojanos", away: "Aston Birras", stadium: "Tabira" },
    { time: "17:00", home: "Tigres", away: "Gure FC", stadium: "Tabira" },
    { time: "18:00", home: "Inter Panda", away: "Rayo Forestal Internacional", stadium: "Tabira" },
    { time: "19:00", home: "Gora Gora", away: "Pitxi FC", stadium: "Tabira" },
  ], descansan: ["Kalekantoi", "Parceros"] },
  { id: 13, title: "Jornada 13", date: "2027-01-31", status: "upcoming", matches: [
    { time: "15:00", home: "Inter Panda", away: "Gure FC", stadium: "Tabira" },
    { time: "16:00", home: "Rayo Forestal Internacional", away: "Gora Gora", stadium: "Tabira" },
    { time: "17:00", home: "Zero Filtro", away: "Parceros", stadium: "Tabira" },
    { time: "18:00", home: "Martxel Juniors", away: "Tigres", stadium: "Tabira" },
    { time: "19:00", home: "Lojanos", away: "Kalekantoi", stadium: "Tabira" },
  ], descansan: ["Aston Birras", "Pitxi FC"] },
  { id: 14, title: "Jornada 14", date: "2027-02-07", status: "upcoming", matches: [
    { time: "15:00", home: "Tigres", away: "Kalekantoi", stadium: "Tabira" },
    { time: "16:00", home: "Rayo Forestal Internacional", away: "Parceros", stadium: "Tabira" },
    { time: "17:00", home: "Lojanos", away: "Pitxi FC", stadium: "Tabira" },
    { time: "18:00", home: "Inter Panda", away: "Zero Filtro", stadium: "Tabira" },
    { time: "19:00", home: "Aston Birras", away: "Gure FC", stadium: "Tabira" },
  ], descansan: ["Martxel Juniors", "Gora Gora"] },
];

export const sanctions: DisciplinaryRecord[] = [
  { id: 1, player: "J. Raya", team: "Gure FC", card: "Amarilla", matches: 2, remaining: 1, reason: "Faltas acumuladas" },
  { id: 2, player: "M. Domínguez", team: "Kalekantoi", card: "Roja", matches: 1, remaining: 2, reason: "Entrada peligrosa" },
  { id: 3, player: "P. Lugo", team: "Zero Filtro", card: "Doble amarilla", matches: 1, remaining: 1, reason: "Acumulación" },
  { id: 4, player: "L. Ortega", team: "Inter Panda", card: "Amarilla", matches: 1, remaining: 0, reason: "Empujón" },
  { id: 5, player: "A. Díaz", team: "Zero Filtro", card: "Amarilla", matches: 2, remaining: 2, reason: "Falta táctica" },
  { id: 6, player: "R. Soler", team: "Aston Birras", card: "Roja", matches: 1, remaining: 3, reason: "Mano deliberada" },
];

export const adminSummary = {
  totalTeams: teams.length,
  totalMatches: matches.length,
  yellowCards: 23,
  redCards: 2,
  pendingDebt: "€1.080",
};

export const publicLeagueMigrationSeed = {
  teams: teams.map((team) => ({
    ...team,
    id: leagueSeedUuidMap[team.name] ?? team.id,
    shortName: team.shortName,
    players: team.players.map((player) => ({
      ...player,
      teamId: leagueSeedUuidMap[team.name] ?? team.id,
      teamName: team.name,
    })),
  })),
  matches,
  calendar,
  sanctions,
  finances: {
    fees: Object.fromEntries(teams.map((team) => [team.name, 250])),
    payments: Object.fromEntries(teams.map((team) => [team.name, 120])),
    expenses: [
      { id: 1, concept: "Balones", amount: 160, type: "gasto" },
      { id: 2, concept: "Fichas de arbitraje", amount: 180, type: "gasto" },
      { id: 3, concept: "Inscripciones", amount: 190, type: "cobro" },
    ],
    costs: {
      yellow: 30,
      doubleYellow: 60,
      red: 80,
      other: 120,
    },
  },
};
