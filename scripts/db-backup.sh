#!/bin/bash
set -euo pipefail

# ─── Database Backup Script ─────────────────────────────────────────────────
# Creates a timestamped, compressed PostgreSQL backup and cleans up old ones.
#
# Environment variables:
#   DATABASE_URL    — PostgreSQL connection string (REQUIRED)
#                     Supports postgresql:// and postgresql+asyncpg:// formats
#   BACKUP_DIR      — Directory for backup files (default: ./backups)
#   RETENTION_DAYS  — Delete backups older than this many days (default: 7)
# ─────────────────────────────────────────────────────────────────────────────

# ── Colors ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# ── Logging helpers ──────────────────────────────────────────────────────────
timestamp() { date '+%Y-%m-%d %H:%M:%S'; }
log_info()    { echo -e "[$(timestamp)] ${GREEN}[INFO]${NC}  $*"; }
log_warn()    { echo -e "[$(timestamp)] ${YELLOW}[WARN]${NC}  $*"; }
log_error()   { echo -e "[$(timestamp)] ${RED}[ERROR]${NC} $*"; }

# ── Configuration ────────────────────────────────────────────────────────────

# DATABASE_URL is required — fail immediately if not set
if [[ -z "${DATABASE_URL:-}" ]]; then
    log_error "DATABASE_URL is not set. Export it before running this script."
    log_error "  Example: export DATABASE_URL=postgresql://user:pass@host:5432/dbname"
    exit 1
fi

BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"

# ── Parse DATABASE_URL ───────────────────────────────────────────────────────
# Strip the driver suffix (e.g., postgresql+asyncpg:// → postgresql://)
# and remove query parameters (e.g., ?sslmode=require) before parsing.

CLEAN_URL="${DATABASE_URL}"
# Normalize scheme: replace postgresql+asyncpg:// with postgresql://
CLEAN_URL="$(echo "${CLEAN_URL}" | sed 's|postgresql+asyncpg://|postgresql://|')"
# Strip query parameters
CLEAN_URL="${CLEAN_URL%%\?*}"

# Extract components from postgresql://user:password@host:port/dbname
DB_USER="$(echo "${CLEAN_URL}" | sed -n 's|postgresql://\([^:]*\):.*|\1|p')"
DB_PASS="$(echo "${CLEAN_URL}" | sed -n 's|postgresql://[^:]*:\([^@]*\)@.*|\1|p')"
DB_HOST="$(echo "${CLEAN_URL}" | sed -n 's|.*@\([^:]*\):.*|\1|p')"
DB_PORT="$(echo "${CLEAN_URL}" | sed -n 's|.*:\([0-9]*\)/.*|\1|p')"
DB_NAME="$(echo "${CLEAN_URL}" | sed -n 's|.*/\([^?]*\)|\1|p')"

# Validate parsed values
if [[ -z "${DB_USER}" || -z "${DB_HOST}" || -z "${DB_NAME}" ]]; then
    log_error "Failed to parse DATABASE_URL. Expected format:"
    log_error "  postgresql://user:password@host:port/dbname"
    exit 1
fi

# Default port to 5432 if not specified
DB_PORT="${DB_PORT:-5432}"

log_info "Database: ${DB_NAME}@${DB_HOST}:${DB_PORT} (user: ${DB_USER})"

# ── Prerequisite check ───────────────────────────────────────────────────────
if ! command -v pg_dump &> /dev/null; then
    log_error "pg_dump is not installed or not in PATH"
    exit 1
fi

# ── Create backup directory ──────────────────────────────────────────────────
if [[ ! -d "${BACKUP_DIR}" ]]; then
    log_info "Creating backup directory: ${BACKUP_DIR}"
    mkdir -p "${BACKUP_DIR}"
fi

# ── Generate backup ─────────────────────────────────────────────────────────
BACKUP_TIMESTAMP="$(date +%Y-%m-%d-%H%M%S)"
BACKUP_FILE="${BACKUP_DIR}/contract-intel-backup-${BACKUP_TIMESTAMP}.sql.gz"

log_info "Starting backup → ${BACKUP_FILE}"

# Run pg_dump piped to gzip. PGPASSWORD is used for non-interactive auth.
export PGPASSWORD="${DB_PASS}"
pg_dump \
    -h "${DB_HOST}" \
    -p "${DB_PORT}" \
    -U "${DB_USER}" \
    -d "${DB_NAME}" \
    --no-owner \
    --no-privileges \
    | gzip > "${BACKUP_FILE}" \
    || { log_error "pg_dump failed"; rm -f "${BACKUP_FILE}"; exit 1; }
unset PGPASSWORD

# ── Verify backup ───────────────────────────────────────────────────────────
if [[ ! -s "${BACKUP_FILE}" ]]; then
    log_error "Backup file is empty or missing: ${BACKUP_FILE}"
    rm -f "${BACKUP_FILE}"
    exit 1
fi

# Print human-readable file size
BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | awk '{print $1}')
log_info "Backup complete: ${BACKUP_FILE} (${BACKUP_SIZE})"

# ── Cleanup old backups ─────────────────────────────────────────────────────
# Delete backups older than RETENTION_DAYS.

log_info "Cleaning up backups older than ${RETENTION_DAYS} days..."
DELETED_COUNT=0
while IFS= read -r old_file; do
    log_warn "Deleting expired backup: ${old_file}"
    rm -f "${old_file}"
    DELETED_COUNT=$((DELETED_COUNT + 1))
done < <(find "${BACKUP_DIR}" -name "contract-intel-backup-*.sql.gz" -type f -mtime "+${RETENTION_DAYS}" 2>/dev/null)

if (( DELETED_COUNT > 0 )); then
    log_info "Deleted ${DELETED_COUNT} expired backup(s)"
else
    log_info "No expired backups to clean up"
fi

# ── Summary ──────────────────────────────────────────────────────────────────
REMAINING=$(find "${BACKUP_DIR}" -name "contract-intel-backup-*.sql.gz" -type f 2>/dev/null | wc -l)
log_info "Backup directory contains ${REMAINING} backup(s)"
log_info "Done"
exit 0
