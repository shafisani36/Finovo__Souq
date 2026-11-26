# Deploying Finovo Souq

The production stack runs with Docker Compose on one Linux server:

```
Visitor ──HTTPS──> Caddy (certificates) ──> nginx (React app, /api, /socket.io) ──> Node API ──> MongoDB + Redis
```

Everything is served from one domain, which the httpOnly refresh cookie (`SameSite=Strict`) and the live chat need.

## 1. Server

- Ubuntu 22.04 or later, 2 vCPU, 4 GB RAM, 40 GB disk is enough to start.
- Install Docker Engine and the Compose plugin: https://docs.docker.com/engine/install/ubuntu/
- Point the domain (and `www`) to the server's IP with an `A` record.
- Open ports 80 and 443 only. MongoDB and Redis are never exposed outside Docker.

## 2. Configuration

```bash
git clone https://github.com/shafisani36/Finovo__Souq.git /opt/finovo-souq
cd /opt/finovo-souq
cp .env.example .env                  # DOMAIN and REDIS_PASSWORD
cp backend/.env.example backend/.env  # app secrets
```

In `backend/.env` set:

| Variable | Value |
|---|---|
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | Two **different** random strings of 64+ characters: `openssl rand -hex 64` |
| `MAIL_*` | SMTP account for password reset and seller approval emails (Gmail needs an App Password) |

`MONGODB_URI`, `REDIS_*`, `CLIENT_URL`, `NODE_ENV` and `UPLOAD_DIR` are set by `docker-compose.yml`. The API refuses to start in production with short or identical secrets, or without an `https://` site address.

## 3. Start

```bash
docker compose up -d --build
docker compose ps                     # every service "healthy" / "running"
curl https://YOUR_DOMAIN/api/v1/health
```

On first start the API creates the category tree and the default settings. Create the first admin by registering normally, then:

```bash
docker compose exec mongo mongosh finovo_souq --eval 'db.users.updateOne({ email: "you@example.com" }, { $set: { role: "admin", status: "active" } })'
```

## 4. Releases and rollback

Every release is a git tag, so the server can always go back to the last good version.

```bash
# Release
./deploy/backup.sh                     # always back up first
git fetch --tags && git checkout v1.4.0
docker compose up -d --build
curl -fsS https://YOUR_DOMAIN/api/v1/health

# Rollback (the previous tag)
git checkout v1.3.2
docker compose up -d --build
```

Database changes in this project are additive (new fields get defaults when first read), so code can be rolled back without restoring the database. Restore a backup (section 5) only if data itself went wrong.

The API shuts down gracefully (finishes running requests, closes connections) when Docker restarts it.

## Staging

Run a second copy on another subdomain before every release, with its own data and secrets:

```bash
git clone https://github.com/shafisani36/Finovo__Souq.git /opt/finovo-souq-staging
cd /opt/finovo-souq-staging
cp .env.example .env                  # DOMAIN=staging.souq.example.com, different REDIS_PASSWORD
cp backend/.env.example backend/.env  # different JWT secrets; MAIL_* can point at a test inbox
COMPOSE_PROJECT_NAME=finovo-souq-staging docker compose up -d --build
```

If staging and production share one server, change the published ports of the staging `caddy` service, or put both behind one Caddy.

## 5. Backups

`deploy/backup.sh` saves the database and all uploaded photos and voice messages, and keeps 14 days:

```bash
crontab -e
30 2 * * * cd /opt/finovo-souq && ./deploy/backup.sh >> /var/log/souq-backup.log 2>&1
```

Copy the `backups/` folder to other storage (for example S3) as well. Restore:

```bash
docker compose exec -T mongo mongorestore --drop --archive --gzip < backups/db_DATE.archive.gz
docker compose exec -T backend tar -xzf - -C /app < backups/uploads_DATE.tar.gz
```

## 6. Monitoring and logs

- `GET /api/v1/health` returns `200` only when MongoDB and Redis both answer. Point an uptime monitor (UptimeRobot, Better Stack) at it.
- Logs: `docker compose logs -f backend`. In production every line is JSON with `level`, `message`, `requestId`, `method`, `path`, `status`, `durationMs` and `userId`, ready for any log service (Better Stack, Grafana Loki, CloudWatch).
- Every response has an `X-Request-Id` header, and server errors return it in the body, so a user's screenshot leads straight to the log line.
- Logs never contain passwords, tokens, reset codes, chat text, email addresses or query strings. `LOG_LEVEL` (`debug`, `info`, `warn`, `error`) changes how much is written.
- Error-monitoring services (such as Sentry) can be added once one is chosen.
- An hourly background job expires old ads and reminds sellers 3 days before. It uses a Redis lock, so it is safe with several API servers.

## 7. Scaling notes

- Live chat runs on one API instance. To run several, add the Socket.IO Redis adapter and sticky sessions.
- Uploaded files are on the server disk (`uploads` volume). For several servers, move them to shared object storage.

## Tests

- `cd backend && npm test` runs the unit tests.
- `cd frontend && npm test` runs the component and unit tests (Vitest).
- With a disposable database the backend also runs the API and security tests (the database is wiped):
  `TEST_MONGODB_URI=mongodb://127.0.0.1:27017/finovo_souq_test npm test` (Redis must be running; tests use Redis database 15).
- GitHub Actions (`.github/workflows/ci.yml`) runs all tests, lint, type check, build, dependency audit and Docker builds on every push to `main`.
