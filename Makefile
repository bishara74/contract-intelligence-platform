.DEFAULT_GOAL := help

# ─────────────────────────────────────────────────────────────────────────────
# Contract Intelligence Platform — Makefile
# ─────────────────────────────────────────────────────────────────────────────

.PHONY: up down restart logs logs-all shell \
        test test-fast lint lint-fix \
        migrate migrate-create migrate-history backup \
        deploy-lambda healthcheck \
        clean clean-images \
        help

##@ Development

up: ## Start all services (build + detached)
	docker compose up --build -d

down: ## Stop all services and remove volumes
	docker compose down -v

restart: ## Restart all services
	docker compose restart

logs: ## Follow API container logs
	docker compose logs -f api

logs-all: ## Follow all container logs
	docker compose logs -f

shell: ## Open a bash shell in the API container
	docker compose exec api bash

##@ Testing & Quality

test: ## Run full test suite (verbose)
	docker compose exec api python -m pytest tests/ -v

test-fast: ## Run tests (short output, quiet)
	docker compose exec api python -m pytest tests/ -v --tb=short -q

lint: ## Run Ruff linter
	docker compose exec api ruff check app/

lint-fix: ## Run Ruff linter with auto-fix
	docker compose exec api ruff check app/ --fix

##@ Database

migrate: ## Run all pending Alembic migrations
	docker compose exec api alembic upgrade head

migrate-create: ## Create a new migration (usage: make migrate-create msg="add users table")
	docker compose exec api alembic revision --autogenerate -m "$(msg)"

migrate-history: ## Show Alembic migration history
	docker compose exec api alembic history

backup: ## Run PostgreSQL backup script
	./scripts/db-backup.sh

##@ Deployment

deploy-lambda: ## Build, push to ECR, and update Lambda function
	./scripts/ecr-deploy.sh

healthcheck: ## Check if the API is alive
	./scripts/healthcheck.sh

##@ Cleanup

clean: ## Remove dangling Docker resources and unused volumes
	docker system prune -f && docker volume prune -f

clean-images: ## Remove all unused Docker images
	docker image prune -a -f

##@ Help

help: ## Show this help message
	@echo ""
	@echo "Contract Intelligence Platform"
	@echo "=============================="
	@echo ""
	@awk 'BEGIN {FS = ":.*##"; section = ""} \
		/^##@/ { section = substr($$0, 5); next } \
		/^[a-zA-Z_-]+:.*##/ { \
			if (section != prev) { printf "\n\033[1m%s\033[0m\n", section; prev = section } \
			printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2 \
		}' $(MAKEFILE_LIST)
	@echo ""
