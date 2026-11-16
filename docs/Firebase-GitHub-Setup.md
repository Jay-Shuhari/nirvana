# Firebase and GitHub setup (manual steps)

These steps happen in web consoles and can't be done from the terminal. Do them once per environment (local, staging, production). None of the values below go into git.

Until this is done the app still runs. The sign-in page shows "Google and GitHub sign-in are not configured", and the GitHub steps in onboarding and on task pages say the App isn't configured.

## What you will end up with

| Where                 | Variable                                              | Secret?                | Comes from                |
| --------------------- | ----------------------------------------------------- | ---------------------- | ------------------------- |
| `frontend/.env`     | `VITE_FIREBASE_API_KEY`                             | No (public identifier) | Firebase web app config   |
| `frontend/.env`     | `VITE_FIREBASE_AUTH_DOMAIN`                         | No                     | Firebase web app config   |
| `frontend/.env`     | `VITE_FIREBASE_PROJECT_ID`                          | No                     | Firebase web app config   |
| `frontend/.env`     | `VITE_FIREBASE_APP_ID`                              | No                     | Firebase web app config   |
| `backend/.env`      | `FIREBASE_PROJECT_ID`                               | No                     | Same project ID as above  |
| `backend/.env`      | `SUPERVISOR_EMAILS`                                 | No                     | Your academy policy       |
| Firebase console only | GitHub OAuth client secret                            | **Yes**          | GitHub OAuth App (step 2) |
| `backend/.env`      | `GITHUB_APP_ID`, `GITHUB_APP_SLUG`                | No                     | Metis GitHub App (step 5) |
| `backend/.env`      | `GITHUB_APP_PRIVATE_KEY`, `GITHUB_WEBHOOK_SECRET` | **Yes**          | Metis GitHub App (step 5) |

There are **two different GitHub registrations**, and that is intentional:

- **GitHub OAuth App** (step 2): lets people *sign in with GitHub* through Firebase. It proves who someone is.
- **Metis GitHub App** (step 5): lets Metis *read the repositories a student grants*. It controls what Metis can access.

## 1. Create the Firebase project and web app

