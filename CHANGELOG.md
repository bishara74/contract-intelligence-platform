# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- **Jenkins CI pipeline** (`Jenkinsfile`) with three stages: Checkout, Lint, and Test (2026-03-19)
- **Ruff linter configuration** (`backend/ruff.toml`) with pyflakes, pycodestyle, and isort rules; line-length 120; alembic excluded
- CI/CD section in README documenting the Jenkins pipeline
- **Operational shell scripts** in `scripts/` directory (2026-03-19):
  - `healthcheck.sh` — API health check with response time monitoring (configurable URL and timeout)
  - `ecr-deploy.sh` — Full Lambda deployment pipeline: ECR login → Docker build → push → Lambda update with status polling
  - `db-backup.sh` — Timestamped compressed PostgreSQL backup with automatic retention cleanup
- **Makefile** with 16 targets for development, testing, database, deployment, and cleanup shortcuts (2026-03-19)
