#!/bin/bash
set -euo pipefail

# ─── ECR Deploy Script ──────────────────────────────────────────────────────
# Automates the full Lambda deployment pipeline:
#   1. ECR login
#   2. Docker build from lambda/process-contract/
#   3. Tag and push to ECR (timestamped + latest)
#   4. Update Lambda function code
#   5. Poll until Lambda update is complete
#
# Environment variables:
#   AWS_REGION        — AWS region (default: eu-north-1)
#   ECR_REPO          — Full ECR repository URI
#   LAMBDA_FUNCTION   — Lambda function name (default: contract-intel-process)
#   IMAGE_TAG         — Docker image tag (default: YYYYMMDD-HHMMSS)
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
AWS_REGION="${AWS_REGION:-eu-north-1}"
ECR_REPO="${ECR_REPO:-916868259011.dkr.ecr.eu-north-1.amazonaws.com/contract-intel-process}"
LAMBDA_FUNCTION="${LAMBDA_FUNCTION:-contract-intel-process}"
IMAGE_TAG="${IMAGE_TAG:-$(date +%Y%m%d-%H%M%S)}"
POLL_INTERVAL=5
POLL_TIMEOUT=120

# Resolve the lambda build context relative to this script's location
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "${SCRIPT_DIR}")"
LAMBDA_DIR="${PROJECT_ROOT}/lambda/process-contract"

DEPLOY_START=$(date +%s)

log_info "Starting ECR deploy"
log_info "  Region:   ${AWS_REGION}"
log_info "  Repo:     ${ECR_REPO}"
log_info "  Lambda:   ${LAMBDA_FUNCTION}"
log_info "  Tag:      ${IMAGE_TAG}"

# ── Prerequisite checks ─────────────────────────────────────────────────────
# Verify docker and aws CLI are installed before proceeding.

if ! command -v docker &> /dev/null; then
    log_error "docker is not installed or not in PATH"
    exit 1
fi

if ! command -v aws &> /dev/null; then
    log_error "aws CLI is not installed or not in PATH"
    exit 1
fi

# ── Step 1: ECR Login ───────────────────────────────────────────────────────
log_info "Logging in to ECR..."
aws ecr get-login-password --region "${AWS_REGION}" \
    | docker login --username AWS --password-stdin "${ECR_REPO%%/*}" \
    || { log_error "ECR login failed"; exit 1; }
log_info "ECR login successful"

# ── Step 2: Docker Build ────────────────────────────────────────────────────
log_info "Building Docker image from ${LAMBDA_DIR}..."
docker build -t "${ECR_REPO}:${IMAGE_TAG}" "${LAMBDA_DIR}" \
    || { log_error "Docker build failed"; exit 1; }
log_info "Docker build complete"

# ── Step 3: Tag and Push ────────────────────────────────────────────────────
# Tag with both the timestamped tag and latest for convenience.

log_info "Tagging image as latest..."
docker tag "${ECR_REPO}:${IMAGE_TAG}" "${ECR_REPO}:latest"

log_info "Pushing ${ECR_REPO}:${IMAGE_TAG}..."
docker push "${ECR_REPO}:${IMAGE_TAG}" \
    || { log_error "Failed to push ${IMAGE_TAG}"; exit 1; }

log_info "Pushing ${ECR_REPO}:latest..."
docker push "${ECR_REPO}:latest" \
    || { log_error "Failed to push latest"; exit 1; }
log_info "Both tags pushed to ECR"

# ── Step 4: Update Lambda Function ──────────────────────────────────────────
IMAGE_URI="${ECR_REPO}:${IMAGE_TAG}"
log_info "Updating Lambda function ${LAMBDA_FUNCTION} with image ${IMAGE_URI}..."
aws lambda update-function-code \
    --region "${AWS_REGION}" \
    --function-name "${LAMBDA_FUNCTION}" \
    --image-uri "${IMAGE_URI}" \
    --no-cli-pager \
    || { log_error "Lambda update-function-code failed"; exit 1; }

# ── Step 5: Poll Lambda Status ──────────────────────────────────────────────
# Wait until LastUpdateStatus is "Successful" or timeout after 120 seconds.

log_info "Waiting for Lambda update to complete (timeout: ${POLL_TIMEOUT}s)..."
POLL_ELAPSED=0

while true; do
    STATUS=$(aws lambda get-function-configuration \
        --region "${AWS_REGION}" \
        --function-name "${LAMBDA_FUNCTION}" \
        --query 'LastUpdateStatus' \
        --output text \
        --no-cli-pager 2>/dev/null)

    if [[ "${STATUS}" == "Successful" ]]; then
        log_info "Lambda update status: ${STATUS}"
        break
    elif [[ "${STATUS}" == "Failed" ]]; then
        log_error "Lambda update FAILED"
        exit 1
    fi

    if (( POLL_ELAPSED >= POLL_TIMEOUT )); then
        log_error "Timed out waiting for Lambda update (${POLL_TIMEOUT}s). Last status: ${STATUS}"
        exit 1
    fi

    log_info "  Status: ${STATUS} — waiting ${POLL_INTERVAL}s..."
    sleep "${POLL_INTERVAL}"
    POLL_ELAPSED=$((POLL_ELAPSED + POLL_INTERVAL))
done

# ── Summary ──────────────────────────────────────────────────────────────────
DEPLOY_END=$(date +%s)
DURATION=$((DEPLOY_END - DEPLOY_START))

echo ""
log_info "========== Deploy Summary =========="
log_info "  Image URI:     ${IMAGE_URI}"
log_info "  Lambda:        ${LAMBDA_FUNCTION}"
log_info "  Status:        ${STATUS}"
log_info "  Duration:      ${DURATION}s"
log_info "===================================="
exit 0
