import test from "node:test";
import assert from "node:assert/strict";

// Mock localStorage and window
const store = new Map();
global.localStorage = {
  getItem: (k) => store.get(k) || null,
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};

const dispatchedEvents = [];
global.window = {
  dispatchEvent: (event) => dispatchedEvents.push(event.type),
};
global.Event = class Event {
  constructor(type) { this.type = type; }
};

const { api, token } = await import("./src/api.js");

test("token persists access and refresh tokens in storage", () => {
  store.clear();
  token.set("access-123", "refresh-456");
  assert.equal(token.get(), "access-123");
  assert.equal(token.refresh(), "refresh-456");

  token.clear();
  assert.equal(token.get(), null);
  assert.equal(token.refresh(), null);
});

test("api retries protected request once after token refresh", async () => {
  store.clear();
  token.set("expired-access", "valid-refresh");
  dispatchedEvents.length = 0;

  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith("/projects")) {
      // First call with expired token returns 401
      if (options.headers.Authorization === "Bearer expired-access") {
        return {
          status: 401,
          ok: false,
          json: async () => ({ detail: "Token is invalid or expired" }),
        };
      }
      // Retry call with new access token returns 200
      if (options.headers.Authorization === "Bearer refreshed-access") {
        return {
          status: 200,
          ok: true,
          json: async () => [{ id: 1, name: "Project 1" }],
        };
      }
    }
    if (url.endsWith("/auth/refresh")) {
      return {
        status: 200,
        ok: true,
        json: async () => ({ access: "refreshed-access" }),
      };
    }
    throw new Error(`Unexpected fetch to ${url}`);
  };

  const result = await api("/projects");
  assert.deepEqual(result, [{ id: 1, name: "Project 1" }]);
  assert.equal(token.get(), "refreshed-access");
  assert.equal(token.refresh(), "valid-refresh"); // preserved
  assert.equal(calls.length, 3);
  assert.equal(calls[0].url.endsWith("/projects"), true);
  assert.equal(calls[1].url.endsWith("/auth/refresh"), true);
  assert.equal(calls[2].url.endsWith("/projects"), true);
  assert.equal(dispatchedEvents.length, 0);
});

test("invalid refresh token clears session and dispatches dt_session_expired", async () => {
  store.clear();
  token.set("expired-access", "invalid-refresh");
  dispatchedEvents.length = 0;

  global.fetch = async (url) => {
    if (url.endsWith("/projects")) {
      return {
        status: 401,
        ok: false,
        json: async () => ({ detail: "Given token not valid for any token type" }),
      };
    }
    if (url.endsWith("/auth/refresh")) {
      return {
        status: 401,
        ok: false,
        json: async () => ({ detail: "Token is invalid or expired" }),
      };
    }
    throw new Error(`Unexpected fetch to ${url}`);
  };

  await assert.rejects(
    async () => { await api("/projects"); },
    { message: "Given token not valid for any token type" }
  );

  assert.equal(token.get(), null);
  assert.equal(token.refresh(), null);
  assert.ok(dispatchedEvents.includes("dt_session_expired"));
});

