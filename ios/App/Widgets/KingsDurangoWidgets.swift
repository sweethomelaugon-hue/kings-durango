import SwiftUI
import WidgetKit

private let leagueURL = URL(string: "https://kings-durango.vercel.app/api/league")!

struct LeagueResponse: Decodable {
    let data: LeagueData
}

struct LeagueData: Decodable {
    let calendar: [Round]
    let matches: [MatchResult]
    let standings: [Standing]
}

struct Round: Decodable {
    let id: Int
    let title: String
    let date: String
    let status: String
    let matches: [Fixture]
    let descansan: [String]?
}

struct Fixture: Decodable {
    let home: String
    let away: String
    let time: String
    let score: String?
    let status: String?
}

struct MatchResult: Decodable {
    let jornada: String
    let home: String
    let away: String
    let score: String?
    let status: String?
}

struct Standing: Decodable {
    let position: Int?
    let team: String
    let played: Int
    let points: Int
}

struct LeagueSnapshot {
    let nextRound: Round?
    let standings: [Standing]
}

struct LeagueEntry: TimelineEntry {
    let date: Date
    let snapshot: LeagueSnapshot
}

struct LeagueProvider: TimelineProvider {
    func placeholder(in context: Context) -> LeagueEntry {
        LeagueEntry(date: Date(), snapshot: LeagueSnapshot(nextRound: sampleRound, standings: sampleStandings))
    }

    func getSnapshot(in context: Context, completion: @escaping (LeagueEntry) -> Void) {
        Task {
            completion(await loadEntry())
        }
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<LeagueEntry>) -> Void) {
        Task {
            let entry = await loadEntry()
            let refreshDate = Calendar.current.date(byAdding: .minute, value: 30, to: Date()) ?? Date().addingTimeInterval(1800)
            completion(Timeline(entries: [entry], policy: .after(refreshDate)))
        }
    }

    private func loadEntry() async -> LeagueEntry {
        do {
            let (data, response) = try await URLSession.shared.data(from: leagueURL)
            guard (response as? HTTPURLResponse)?.statusCode == 200 else {
                throw URLError(.badServerResponse)
            }
            let decoded = try JSONDecoder().decode(LeagueResponse.self, from: data)
            let rounds = decoded.data.calendar.sorted { $0.id < $1.id }
            let nextRound = rounds.first { $0.status == "in-progress" || $0.status == "upcoming" }.map { round in
                Round(
                    id: round.id,
                    title: round.title,
                    date: round.date,
                    status: round.status,
                    matches: round.matches.map { fixture in
                        let result = decoded.data.matches.first {
                            $0.jornada == round.title && $0.home == fixture.home && $0.away == fixture.away
                        }
                        return Fixture(home: fixture.home, away: fixture.away, time: fixture.time, score: result?.score, status: result?.status)
                    },
                    descansan: round.descansan
                )
            }
            return LeagueEntry(date: Date(), snapshot: LeagueSnapshot(nextRound: nextRound, standings: decoded.data.standings))
        } catch {
            return LeagueEntry(date: Date(), snapshot: LeagueSnapshot(nextRound: sampleRound, standings: sampleStandings))
        }
    }
}

struct WidgetCard<Content: View>: View {
    let content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        if #available(iOS 17.0, *) {
            content
                .padding(14)
                .containerBackground(for: .widget) {
                    widgetBackground
                }
                .widgetURL(URL(string: "https://kings-durango.vercel.app"))
        } else {
            ZStack {
                widgetBackground
                content.padding(14)
            }
            .widgetURL(URL(string: "https://kings-durango.vercel.app"))
        }
    }

    private var widgetBackground: some View {
        LinearGradient(
            colors: [Color(red: 0.03, green: 0.12, blue: 0.10), Color(red: 0.10, green: 0.12, blue: 0.08)],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }
}

