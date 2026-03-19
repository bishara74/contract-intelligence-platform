# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Changed
- **Jenkins CI pipeline** expanded from 3 to 7 stages: added Build Images (parallel), Push to ECR, Deploy (Render + Alembic migrations), and Smoke Test (2026-03-19)
- Post block now prunes both dangling images and stopped containers

### Added
- **Jenkins CI pipeline** (`Jenkinsfile`) with seven stages: Checkout, Lint, Test, Build Images, Push to ECR, Deploy, and Smoke Test (2026-03-19)
- **Ruff linter configuration** (`backend/ruff.toml`) with pyflakes, pycodestyle, and isort rules; line-length 120; alembic excluded
- CI/CD section in README documenting the Jenkins pipeline
- **Operational shell scripts** in `scripts/` directory (2026-03-19):
  - `healthcheck.sh` — API health check with response time monitoring (configurable URL and timeout)
  - `ecr-deploy.sh` — Full Lambda deployment pipeline: ECR login → Docker build → push → Lambda update with status polling
  - `db-backup.sh` — Timestamped compressed PostgreSQL backup with automatic retention cleanup
- **Makefile** with 16 targets for development, testing, database, deployment, and cleanup shortcuts (2026-03-19)
- **Nginx reverse proxy** (`nginx/`) with rate limiting on chat endpoint (5r/m per IP), security headers (CSP, X-Frame-Options, etc.), gzip compression, WebSocket support for Vite HMR, and 50M upload limit (2026-03-19)
- Docker Compose network isolation: `frontend-net` (nginx, frontend, api) and `backend-net` (api, db, redis, dynamodb-local, celery-worker)
