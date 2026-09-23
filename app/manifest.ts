import type { MetadataRoute } from "next";

const resolveSupabaseAssetUrl = (fileName: string) => {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");

  if (!baseUrl) {
    return `/${encodeURIComponent(fileName)}`;
  }

  return `${baseUrl}/storage/v1/object/public/league-assets/${encodeURIComponent(fileName)}`;
};

export default function manifest(): MetadataRoute.Manifest {
  const iconUrl = resolveSupabaseAssetUrl("Kings League.png");

  return {
    name: "Kings Durango | Tabira",
    short_name: "Kings Durango",
    description: "Aplicación web de Kings Durango.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#111111",
    icons: [
      {
        src: iconUrl,
        sizes: "any",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}