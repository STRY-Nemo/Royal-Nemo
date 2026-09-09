# Deploying the shared alliance server

The app on GitHub Pages runs in **demo mode** (data stays in each phone) until it is connected to the alliance API. The API is a Cloudflare Worker with a D1 database. Cloudflare's free tier is far more than an alliance needs, and GitHub Actions does the deploying, so there is no server to run. Everything below can be done from a phone browser.

## One-time setup (about 10 minutes)

### 1. Create a Cloudflare account
Go to https://dash.cloudflare.com/sign-up and sign up (free plan).

### 2. Find your Account ID
In the Cloudflare dashboard open **Workers & Pages**. The **Account ID** is shown on that page (on a phone, scroll down; on desktop it is in the right column). Copy it.

### 3. Create an API token
1. Open https://dash.cloudflare.com/profile/api-tokens → **Create Token**.
2. Choose the **Edit Cloudflare Workers** template.
3. Under **Permissions** add one more row: **Account → D1 → Edit**.
4. Continue → Create Token. Copy the token (it is shown only once).

### 4. Add three secrets to the GitHub repository
Open the repository on GitHub → **Settings → Secrets and variables → Actions → New repository secret**, and add:

| Name | Value |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | the token from step 3 |
| `CLOUDFLARE_ACCOUNT_ID` | the account id from step 2 |
| `OWNER_SETUP_CODE` | a passphrase you choose; you will type it once to create the first leader account |
| `SUGGESTIONS_SYNC_TOKEN` | optional: any long random string. Lets the "Sync ideas to issues" workflow read the Ideas tab and mirror it into GitHub issues for agent review. Re-run the API deploy after adding it. |

### 5. Run the deploy
GitHub → **Actions → "Deploy API to Cloudflare" → Run workflow** (pick the branch the app lives on). The run:

- creates the `stry-alliance` D1 database if it does not exist,
- applies the schema migrations,
- deploys the Worker and prints its URL (`https://stry-alliance-api.<your-subdomain>.workers.dev`),
- checks that `.env.production` contains `VITE_API_URL=<that URL>`; if it does not (first deploy on a new account), commit that line and push, and the GitHub Pages build will connect to the server.

Wait for both workflows to finish green (2–3 minutes).

Token permissions that the deploy needs, all on the account: **Workers Scripts → Edit** and **D1 → Edit** (the "Edit Cloudflare Workers" template supplies the first; add the second). Account API Tokens are listed under Manage Account → Account API Tokens, not under the user profile.

### 6. Create the first leader account
Open the app (https://stry-nemo.github.io/Royal-Nemo/), tap **Create account**, and use your `OWNER_SETUP_CODE` as the invite code. Pick your in-game name from the roster. This first account is a verified leader. The owner code stops working as soon as one leader exists (the app then says so). Passwords can be as short as 4 characters.

If the code is refused: the Worker only receives the secret when the **Deploy API to Cloudflare** workflow runs, so after changing `OWNER_SETUP_CODE` in GitHub re-run that workflow (Actions → Deploy API to Cloudflare → Run workflow). The comparison ignores capitalisation and surrounding spaces.

### 7. Invite the alliance
**Settings → Alliance accounts & join link → Create the alliance join link**, then **Share join link** (the phone's share sheet opens with a ready-made message). One link serves everyone: it opens the app on a join form where a member picks their in-game name, gets a suggested username, chooses a PIN and taps **Join the alliance**. The link allows 200 sign-ups over 90 days; every invite code doubles as a link (`…/#/join/CODE`) and can be revoked from the same screen. Leaders can verify member links, change roles, or disable accounts there too.

## Everyday operation

- Pushing changes to the app branch rebuilds the site automatically. Pushing changes under `server/` or the engine redeploys the API (the deploy workflow runs its own tests first).
- **Ideas → GitHub issues**: with `SUGGESTIONS_SYNC_TOKEN` set, Actions → "Sync ideas to issues" runs every 6 hours (or on demand) and opens one issue per new idea (label `idea`) plus a digest issue of the top-voted ones. Ask a coding agent to work from those issues; statuses set in the app are shown on each issue.
- **Backups**: a leader can export everything as JSON from Settings. Cloudflare D1 also keeps point-in-time history for 30 days ("Time Travel").
- **Logs**: Cloudflare dashboard → Workers & Pages → stry-alliance-api → Logs.
- **Local development** against the API: `npm run server:migrate:local`, then `npm run server:dev` in one terminal and `VITE_API_URL=http://localhost:8787 npm run dev` in another. The worker takes `OWNER_SETUP_CODE` from `server/.dev.vars` (create that file with `OWNER_SETUP_CODE=something`).

## Security notes

- Passwords are hashed with PBKDF2 (100k iterations, the Workers Free plan limit) in the Worker; sessions are random bearer tokens stored hashed, valid 90 days, revoked on sign-out or when an account is disabled.
- Every write is checked server-side: role, ownership (members only edit their own availability and confirmation), capacity, uniqueness, availability, and the event or board revision. Two leaders editing the same revision get a "reload to compare" error instead of silently overwriting each other.
- Leader-only mechanical notes and the audit trail are never sent to member accounts.
- Browser origins allowed to call the API default to the GitHub Pages origin and localhost; add more via the repository variable `EXTRA_ALLOWED_ORIGINS` (comma-separated).
- To fall back to demo mode, delete `.env.production` and push.
