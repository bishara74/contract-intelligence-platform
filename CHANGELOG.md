# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- **Jenkins CI pipeline** (`Jenkinsfile`) with three stages: Checkout, Lint, and Test (2026-03-19)
- **Ruff linter configuration** (`backend/ruff.toml`) with pyflakes, pycodestyle, and isort rules; line-length 120; alembic excluded
- CI/CD section in README documenting the Jenkins pipeline