struct NextRoundWidget: Widget {
    let kind = "NextRoundWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: LeagueProvider()) { entry in
            NextRoundView(entry: entry)
        }
        .configurationDisplayName("Próxima jornada")
        .description("Consulta los próximos partidos de Kings Durango.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

struct NextRoundView: View {
    let entry: LeagueEntry
    @Environment(\.widgetFamily) private var family

    var body: some View {
        WidgetCard {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text("PRÓXIMA JORNADA")
                        .font(.system(size: 10, weight: .semibold))
                        .tracking(1.2)
                        .foregroundColor(Color(red: 0.95, green: 0.78, blue: 0.40))
                    Spacer()
                }

                if let round = entry.snapshot.nextRound {
                    Text(round.title)
                        .font(.system(size: 22, weight: .bold))
                        .foregroundColor(.white)
                    Text(formatDate(round.date))
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(.white.opacity(0.72))
                    ForEach(Array(round.matches.prefix(family == .systemSmall ? 3 : round.matches.count).enumerated()), id: \.offset) { _, match in
                        HStack(spacing: 4) {
                            Text(match.time)
                                .frame(width: 38, alignment: .leading)
                                .foregroundColor(Color(red: 0.95, green: 0.78, blue: 0.40))
                            Text(match.home)
                                .lineLimit(1)
                            Text("-")
                                .foregroundColor(.white.opacity(0.5))
                            Text(match.away)
                                .lineLimit(1)
                            if let score = match.score, !score.isEmpty, score != "-" {
                                Spacer(minLength: 2)
                                Text(score)
                                    .fontWeight(.bold)
                                    .foregroundColor(Color(red: 0.55, green: 0.94, blue: 0.78))
                            }
                        }
                        .font(.system(size: 11, weight: .medium))
                        .foregroundColor(.white.opacity(0.9))
                    }
                } else {
                    Text("Sin partidos programados")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundColor(.white)
                }
            }
        }
    }
}

struct StandingsWidget: Widget {
    let kind = "StandingsWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: LeagueProvider()) { entry in
            StandingsView(entry: entry)
        }
        .configurationDisplayName("Clasificación")
        .description("Consulta la tabla de Kings Durango.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

struct StandingsView: View {
    let entry: LeagueEntry
    @Environment(\.widgetFamily) private var family

    var body: some View {
        WidgetCard {
            VStack(alignment: .leading, spacing: 7) {
                Text("CLASIFICACIÓN")
                    .font(.system(size: 10, weight: .semibold))
                    .tracking(1.2)
                    .foregroundColor(Color(red: 0.95, green: 0.78, blue: 0.40))
                ForEach(Array(entry.snapshot.standings.prefix(family == .systemLarge ? entry.snapshot.standings.count : 5).enumerated()), id: \.offset) { index, team in
                    HStack(spacing: 7) {
                        Text("\(team.position ?? index + 1)")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(Color(red: 0.95, green: 0.78, blue: 0.40))
                            .frame(width: 16, alignment: .leading)
                        Text(team.team)
                            .font(.system(size: 12, weight: .medium))
                            .lineLimit(1)
                        Spacer(minLength: 2)
                        Text("\(team.played) PJ  \(team.points) pts")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundColor(Color(red: 0.55, green: 0.94, blue: 0.78))
                    }
                    .foregroundColor(.white.opacity(0.9))
                }
            }
        }
    }
}

@main
struct KingsDurangoWidgets: WidgetBundle {
    var body: some Widget {
        NextRoundWidget()
        StandingsWidget()
    }
}

private let sampleRound = Round(
    id: 1,
    title: "Jornada 1",
    date: "2026-09-20",
    status: "upcoming",
    matches: [
        Fixture(home: "Aston Birras", away: "Kalekantoi", time: "15:00", score: nil, status: "scheduled"),
        Fixture(home: "Inter Panda", away: "Parceros", time: "16:00", score: nil, status: "scheduled"),
        Fixture(home: "Gure FC", away: "Pitxi FC", time: "17:00", score: nil, status: "scheduled")
    ],
    descansan: nil
)

private let sampleStandings = [
    Standing(position: 1, team: "Aston Birras", played: 0, points: 0),
    Standing(position: 2, team: "Gora Gora", played: 0, points: 0),
    Standing(position: 3, team: "Gure FC", played: 0, points: 0),
    Standing(position: 4, team: "Inter Panda", played: 0, points: 0),
    Standing(position: 5, team: "Kalekantoi", played: 0, points: 0)
]

private func formatDate(_ value: String) -> String {
    let input = DateFormatter()
    input.dateFormat = "yyyy-MM-dd"
    let output = DateFormatter()
    output.dateFormat = "d MMMM"
    output.locale = Locale(identifier: "es_ES")
    return input.date(from: value).map { output.string(from: $0) } ?? value
}
