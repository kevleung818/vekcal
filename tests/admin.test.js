import test from "node:test";
import assert from "node:assert/strict";
import { isAdminEmail, requireAdmin } from "../server/admin.js";
import { startGithubAdminLogin } from "../server/auth.js";

test("admin access requires an explicitly configured email allowlist", () => {
  const previous = process.env.ADMIN_EMAILS;
  try {
    delete process.env.ADMIN_EMAILS;
    let configurationError;
    requireAdmin({ user: { email: "admin@example.com" } }, null, (error) => { configurationError = error; });
    assert.equal(configurationError.status, 503);

    process.env.ADMIN_EMAILS = " ADMIN@example.com, operator@example.com ";
    let allowedError;
    requireAdmin({ user: { email: "admin@example.com" } }, null, (error) => { allowedError = error; });
    assert.equal(allowedError, undefined);

    let deniedError;
    requireAdmin({ user: { email: "member@example.com" } }, null, (error) => { deniedError = error; });
    assert.equal(deniedError.status, 403);
  } finally {
    if (previous === undefined) delete process.env.ADMIN_EMAILS;
    else process.env.ADMIN_EMAILS = previous;
  }
});

test("GitHub admin login starts with a one-time state and configured callback", () => {
  const keys = ["ADMIN_EMAILS", "APP_URL", "GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET"];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  const headers = {};
  let redirect;
  const response = {
    append(name, value) { headers[name] = value; },
    redirect(status, url) { redirect = { status, url }; },
  };
  try {
    process.env.ADMIN_EMAILS = "vek@vekcompany.com";
    process.env.APP_URL = "https://vekai.example";
    process.env.GITHUB_CLIENT_ID = "test-client-id";
    process.env.GITHUB_CLIENT_SECRET = "test-client-secret";
    startGithubAdminLogin({}, response);

    const url = new URL(redirect.url);
    assert.equal(redirect.status, 302);
    assert.equal(url.origin, "https://github.com");
    assert.equal(url.pathname, "/login/oauth/authorize");
    assert.equal(url.searchParams.get("redirect_uri"), "https://vekai.example/api/auth/github/callback");
    assert.ok(url.searchParams.get("state"));
    assert.match(headers["Set-Cookie"], /HttpOnly; SameSite=Lax/);
    assert.equal(isAdminEmail("VEK@VEKCOMPANY.COM"), true);
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});
