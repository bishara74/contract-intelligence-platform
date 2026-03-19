#!/bin/bash
set -euo pipefail

# ─── Healthcheck Script ─────────────────────────────────────────────────────
# Checks if the API is alive by hitting the health endpoint.
# Used by Jenkins smoke tests and manual monitoring.
#
# Environment variables:
#   API_URL  — Base URL of the API (default: http://localhost:8000)
#   TIMEOUT  — Request timeout in seconds (default: 10)
# ─────────────────────────────────────────────────────────────────────────────

# ── Colors ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ── Logging helpers ──────────────────────────────────────────────────────────
timestamp() { date '+%Y-%m-%d %H:%M:%S'; }
log_info()    { echo -e "[$(timestamp)] ${GREEN}[INFO]${NC}  $*"; }
log_warn()    { echo -e "[$(timestamp)] ${YELLOW}[WARN]${NC}  $*"; }
log_error()   { echo -e "[$(timestamp)] ${RED}[ERROR]${NC} $*"; }

# ── Configuration ────────────────────────────────────────────────────────────
API_URL="${API_URL:-http://localhost:8000}"
TIMEOUT="${TIMEOUT:-10}"
HEALTH_ENDPOINT="${API_URL}/api/v1/health"

log_info "Checking health at ${HEALTH_ENDPOINT} (timeout: ${TIMEOUT}s)"

# ── Health check request ─────────────────────────────────────────────────────
# Capture HTTP status code and response time in one curl call.
HTTP_RESPONSE=$(curl \
    --silent \
    --show-error \
    --max-time "${TIMEOUT}" \
    --output /dev/null \
    --write-out "%{http_code} %{time_total}" \
    "${HEALTH_ENDPOINT}" 2>&1) || {
    log_error "curl failed — is the API running at ${API_URL}?"
    exit 1
}

# Parse status code and response time from curl output
HTTP_CODE=$(echo "${HTTP_RESPONSE}" | awk '{print $1}')
RESPONSE_TIME=$(echo "${HTTP_RESPONSE}" | awk '{print $2}')

# ── Evaluate result ──────────────────────────────────────────────────────────

# Non-200 status → failure
if [[ "${HTTP_CODE}" != "200" ]]; then
    log_error "Health check FAILED — HTTP ${HTTP_CODE} (${RESPONSE_TIME}s)"
    exit 1
fi

# Slow response warning (> 5 seconds but still healthy)
if (( $(echo "${RESPONSE_TIME} > 5.0" | bc -l) )); then
    log_warn "Response time is slow: ${RESPONSE_TIME}s (threshold: 5.0s)"
fi

# ── Success ──────────────────────────────────────────────────────────────────
log_info "API is healthy — HTTP ${HTTP_CODE} (${RESPONSE_TIME}s)"
exit 0
