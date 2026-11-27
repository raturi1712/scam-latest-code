# ScamShield AI

A rule-based website security and scam detection platform. Enter a URL and get a transparent 0 to 100 risk score, with the evidence and explanation behind every check. No AI or LLM APIs are used anywhere.

Stack: Next.js 16 (App Router), React 19, JavaScript only, Tailwind CSS v4, Firebase Authentication, Cloud Firestore, Recharts, Lucide.

## Quick start

```bash
npm install
cp .env.example .env.local   # optional at first, see "Preview mode"
npm run dev                  # http://localhost:3000
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm run lint` | ESLint |
| `npm test` | Unit and socket-level tests for the scanner and scoring (Node test runner) |

### Preview mode

Until the Firebase values are added, the app runs in **preview mode**: scanning works fully, the dashboard, history, reports and profile are browsable, and scan history is kept in the browser's `localStorage`. Sign-in forms are disabled and the public report form returns a clear "not configured" error. A banner states this on every app page. Preview mode switches off automatically once the `NEXT_PUBLIC_FIREBASE_*` values are present.

## Connecting Firebase

1. Create a Firebase project and add a **Web app**. Copy its config into the `NEXT_PUBLIC_FIREBASE_*` variables in `.env.local`.
2. **Authentication > Sign-in method**: enable *Email/Password* and *Google*. Add your production domain under *Authorized domains*.
3. **Firestore Database**: create a database in production mode.
4. **Project settings > Service accounts > Generate new private key**. Copy `project_id`, `client_email` and `private_key` into the `FIREBASE_ADMIN_*` variables. Keep the key on one line with `\n` line breaks, inside quotes.
5. Deploy rules and indexes: `npx firebase-tools deploy --only firestore` (uses `firebase.json`, `firestore.rules`, `firestore.indexes.json`).
6. On Vercel, add the same variables under *Project > Settings > Environment Variables*.

All configuration lives in two files: `lib/firebase/config.js` (browser) and `lib/firebase/admin.js` (server).

### Data model

| Collection | Written by | Readable by | Notes |
| --- | --- | --- | --- |
| `users/{uid}` | the user (client SDK) | the user | Profile document, validated by rules |
| `scans/{id}` | server only (Admin SDK) | owner, through the API | `userId` comes from the verified ID token, never from the request |
| `reports/{id}` | server only (Admin SDK) | nobody (no client access) | Public submissions; no admin UI in this version |

