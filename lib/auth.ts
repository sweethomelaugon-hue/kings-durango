export type AuthRole = "admin" | "user";

export type AuthSession = {
  email: string;
  role: AuthRole;
  token: string;
  lastLogin: string;
};

export const AUTH_STORAGE_KEY = "kings-auth-session";
export const AUTH_COOKIE_NAME = "kings_auth_session";
export const LEGACY_ADMIN_TOKEN_STORAGE_KEY = "kings-admin-token";

export function getConfiguredAdminCredentials() {
  const fallbackEmail = "admin@kingsdurango.local";
  const fallbackPassword = "KingsDurango2026!";

  const emailKeys = ["ADMIN_EMAIL", "NEXT_PUBLIC_ADMIN_EMAIL"];
  const passwordKeys = ["ADMIN_PASSWORD", "NEXT_PUBLIC_ADMIN_PASSWORD"];

  const email = emailKeys
    .map((key) => process.env[key] ?? "")
    .find((value) => typeof value === "string" && value.trim().length > 0)?.trim() ?? fallbackEmail;

  const password = passwordKeys
    .map((key) => process.env[key] ?? "")
    .find((value) => typeof value === "string" && value.trim().length > 0)?.trim() ?? fallbackPassword;

  return {
    email,
    password,
  };
}

export const DEFAULT_ADMIN_EMAIL = getConfiguredAdminCredentials().email;
export const DEFAULT_ADMIN_PASSWORD = getConfiguredAdminCredentials().password;

export function getEffectiveAdminToken(): string {
  const envToken = [
    process.env.ADMIN_ACCESS_TOKEN,
    process.env.ADMIN_TOKEN,
    process.env.NEXT_PUBLIC_ADMIN_ACCESS_TOKEN,
  ].find((value): value is string => typeof value === "string" && value.trim().length > 0)?.trim();

  if (envToken) {
    return envToken;
  }

  const configured = getConfiguredAdminCredentials();
  const seed = `${configured.email}:${configured.password}`;
  const base64 = Buffer.from(seed, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

  return `kings-admin-${base64}`;
}

const MEMORY_KEY = "__kings_auth_session__";

function readMemoryStore(): Record<string, string> {
  const globalObject = globalThis as typeof globalThis & { [MEMORY_KEY]?: Record<string, string> };
  if (!globalObject[MEMORY_KEY]) {
    globalObject[MEMORY_KEY] = {};
  }
  return globalObject[MEMORY_KEY];
}

function readStorageValue(): string | null {
  if (typeof window !== "undefined") {
    try {
      return window.localStorage.getItem(AUTH_STORAGE_KEY);
    } catch {
      return null;
    }
  }

  const store = readMemoryStore();
  return store[AUTH_STORAGE_KEY] ?? null;
}

function writeStorageValue(value: string | null): void {
  if (typeof window !== "undefined") {
    try {
      if (value) {
        window.localStorage.setItem(AUTH_STORAGE_KEY, value);
      } else {
        window.localStorage.removeItem(AUTH_STORAGE_KEY);
      }
      return;
    } catch {
      // Fallback to memory store when localStorage is not available.
    }
  }

  const store = readMemoryStore();
  if (value) {
    store[AUTH_STORAGE_KEY] = value;
  } else {
    delete store[AUTH_STORAGE_KEY];
  }
}

function getCookieValue(name: string): string {
  if (typeof document === "undefined") {
    return "";
  }

  const cookieParts = document.cookie.split(";");
  const target = cookieParts.find((part) => part.trim().startsWith(`${name}=`));
  if (!target) {
    return "";
  }

  return decodeURIComponent(target.split("=").slice(1).join("=")).trim();
}

function setCookieValue(value: string | null): void {
  if (typeof document === "undefined") {
    return;
  }

  const isSecure = window.location.protocol === "https:";
  const cookieString = value
    ? `${AUTH_COOKIE_NAME}=${encodeURIComponent(value)}; path=/; max-age=${60 * 60 * 24 * 7}; sameSite=lax; ${isSecure ? "secure;" : ""}`.trim()
    : `${AUTH_COOKIE_NAME}=; path=/; max-age=0; sameSite=lax`;

  document.cookie = cookieString;
}

export function createAuthToken(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `auth-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function saveAuthSession(session: AuthSession): void {
  const payload = JSON.stringify(session);
  writeStorageValue(payload);
  setCookieValue(payload);

  if (typeof window !== "undefined") {
    window.localStorage.setItem(LEGACY_ADMIN_TOKEN_STORAGE_KEY, session.token);
  }
}

export function readAuthSession(): AuthSession | null {
  const rawValue = readStorageValue() || getCookieValue(AUTH_COOKIE_NAME);
  if (!rawValue) {
    const legacyToken = (() => {
      if (typeof window === "undefined") {
        return null;
      }
      try {
        return window.localStorage.getItem(LEGACY_ADMIN_TOKEN_STORAGE_KEY)?.trim() ?? null;
      } catch {
        return null;
      }
    })();

    if (!legacyToken) {
      return null;
    }

    return {
      email: DEFAULT_ADMIN_EMAIL,
      role: "admin",
      token: legacyToken,
      lastLogin: new Date().toISOString(),
    };
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<AuthSession>;
    if (!parsed || typeof parsed.email !== "string" || typeof parsed.role !== "string") {
      return null;
    }

    return {
      email: parsed.email,
      role: parsed.role === "admin" ? "admin" : "user",
      token: typeof parsed.token === "string" ? parsed.token : createAuthToken(),
      lastLogin: typeof parsed.lastLogin === "string" ? parsed.lastLogin : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function clearAuthSession(): void {
  writeStorageValue(null);
  setCookieValue(null);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(LEGACY_ADMIN_TOKEN_STORAGE_KEY);
    } catch {
      // Ignore storage errors while clearing the session.
    }
    window.dispatchEvent(new Event("auth:updated"));
  }
}

export function loginWithCredentials(email: string, password: string): AuthSession {
  const configured = getConfiguredAdminCredentials();
  const normalizedEmail = email.trim().toLowerCase();

  const effectiveEmail = configured.email.trim();
  const effectivePassword = configured.password.trim();

  if (normalizedEmail !== effectiveEmail.toLowerCase() || password !== effectivePassword) {
    throw new Error("Credenciales no válidas.");
  }

  const session: AuthSession = {
    email: effectiveEmail,
    role: "admin",
    token: getEffectiveAdminToken(),
    lastLogin: new Date().toISOString(),
  };

  saveAuthSession(session);
  return session;
}

export function isAdminSession(session: AuthSession | null): boolean {
  return Boolean(session && session.role === "admin" && session.email.toLowerCase() === DEFAULT_ADMIN_EMAIL.toLowerCase());
}
