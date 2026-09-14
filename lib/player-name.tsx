export function compactPlayerName(name: string, maxLength = 18) {
  const normalized = name.trim().replace(/\s+/g, " ");
  if (normalized.length <= maxLength) {
    return normalized;
  }

  const parts = normalized.split(" ");
  if (parts.length < 2) {
    return normalized.slice(0, maxLength - 1).trimEnd() + "…";
  }

  return `${parts[0]} ${parts[1].charAt(0).toUpperCase()}.`;
}

export function ResponsivePlayerName({ name }: { name: string }) {
  return (
    <span className="responsive-player-name" title={name}>
      <span className="player-name-full">{name}</span>
      <span className="player-name-compact">{compactPlayerName(name)}</span>
    </span>
  );
}
