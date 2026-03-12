# -----------------------------------------------------------------------------
# Render PostgreSQL Database
# -----------------------------------------------------------------------------

resource "render_postgres" "db" {
  name            = "${var.app_name}-db"
  region          = "oregon"
  plan            = "free"
  database_name   = "contract_intel"
  database_user   = "contract_intel_user"
  version         = "16"
}

# -----------------------------------------------------------------------------
# Render Web Service (FastAPI Backend)
# -----------------------------------------------------------------------------

resource "render_web_service" "api" {
  name       = var.app_name
  region     = "oregon"
  plan       = "free"
  runtime    = "docker"
  root_dir   = "backend"

  repo_url = var.github_repo_url
  branch   = "main"

  # NOTE: The Render provider may use different attribute names for the Docker
  # start command. Check docs for the correct field (e.g. docker_command,
  # start_command, etc.). The command below runs migrations then starts the app.
  start_command = "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT"

  health_check_path = "/api/v1/health"

  env_vars = {
    DATABASE_URL         = replace(render_postgres.db.connection_string, "postgres://", "postgresql+asyncpg://")
    OPENAI_API_KEY       = var.openai_api_key
    PINECONE_API_KEY     = var.pinecone_api_key
    PINECONE_INDEX_NAME  = pinecone_index.main.name
    R2_ENDPOINT_URL      = "https://${var.cloudflare_account_id}.r2.cloudflarestorage.com"
    R2_ACCESS_KEY_ID     = var.r2_access_key_id
    R2_SECRET_ACCESS_KEY = var.r2_secret_access_key
    R2_BUCKET_NAME       = cloudflare_r2_bucket.pdfs.name
    CORS_ORIGINS         = "http://localhost:5173,${var.frontend_url}"
    CLERK_SECRET_KEY     = var.clerk_secret_key
    CLERK_WEBHOOK_SECRET = var.clerk_webhook_secret
    USE_CELERY           = "false"
  }
}

# NOTE: The Render Terraform provider's exact attribute names may differ from
# what's shown above. If `terraform plan` reports unknown attributes, consult:
# https://registry.terraform.io/providers/render-oss/render/latest/docs
#
# Common differences:
# - env_vars may need to be individual `env_var` blocks instead of a map
# - connection_string may be under a different attribute path
# - repo_url / branch may be nested under a `git` block
# - start_command may be docker_command or nested under runtime_source
