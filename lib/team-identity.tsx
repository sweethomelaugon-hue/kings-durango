import Image from "next/image";

type TeamIdentityProps = {
  name: string;
  imageFile?: string;
  className?: string;
  imageClassName?: string;
  compact?: boolean;
};

const shieldFiles: Record<string, string> = {
  "Aston Birras": "Aston Birras.png",
  "Gora Gora": "Gora Gora.png",
  "Gure FC": "Gure FC.png",
  "Inter Panda": "Inter Panda.png",
  Kalekantoi: "Kalekantoi.png",
  Lojanos: "Lojanos.png",
  "Martxel Juniors": "Martxel Juniors.png",
  Parceros: "Parceros.png",
  "Pitxi FC": "Pitxi FC.png",
  "Rayo Forestal Internacional": "Rayo Forestal Internacional.png",
  Tigres: "Tigres.png",
  "Zero Filtro": "Zero Filtro.png",
};

function resolveSupabaseAssetUrl(fileName: string): string {
  if (!fileName) {
    return "";
  }

  if (fileName.startsWith("http://") || fileName.startsWith("https://")) {
    return fileName;
  }

  if (fileName.startsWith("data:")) {
    return fileName;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  if (!supabaseUrl) {
    return `/${encodeURIComponent(fileName)}`;
  }

  return `${supabaseUrl}/storage/v1/object/public/league-assets/${encodeURIComponent(fileName)}`;
}

export function TeamIdentity({ name, imageFile, className, imageClassName, compact = false }: TeamIdentityProps) {
  const shieldFile = imageFile || shieldFiles[name];
  const cacheVersion = name === "Inter Panda" ? "?v=20260911-200844" : "";
  const imageSource = shieldFile ? `${resolveSupabaseAssetUrl(shieldFile)}${cacheVersion}` : "";

  return (
    <span className={className ? `team-identity ${className}` : "team-identity"}>
      {shieldFile ? (
        <Image
          className={imageClassName ? `team-shield ${imageClassName}` : "team-shield"}
          src={imageSource}
          alt=""
          width={compact ? 24 : 32}
          height={compact ? 24 : 32}
          unoptimized
        />
      ) : null}
      <span>{name}</span>
    </span>
  );
}

export function TeamShield({ name, imageFile, className, size = 64 }: { name: string; imageFile?: string; className?: string; size?: number }) {
  const shieldFile = imageFile || shieldFiles[name];
  const cacheVersion = name === "Inter Panda" ? "?v=20260911-200844" : "";
  const imageSource = shieldFile ? `${resolveSupabaseAssetUrl(shieldFile)}${cacheVersion}` : "";

  return shieldFile ? (
    <Image
      className={className ? `team-shield ${className}` : "team-shield"}
      src={imageSource}
      alt=""
      width={size}
      height={size}
      unoptimized
    />
  ) : null;
}
