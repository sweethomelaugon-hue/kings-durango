import test from "node:test";
import assert from "node:assert/strict";

import {
  clearAuthSession,
  DEFAULT_ADMIN_EMAIL,
  isAdminSession,
  loginWithCredentials,
  readAuthSession,
  saveAuthSession,
  type AuthSession,
} from "@/lib/auth";

test("saveAuthSession y readAuthSession mantienen la sesión de administrador", () => {
  const session: AuthSession = {
    email: DEFAULT_ADMIN_EMAIL,
    role: "admin",
    token: "admintoken-123",
    lastLogin: new Date().toISOString(),
  };

  saveAuthSession(session);
  const stored = readAuthSession();

  assert.ok(stored);
  assert.equal(stored?.role, "admin");
  assert.equal(stored?.email, DEFAULT_ADMIN_EMAIL);
  assert.equal(stored?.token, "admintoken-123");

  clearAuthSession();
  assert.equal(readAuthSession(), null);
});

test("isAdminSession devuelve false si el usuario no tiene role admin", () => {
  const session: AuthSession = {
    email: "user@example.com",
    role: "user",
    token: "token-456",
    lastLogin: new Date().toISOString(),
  };

  assert.equal(isAdminSession(session), false);
  assert.equal(isAdminSession(null), false);
});

test("loginWithCredentials usa credenciales por defecto en producción aunque no haya variables de entorno", () => {
  const runtimeEnv = process.env as Record<string, string | undefined>;
  const previousNodeEnv = runtimeEnv.NODE_ENV;
  const previousAdminEmail = runtimeEnv.ADMIN_EMAIL;
  const previousNextPublicAdminEmail = runtimeEnv.NEXT_PUBLIC_ADMIN_EMAIL;
  const previousAdminPassword = runtimeEnv.ADMIN_PASSWORD;
  const previousNextPublicAdminPassword = runtimeEnv.NEXT_PUBLIC_ADMIN_PASSWORD;

  delete runtimeEnv.ADMIN_EMAIL;
  delete runtimeEnv.NEXT_PUBLIC_ADMIN_EMAIL;
  delete runtimeEnv.ADMIN_PASSWORD;
  delete runtimeEnv.NEXT_PUBLIC_ADMIN_PASSWORD;
  runtimeEnv.NODE_ENV = "production";

  try {
    const session = loginWithCredentials("admin@kingsdurango.local", "KingsDurango2026!");
    assert.equal(session.role, "admin");
    assert.equal(session.email, "admin@kingsdurango.local");
  } finally {
    if (previousNodeEnv === undefined) {
      delete runtimeEnv.NODE_ENV;
    } else {
      runtimeEnv.NODE_ENV = previousNodeEnv;
    }

    if (previousAdminEmail === undefined) {
      delete runtimeEnv.ADMIN_EMAIL;
    } else {
      runtimeEnv.ADMIN_EMAIL = previousAdminEmail;
    }

    if (previousNextPublicAdminEmail === undefined) {
      delete runtimeEnv.NEXT_PUBLIC_ADMIN_EMAIL;
    } else {
      runtimeEnv.NEXT_PUBLIC_ADMIN_EMAIL = previousNextPublicAdminEmail;
    }

    if (previousAdminPassword === undefined) {
      delete runtimeEnv.ADMIN_PASSWORD;
    } else {
      runtimeEnv.ADMIN_PASSWORD = previousAdminPassword;
    }

    if (previousNextPublicAdminPassword === undefined) {
      delete runtimeEnv.NEXT_PUBLIC_ADMIN_PASSWORD;
    } else {
      runtimeEnv.NEXT_PUBLIC_ADMIN_PASSWORD = previousNextPublicAdminPassword;
    }
  }
});
