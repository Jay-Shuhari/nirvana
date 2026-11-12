// ======================================================================
// ANCHOR: api.js
// FILE: api.js
// ROLE: One fetch wrapper that adds the login token and turns errors into messages.
// SEE:  docs/Architecture.md
// ======================================================================
// * '/api' = same server as the page (single-URL mode). Set VITE_API_URL only for `npm run dev`.
const BASE = (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) || "/api";
// ANCHOR: Token storage
// ! The JWT lives in localStorage. Fine for a course project; consider httpOnly cookies for production.
export const token = {
  get: () => localStorage.getItem("dt_token"),
  refresh: () => localStorage.getItem("dt_refresh"),
  set: (access, refresh) => {
    localStorage.setItem("dt_token", access);
    if (refresh) localStorage.setItem("dt_refresh", refresh);
  },
  clear: () => {
    localStorage.removeItem("dt_token");
    localStorage.removeItem("dt_refresh");
  },
};
// ANCHOR: api()
// * Usage: api('/projects') or api('/projects', {method:'POST', body:{...}})
// ? Why the long error line? DRF returns errors in several shapes (detail, list, field dict); this picks the first message.
export async function api(path, { method = "GET", body } = {}, retry = true) {
  const res = await fetch(BASE + path, { method, headers: { "Content-Type": "application/json", ...(token.get() && { Authorization: `Bearer ${token.get()}` }) }, body: body && JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    if (retry && token.refresh()) {
      const refreshed = await fetch(BASE + "/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh: token.refresh() }),
      });
      const refreshData = await refreshed.json().catch(() => ({}));
      if (refreshed.ok && refreshData.access) {
        token.set(refreshData.access, refreshData.refresh || token.refresh());
        return api(path, { method, body }, false);
      }
    }
    token.clear();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("dt_session_expired"));
    }
  }
  if (!res.ok) throw new Error(data.detail || (Array.isArray(data) ? data[0] : Object.values(data)[0]) || "Something went wrong");
  return data;
}
// * Status-dot colour from a score: green 75+, amber 55+, red below. The ONLY colour in the UI.
export const dot = (s) => (s >= 75 ? "var(--good)" : s >= 55 ? "var(--warn)" : "var(--bad)");
