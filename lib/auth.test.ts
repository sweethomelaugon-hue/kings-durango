import test from "node:test";
import assert from "node:assert/strict";

import {
  clearAuthSession,
  DEFAULT_ADMIN_EMAIL,
  isAdminSession,
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