1. Go to [https://console.firebase.google.com](https://console.firebase.google.com) and choose **Create a project**. Name it something like `metis-prod`. Google Analytics is optional.
2. Open **Project settings → General → Your apps → Add app → Web (`</>`)**. Name it `metis-web`. Firebase Hosting is not needed.
3. Copy the `firebaseConfig` values into `frontend/.env`:
   ```
   VITE_FIREBASE_API_KEY=<apiKey>
   VITE_FIREBASE_AUTH_DOMAIN=<projectId>.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=<projectId>
   VITE_FIREBASE_APP_ID=<appId>
   ```

   On Vercel, add the same four variables under **Project → Settings → Environment Variables**, then redeploy.
4. Put the project ID in `backend/.env`: `FIREBASE_PROJECT_ID=<projectId>`. The backend uses it to verify ID tokens against Google's public certificates, so no service-account key is needed.

## 2. Enable the sign-in providers

**Authentication → Get started → Sign-in method**:

1. **Google:** enable it and pick a project support email. Save.
2. **GitHub:** enable it. Firebase shows a callback URL like `https://<projectId>.firebaseapp.com/__/auth/handler`. Copy it, then:
   1. Go to [https://github.com/settings/developers](https://github.com/settings/developers) (or your organisation's **Settings → Developer settings**) → **OAuth Apps → New OAuth App**.
   2. Set **Application name** to `Metis sign-in`, **Homepage URL** to your frontend URL, and **Authorization callback URL** to the Firebase handler URL from above.
   3. Register it, copy the **Client ID**, then **Generate a new client secret**.
   4. Paste both into Firebase's GitHub provider dialog and save.

## 3. Account linking setting

In **Authentication → Settings → User account linking**, keep **"Link accounts that use the same email"** (the default).

- With this setting, if someone signs up with Google and later tries "Continue with GitHub" using the same email, Firebase refuses. Metis then tells them to continue with Google and link GitHub from onboarding or Settings. Both identities are proven before they are joined.
- Metis also never merges accounts on its own just because the emails match. A legacy email/password account with the same email gets a 409 and is asked to sign in the old way and link from Settings.

## 4. Authorized domains

**Authentication → Settings → Authorized domains**: `localhost` is listed by default. Add your production frontend domain (for example `metis.example.edu` or `<app>.vercel.app`). Without it, popups fail with `auth/unauthorized-domain`.

## 5. Metis GitHub App (repository access)

If an App already exists from the legacy deployment, review it against this list. Otherwise create one at **GitHub → Settings → Developer settings → GitHub Apps → New GitHub App**. [git.md](../git.md) §3 has the full field table; these settings matter for the new flow:

| Field                                                  | Value                                                                                             |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| Setup URL                                              | `https://<backend-host>/api/github/setup`                                                       |
| **Redirect on update**                           | **Checked**. Metis handles `setup_action=update`, so "Manage on GitHub" returns to Metis. |
| Request user authorization (OAuth) during installation | Unchecked. Sign-in identity comes from Firebase.                                                  |
| Webhook URL                                            | `https://<backend-host>/api/github/webhook`                                                     |
| Webhook secret                                         | A long random string, also set as `GITHUB_WEBHOOK_SECRET`                                       |
| Repository permissions                                 | Contents: **Read-only**, Metadata: **Read-only**                                      |
| Subscribe to events                                    | Installation (and Installation repositories)                                                      |
| Where can it be installed                              | Any account (students install it on their personal account)                                       |

Then put the following in `backend/.env` (or your host's secret settings):

```
GITHUB_APP_ID=<numeric App ID>
GITHUB_APP_SLUG=<the slug in https://github.com/apps/<slug>>
GITHUB_APP_PRIVATE_KEY=<generated .pem, one line with literal \n between lines>
GITHUB_WEBHOOK_SECRET=<same secret as the App>
FRONTEND_URL=<frontend origin, no trailing slash>
```

Metis checks that a personal installation belongs to the **same GitHub account the student linked**. If someone installs the App on a different account, they're sent back with "That installation belongs to a different GitHub account".

## 6. Supervisor policy

Supervisors can't choose their own role. Set academy policy in `backend/.env`:

```
SUPERVISOR_EMAILS=lecturer.one@uni.edu,@staff.uni.edu
```

Exact addresses and `@domain` entries are both supported. The rule only applies to **verified** emails on a user's first sign-in. Existing users can be promoted in Django admin (`/admin/` → Users → role).

## 7. Apply the backend changes

```powershell
cd backend
uv pip install -r requirements.txt    # or: python -m pip install -r requirements.txt  (adds cryptography)
python manage.py migrate              # 0005_identity_onboarding_groups: additive only
python manage.py test core
cd ../frontend
npm install                           # adds the firebase SDK
npm run build
```

Migration `0005` only adds tables and columns, so it is safe on existing data. Existing users get no onboarding record. They are taken through onboarding on their next sign-in, and their saved matric number is reused.

## 8. Check it works

1. Open the site signed out: you should see the landing page.
2. **Get started → Continue with Google** should create an account and open onboarding at step 1.
3. Complete your profile and strengths, then **Link GitHub** (popup) and **Install App** (GitHub, then back to `/onboarding?github=connected`). **Finish setup** should now be enabled.
4. Join a course, open a task. The "Start this task" panel should list only the repositories you granted.
5. In Settings, both sign-in methods should show as linked, and the GitHub App should show as "Connected".

Legacy email/password sign-in is still available under "older accounts" on the sign-in page. New password sign-ups are off unless `LEGACY_PASSWORD_SIGNUP=1`, which defaults to on only when `DEBUG=1`.
