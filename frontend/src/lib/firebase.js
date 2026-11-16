// ======================================================================
// ANCHOR: firebase.js
// FILE: frontend/src/lib/firebase.js
// ROLE: Google/GitHub sign-in through Firebase Authentication. The browser only obtains a Firebase
//       ID token; the Django API verifies it and issues the Metis session. No secrets live here.
// SEE:  docs/Firebase-GitHub-Setup.md
// ======================================================================
import { api, token } from "../api.js";

const env = import.meta.env;
const config = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};
export const firebaseConfigured = Boolean(config.apiKey && config.authDomain && config.projectId);

let cached;
// * Lazy-load the SDK so the landing page stays light.
async function sdk() {
  if (!firebaseConfigured) throw new Error("Google and GitHub sign-in are not configured yet. See docs/Firebase-GitHub-Setup.md.");
  if (!cached) {
    const [{ initializeApp }, auth] = await Promise.all([import("firebase/app"), import("firebase/auth")]);
    cached = { auth, instance: auth.getAuth(initializeApp(config)) };
    await cached.instance.authStateReady();
  }
  return cached;
}

function provider(auth, name) {
  return name === "github" ? new auth.GithubAuthProvider() : new auth.GoogleAuthProvider();
}

const LABEL = { google: "Google", github: "GitHub" };
// * Plain-language messages for the Firebase errors people actually hit.
export function describeAuthError(err, name) {
  const code = err?.code || "";
  if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return "Sign-in was cancelled.";
  if (code === "auth/popup-blocked") return "Your browser blocked the sign-in window. Allow pop-ups for this site and try again.";
  if (code === "auth/account-exists-with-different-credential")
    return `This email already uses another sign-in method. Continue with ${name === "github" ? "Google" : "GitHub"} first, then link ${LABEL[name]} during onboarding or in Settings.`;
  if (code === "auth/network-request-failed") return "Could not reach the sign-in service. Check your connection.";
  if (code === "auth/unauthorized-domain") return "This site is not on the Firebase authorized domains list yet.";
  return err?.message || "Sign-in failed. Try again.";
}

// ANCHOR: signIn
// * Popup sign-in -> Firebase ID token -> POST /auth/firebase -> Metis JWT pair.
export async function signIn(name) {
  const { auth, instance } = await sdk();
  const result = await auth.signInWithPopup(instance, provider(auth, name));
  const t = await api("/auth/firebase", { method: "POST", body: { id_token: await result.user.getIdToken() } });
  token.set(t.access, t.refresh);
  return t;
}

// ANCHOR: linkProvider
// ! Proof of control of both identities: the Metis session (JWT) plus a fresh provider sign-in.
export async function linkProvider(name) {
  const { auth, instance } = await sdk();
  let user = instance.currentUser;
  if (user) {
    try {
      user = (await auth.linkWithPopup(user, provider(auth, name))).user;
    } catch (err) {
      if (err?.code === "auth/provider-already-linked") { /* already on this Firebase user */ }
      else if (err?.code === "auth/credential-already-in-use") {
        // * That GitHub/Google account is its own Firebase user. Sign into it; the API decides if it may be linked.
        const credential = name === "github" ? auth.GithubAuthProvider.credentialFromError(err) : auth.GoogleAuthProvider.credentialFromError(err);
        user = (await auth.signInWithCredential(instance, credential)).user;
      } else throw err;
    }
  } else {
    user = (await auth.signInWithPopup(instance, provider(auth, name))).user;
  }
  return api("/auth/link", { method: "POST", body: { id_token: await user.getIdToken(true) } });
}

export async function signOutProvider() {
  if (!firebaseConfigured || !cached) return;
  await cached.auth.signOut(cached.instance).catch(() => {});
}
