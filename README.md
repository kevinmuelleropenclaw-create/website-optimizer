# Website Optimizer (Scrape → AI Analyse → Optimierung → Netlify Deploy)

Komplette Webanwendung, die eine Website-URL annimmt, die Seite scraped, mit AI Optimierungen ableitet, eine optimierte Demo-Version als statische Website generiert und automatisch zu Netlify deployed.

## Features

- 🔒 **Sicher**: Rate limiting, Helmet security headers, Input validation
- ⚡ **Performance**: Gzip compression, Caching, Timeouts
- 🐳 **Containerized**: Docker support mit multi-stage builds
- 🚀 **CI/CD**: GitHub Actions für automatische Builds
- 📊 **Monitoring**: Structured logging, Health checks
- 🔄 **Resilient**: Graceful shutdown, Error fallbacks, Job timeouts

## Schnellstart

### Mit Docker (Empfohlen für Production)

```bash
# Image bauen
docker build -t website-optimizer:latest .

# Mit Environment-Variablen starten
docker run -p 8080:8080 \
  -e NETLIFY_TOKEN=your_token \
  -e OPENAI_API_KEY=your_key \
  website-optimizer:latest
```

### Lokale Entwicklung

```bash
# Backend installieren
cd backend
cp .env.example .env
npm install

# .env konfigurieren (siehe Konfiguration)
nano .env

# Starten
npm run dev
```

Frontend: <http://localhost:8080/>  
Health Check: <http://localhost:8080/api/health>

## Konfiguration

### Erforderliche Environment-Variablen

| Variable | Beschreibung | Standard |
|----------|--------------|----------|
| `NETLIFY_TOKEN` | **Pflicht** für Deployment | - |
| `PORT` | Server Port | 8080 |
| `NODE_ENV` | production/development | development |

### Optionale Environment-Variablen

| Variable | Beschreibung | Standard |
|----------|--------------|----------|
| `OPENAI_API_KEY` | Für AI-Analyse (sonst heuristisch) | - |
| `OPENAI_MODEL` | OpenAI Model | gpt-4o-mini |
| `NETLIFY_SITE_ID` | Existierende Netlify Site | - |
| `NETLIFY_SITE_NAME` | Custom Site Name | random |
| `CORS_ORIGIN` | CORS erlaubte Origins | * |
| `RATE_LIMIT_MAX` | Requests pro IP (15min) | 100 |
| `API_RATE_LIMIT_MAX` | API Requests pro IP (1h) | 10 |
| `SCRAPE_TIMEOUT_MS` | Scraping Timeout | 30000 |
| `WORKER_TIMEOUT_MS` | Job Timeout | 300000 |
| `SCRAPE_MAX_SIZE_MB` | Max. HTML Größe | 10 |

## API Endpoints

### Health Check
```http
GET /api/health
```

### Job erstellen
```http
POST /api/jobs
Content-Type: application/json

{
  "url": "https://example.com"
}

Response:
{
  "id": "uuid"
}
```

### Job Status
```http
GET /api/jobs/:id
```

### Real-time Progress (SSE)
```http
GET /api/jobs/:id/events
```

## Production Deployment

### 1. Vercel (Empfohlen)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

### 2. Docker Compose

```yaml
version: '3.8'
services:
  app:
    image: website-optimizer:latest
    ports:
      - "8080:8080"
    environment:
      - NODE_ENV=production
      - NETLIFY_TOKEN=${NETLIFY_TOKEN}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    volumes:
      - ./data:/app/backend/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:8080/api/health')"]
      interval: 30s
      timeout: 3s
      retries: 3
```

### 3. Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: website-optimizer
spec:
  replicas: 2
  selector:
    matchLabels:
      app: website-optimizer
  template:
    metadata:
      labels:
        app: website-optimizer
    spec:
      containers:
      - name: app
        image: ghcr.io/username/website-optimizer:latest
        ports:
        - containerPort: 8080
        env:
        - name: NODE_ENV
          value: "production"
        - name: NETLIFY_TOKEN
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: netlify-token
        livenessProbe:
          httpGet:
            path: /api/health
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 30
```

## Sicherheit

- **Rate Limiting**: 100 Requests/15min, 10 API Calls/1h
- **Helmet**: Security headers (CSP, HSTS, etc.)
- **Input Validation**: URL-Validierung mit Zod
- **Timeouts**: Alle externen Requests haben Timeouts
- **Size Limits**: Max 10MB für gescrapte Seiten
- **Error Handling**: Keine Stack-Traces in Production

## Monitoring

### Structured Logging
Alle Logs sind JSON-formatiert:
```json
{
  "timestamp": "2025-02-17T12:00:00Z",
  "level": "info",
  "event": "job_completed",
  "jobId": "uuid",
  "duration": 45000
}
```

### Health Check
```bash
curl http://localhost:8080/api/health
```

### Metriken
- Job duration
- Success/failure rates
- Queue length
- Response times

## Troubleshooting

### Netlify API 401
- `NETLIFY_TOKEN` prüfen

### OpenAI Fehler
- `OPENAI_API_KEY` prüfen
- Bei Fehlern wird automatisch heuristische Analyse verwendet

### Scraping Timeout
- `SCRAPE_TIMEOUT_MS` erhöhen
- URL erreichbarkeit prüfen

### Hohe Memory-Nutzung
- `SCRAPE_MAX_SIZE_MB` reduzieren
- Große Seiten werden automatisch abgelehnt

## Entwicklung

```bash
# Linting & Tests
npm run security:audit
npm run health:check

# Docker
npm run docker:build
npm run docker:run
```

## Lizenz

MIT

## Changelog

Siehe [CHANGELOG.md](CHANGELOG.md)
