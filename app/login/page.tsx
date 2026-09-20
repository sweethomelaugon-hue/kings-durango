"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";

import { DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_PASSWORD, isAdminSession, loginWithCredentials, readAuthSession } from "@/lib/auth";

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(DEFAULT_ADMIN_EMAIL || "admin@kingsdurango.local");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const session = readAuthSession();
    if (isAdminSession(session)) {
      router.replace("/admin");
    }
  }, [router]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      loginWithCredentials(email, password);
      setPassword("");
      const nextPath = searchParams.get("next") ?? "/admin";
      window.dispatchEvent(new Event("auth:updated"));
      window.location.assign(nextPath);
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "No se pudo iniciar sesión.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="page-shell">
      <div style={{ maxWidth: 460, margin: "32px auto 0", padding: "20px" }}>
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: 24 }}>
          <p className="eyebrow">Administración</p>
          <h1 style={{ marginTop: 8, marginBottom: 20 }}>Iniciar sesión</h1>
          <form onSubmit={handleSubmit} className="admin-form-grid" autoComplete="off">
            <label>
              Email
              <input type="email" name="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </label>
            <label>
              Contraseña
              <input type="password" name="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
            </label>
            {error ? <p style={{ color: "#ffb4b4", margin: 0 }}>{error}</p> : null}
            <button type="submit" className="button" disabled={loading}>
              {loading ? "Accediendo..." : "Entrar"}
            </button>
          </form>
          <div style={{ marginTop: 18 }}>
            <Link href="/" style={{ color: "#a8f5d0" }}>Volver a la portada</Link>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="page-shell"><div style={{ maxWidth: 460, margin: "32px auto 0", padding: "20px" }}>Cargando…</div></main>}>
      <LoginPageContent />
    </Suspense>
  );
}
