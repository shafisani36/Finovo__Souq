#!/usr/bin/env sh
# Daily backup of the database and uploaded files. Run from the project folder, for example with cron:
#   30 2 * * * cd /opt/finovo-souq && ./deploy/backup.sh >> /var/log/souq-backup.log 2>&1
set -eu

BACKUP_DIR="${BACKUP_DIR:-./backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
STAMP="$(date +%Y-%m-%d_%H%M)"
mkdir -p "$BACKUP_DIR"

docker compose exec -T mongo mongodump --db finovo_souq --archive --gzip > "$BACKUP_DIR/db_$STAMP.archive.gz"
docker compose exec -T backend tar -czf - -C /app uploads > "$BACKUP_DIR/uploads_$STAMP.tar.gz"

# Delete backups older than KEEP_DAYS days
find "$BACKUP_DIR" -type f -name '*.gz' -mtime +"$KEEP_DAYS" -delete
echo "Backup finished: $STAMP"