Ownership is enforced twice: in `firestore.rules`, and in the route handlers (`lib/server/repositories.js` returns "not found" for another user's scan).

## Optional integrations

Set `GOOGLE_SAFE_BROWSING_API_KEY` to enable the Google Safe Browsing blocklist check. Without a key the check is reported as "Unavailable": it adds no risk points, is never shown as passed, and the report notes that the assessment is incomplete. The key is only read on the server.

## How scanning works

`POST /api/scan` validates the URL, then runs `lib/scanner/index.js`:

1. **Normalize and validate** the URL (`lib/scanner/url.js`).
2. **Follow redirects manually**, validating every hop (`lib/scanner/safe-request.js`).
3. Run the checks in `lib/scanner/checks/`, against the final destination:

| Check | Source |
| --- | --- |
| Suspicious URL patterns | Static analysis of the address |
| Typosquatting and brand impersonation | Brand list in `lib/scanner/data/brands.js`, edit distance and look-alike characters |
| Domain registration and age | RDAP, queried directly at the registry found through the IANA bootstrap list (registration, expiry and last-updated dates, registrar, status) |
| SSL certificate | Direct TLS handshake |
| DNS records | A, AAAA, CNAME, MX, NS, SPF, DMARC |
| IP address information | RDAP network lookup, reverse DNS |
| HTTP response | Status and security headers |
| Redirect chain | Hop-by-hop record, including link shorteners (list in `lib/scanner/data/lists.js`) |
| Page content signals | Regex over the first 256 KB of HTML, nothing executed |
| Google Safe Browsing | Google Safe Browsing API (needs a key) |

### Risk score

Defined in `lib/scoring/risk-score.js` and `lib/scoring/levels.js`.

- Every finding has fixed points. The score is their sum, clamped to 0 to 100.
- A single check contributes at most 45 points (80 for blocklist checks).
- **Unavailable is neither risky nor safe**: a check that cannot run adds no points, is never shown as passed, and the report says the assessment is incomplete.
- A finding code is scored once per scan, so two checks reporting the same problem cannot double-count it.
- A recently registered domain adds a few points (18 at most). Domain age is one signal, so on its own it never reaches "Suspicious".
- **HTTPS never lowers the score**: a valid certificate is worth 0 points. Nothing subtracts points.
- Levels: 0 to 14 Low Risk, 15 to 34 Some Caution, 35 to 64 Suspicious, 65 to 100 High Risk. No level means "completely safe".
- The report shows the eight main checks (domain registration, SSL, Google Safe Browsing, DNS, URL patterns, brand impersonation, redirects, page content). Hosting and HTTP details are kept under "Advanced technical details".

## Security measures

- **SSRF**: only `http`/`https`; ports 80, 443, 8080, 8443; localhost, private, link-local, CGNAT, multicast, documentation and other reserved IPv4/IPv6 ranges are refused (`lib/scanner/ip-guard.js`), including decimal, hex and octal IP spellings and IPv4-mapped IPv6.
- **DNS rebinding**: a hostname is rejected if *any* of its addresses is non-public, and the connection is pinned to the address that was validated, so a second DNS answer cannot redirect the socket.
- **Redirects**: never followed automatically; each target goes through the same validation. Maximum 5.
- **Limits**: 7 s per request, 10 s per check, 256 KB response cap, no compression accepted.
- **No execution**: downloaded HTML is only read as text. No cookies or credentials are ever sent; credentials embedded in a URL are stripped before any request.
- **Rate limiting**: per IP and per user on scans, per IP on reports and reads (`lib/server/rate-limit.js`).
- **Reports**: server-side validation, honeypot field, minimum fill time, reporter IP stored only as a salted hash.
- **API hygiene**: JSON-only bodies with size caps, same-origin check on state-changing routes, bearer ID tokens verified with the Admin SDK, generic error messages.
- **Secrets**: Admin credentials and API keys have no `NEXT_PUBLIC_` prefix and are only imported by server code.

### Known limits

- The rate limiter is in-memory, so on serverless hosting each instance counts separately. For strict global limits, back `rateLimit()` with a shared store such as Upstash Redis.
- RDAP is not published by every registry (several country-code TLDs). Those scans show "Registration date unavailable" instead of guessing.
- Registry servers rate-limit and occasionally time out. A failed lookup is reported as unavailable, and a rescan fetches fresh data.
- The brand list is curated and finite. It catches common impersonation targets, not every brand.
- A scan is a snapshot of automated indicators, not a guarantee.

## Project structure

```
app/
  (marketing)/      landing page, public scanner (/check), report form
  (auth)/           login, register, forgot password
  (app)/            dashboard, scanner, history, report detail, profile (sidebar shell)
  api/              route handlers: scan, scans, scans/[id], reports
components/
  ui/               Button, Card, Field, Badge, Modal, Toast, PageHeading, ...
  layout/           header, footer, app shell, logo, providers
  auth/ scan/ dashboard/ profile/ report/
lib/
  firebase/         config.js (web), client.js, admin.js (server)
  services/         auth-service, scan-service, use-scans
  server/           auth, rate-limit, http helpers, Firestore repositories
  scanner/          url, ip-guard, safe-request, checks/, data/
  scoring/          levels, risk-score, recommendations
  utils/            validation, format, cn
styles/tokens.css   all design tokens (Bold Brutalist)
tests/              scanner, scoring and network tests
firestore.rules, firestore.indexes.json, firebase.json
```

## Design system

All colors, fonts, borders and shadows are CSS variables in `styles/tokens.css`, mapped to Tailwind utilities in `app/globals.css` (`bg-paper`, `bg-yellow`, `shadow-hard`, `font-display`, ...). Corners are square everywhere, shadows are hard offsets with no blur, and there are no gradients. Fonts (Archivo, Space Grotesk, Space Mono) are self-hosted through `@fontsource`.

Risk levels use green (Low Risk), amber (Some Caution), orange (Suspicious) and red (High Risk), always with a text label and icon.

## Scope

This version is for regular users only. There is no admin panel, no roles and no moderation UI. Submitted reports are stored in Firestore for a future admin feature.
