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
            VStack(alignment: .leading, spacing: family == .systemLarge ? 10 : 7) {
                if let round = entry.snapshot.nextRound {
                    HStack(alignment: .firstTextBaseline) {
                        Text(round.status == "in-progress" ? "JORNADA EN CURSO" : "PRÓXIMA JORNADA")
                            .font(.system(size: family == .systemLarge ? 12 : 10, weight: .semibold))
                            .tracking(1.5)
                            .foregroundColor(Color(red: 0.95, green: 0.78, blue: 0.40))
                        Spacer(minLength: 8)
                        Text(formatDate(round.date))
                            .font(.system(size: family == .systemLarge ? 15 : 12, weight: .bold))
                            .foregroundColor(.white.opacity(0.88))
                    }

                    Text(round.title)
                        .font(.system(size: family == .systemLarge ? 28 : 22, weight: .bold))
                        .foregroundColor(.white)

                    if round.status == "in-progress" {
                        HStack(spacing: 7) {
                            Circle()
                                .fill(Color(red: 0.95, green: 0.78, blue: 0.40))
                                .frame(width: 8, height: 8)
                            Text("EN CURSO")
                                .font(.system(size: 11, weight: .bold))
                                .tracking(1.1)
                                .foregroundColor(Color(red: 0.95, green: 0.78, blue: 0.40))
                        }
                        .padding(.horizontal, 11)
                        .padding(.vertical, 6)
                        .background(Color(red: 0.32, green: 0.25, blue: 0.08).opacity(0.7))
                        .clipShape(Capsule())
                    }

                    Divider().overlay(Color.white.opacity(0.12))

                    ForEach(Array(round.matches.prefix(family == .systemSmall ? 3 : round.matches.count).enumerated()), id: \.offset) { _, match in
                        HStack(spacing: family == .systemLarge ? 8 : 5) {
                            Text(match.time)
                                .frame(width: family == .systemLarge ? 42 : 36, alignment: .leading)
                                .foregroundColor(Color(red: 0.95, green: 0.78, blue: 0.40))
                            Text(match.home)
                                .lineLimit(1)
                                .frame(maxWidth: .infinity, alignment: .trailing)
                            Text(match.score ?? "-")
                                .fontWeight(.bold)
                                .frame(width: 32, alignment: .center)
                                .foregroundColor(match.score == nil || match.score == "-" ? .white.opacity(0.55) : Color(red: 0.55, green: 0.94, blue: 0.78))
                            Text(match.away)
                                .lineLimit(1)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                        .font(.system(size: family == .systemLarge ? 13 : 11, weight: .medium))
                        .foregroundColor(.white.opacity(0.9))
                        .padding(.vertical, family == .systemLarge ? 3 : 1)
                        .padding(.horizontal, match.status == "in-progress" ? 7 : 0)
                        .background(match.status == "in-progress" ? Color(red: 0.36, green: 0.22, blue: 0.08).opacity(0.9) : .clear)
                        .clipShape(RoundedRectangle(cornerRadius: 7))
                    }

                    if let descansan = round.descansan, !descansan.isEmpty {
                        Divider().overlay(Color.white.opacity(0.12))
                        HStack(spacing: 7) {
                            Text("Descansan")
                                .fontWeight(.bold)
                                .foregroundColor(Color(red: 0.95, green: 0.78, blue: 0.40))
                            Text(descansan.joined(separator: " · "))
                                .lineLimit(1)
                                .foregroundColor(.white.opacity(0.68))
                        }
                        .font(.system(size: family == .systemLarge ? 12 : 10, weight: .medium))
                    }
                } else {
                    Text("Sin partidos programados")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundColor(.white)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
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
