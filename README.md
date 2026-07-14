# Astra Device Performance Audit — secure split

This project separates the public attendee experience from Sam's private stage tools.

## Routes

- `/audit` — public questionnaire and the submitting clinic's scorecard only.
- `/stage` — password-protected submission list and private briefing notes.
- `/stage/projector/:id` — authenticated, chrome-free scorecard view.
- `/api/config` — public question labels and option IDs; no scoring weights or briefing copy.
- `/api/submit` — validates, scores, stores, and returns only the new submission's scorecard.
- `/api/submissions` and `/api/submission/:id` — require Sam's signed session cookie.

## Local setup

1. Create a Postgres database.
2. Run `schema.sql` against it.
3. Copy `.env.example` to `.env` and set all three values.
4. Run `npm install`.
5. Run `npm start`.
6. Open `http://localhost:3000/audit` and `http://localhost:3000/stage`.

## Vercel setup

Connect a Postgres provider from the Vercel Marketplace, then add `POSTGRES_URL`, `STAGE_PASSWORD`, and `SESSION_SECRET` in Project Settings → Environment Variables. Deploy the project root.

## Security boundary

The browser used by an attendee never receives:

- scoring weights or numeric option mappings;
- `renderBriefing()` or any private critique copy;
- a submission-list endpoint response;
- any other clinic's answers.

The stage APIs check an HTTP-only, SameSite=Strict, signed session cookie before reading submission data. The password and signing secret stay in server environment variables.

Before production, add rate limiting, retention/deletion rules, a privacy notice, and a managed authentication layer if more than one internal operator will use `/stage`.


## Launch additions

- Stage users can permanently delete a submission from its private detail view.
- Public submitters must accept the privacy acknowledgment before submitting.
- Run the two `ALTER TABLE` statements at the bottom of `schema.sql` once on an existing database before deploying this version.
