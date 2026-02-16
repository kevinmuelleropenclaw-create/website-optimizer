# Website Optimizer (Scrape → AI Analyse → Optimierung → Netlify Deploy)

Komplette Beispiel-Webanwendung, die eine Website-URL annimmt, die Seite scraped, (optional) mit AI Optimierungen ableitet, eine optimierte Demo-Version als statische Website generiert und automatisch zu Netlify deployed.

## Struktur

- `frontend/` – einfache HTML/JS Oberfläche (Formular + Fortschritt via SSE)
- `backend/` – Node.js/Express API + Worker + SQLite Job-Store

## Features

- URL-Validierung (http/https)
- Job-Queue (SQLite)
- Fortschrittsanzeige: `scraping → analysis → optimization → deployment → done`
- Fehlerbehandlung
- Ergebnis-Link zur optimierten Website (Netlify)

## Voraussetzungen

- Node.js >= 20 (empfohlen: 22)
- Netlify Access Token
- Optional: OpenAI API Key (sonst heuristische Analyse)

## Setup

### 1) Backend installieren

```bash
cd backend
cp .env.example .env
npm install
```

### 2) .env konfigurieren

In `backend/.env`:

- `NETLIFY_TOKEN=...` (Pflicht, sonst kann kein Deployment stattfinden)
- Optional:
  - `NETLIFY_SITE_ID=...` (wenn in ein existierendes Netlify Site deployt werden soll)
  - `NETLIFY_SITE_NAME=...` (nur relevant, wenn `NETLIFY_SITE_ID` leer ist)
  - `OPENAI_API_KEY=...` + `OPENAI_MODEL=...`

### 3) Starten

```bash
cd backend
npm run start
```

Dann im Browser öffnen:

- Frontend: <http://localhost:8080/>
- Health: <http://localhost:8080/api/health>

## Nutzung

1. URL in das Formular eingeben (z.B. `https://example.com`)
2. Fortschritt beobachten (SSE Stream)
3. Am Ende erscheint ein Netlify Link zur optimierten Demo-Website

## API

### POST `/api/jobs`

Body:

```json
{ "url": "https://example.com" }
```

Response:

```json
{ "id": "..." }
```

### GET `/api/jobs/:id`

Liefert aktuellen Status.

### GET `/api/jobs/:id/events`

Server-Sent Events Stream mit Job-Updates.

## Hinweise / Einschränkungen

- Scraping ist bewusst simpel (HTML + kurzer Text-Auszug). Für produktiv: Robots.txt respektieren, Timeouts, Rendern von JS-Seiten (Playwright), Rate-Limits.
- Netlify Deploy erfolgt über die Netlify REST API (Deploys + file uploads). Bei sehr großen Seiten sollten Uploads parallelisiert und robustifiziert werden.
- AI Analyse: wenn `OPENAI_API_KEY` nicht gesetzt ist, läuft ein heuristischer Fallback.

## Troubleshooting

- **Netlify API error 401** → `NETLIFY_TOKEN` prüfen.
- **OpenAI error** → `OPENAI_API_KEY`/Billing/Model prüfen; sonst Key entfernen um Fallback zu nutzen.
- **CORS** → Backend nutzt `cors()` standardmäßig.

## Lizenz

MIT (Beispielcode).
