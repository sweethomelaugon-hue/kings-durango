import type { Metadata, Viewport } from "next";
import Image from "next/image";
import Link from "next/link";
import MainNav from "./components/MainNav";
import "./globals.css";

const resolveSupabaseAssetUrl = (fileName: string) => {
  if (!fileName) {
    return "";
  }

  if (fileName.startsWith("http://") || fileName.startsWith("https://") || fileName.startsWith("data:")) {
    return fileName;
  }

  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  if (!baseUrl) {
    return `/${encodeURIComponent(fileName)}`;
  }

  return `${baseUrl}/storage/v1/object/public/league-assets/${encodeURIComponent(fileName)}`;
};

export const metadata: Metadata = {
  title: "Kings Durango | Tabira",
  description: "Aplicación web de Kings Durango con clasificación, Pitxitxi, jornadas y gestión administrativa.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es">
      <body>
        <div className="topbar">
          <div className="topbar-inner">
            <Link href="/" className="brand-mark">
              <span className="brand-badge">
                <Image src={resolveSupabaseAssetUrl("Kings League.png")} alt="" width={40} height={40} unoptimized />
              </span>
              <div>
                <strong>Kings Durango</strong>
                <small>Tabira</small>
              </div>
            </Link>
            <MainNav />
          </div>
        </div>
        {children}
      </body>
    </html>
  );
}
