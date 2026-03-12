# -----------------------------------------------------------------------------
# Render PostgreSQL Database
# -----------------------------------------------------------------------------

resource "render_postgres" "db" {
  name          = "${var.app_name}-db"
  region        = "oregon"
  plan          = "free"
  database_name = "contract_intel"
  database_user = "contract_intel_user"
  version       = "16"
}

# -----------------------------------------------------------------------------
# Render Web Service (FastAPI Backend)
# -----------------------------------------------------------------------------

resource "render_web_service" "api" {
  name   = var.app_name
  region = "oregon"
  plan   = "free"

  runtime_source = {
    docker = {
      repo_url = var.github_repo_url
      branch   = "main"
    }
  }

  root_directory    = "backend"
  start_command     = "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT"
  health_check_path = "/api/v1/health"

  env_vars = {
    "DATABASE_URL"         = { value = replace(render_postgres.db.connection_info.internal_connection_string, "postgres://", "postgresql+asyncpg://") }
    "OPENAI_API_KEY"       = { value = var.openai_api_key }
    "PINECONE_API_KEY"     = { value = var.pinecone_api_key }
    "PINECONE_INDEX_NAME"  = { value = pinecone_index.main.name }
    "R2_ENDPOINT_URL"      = { value = "https://${var.cloudflare_account_id}.r2.cloudflarestorage.com" }
    "R2_ACCESS_KEY_ID"     = { value = var.r2_access_key_id }
    "R2_SECRET_ACCESS_KEY" = { value = var.r2_secret_access_key }
    "R2_BUCKET_NAME"       = { value = cloudflare_r2_bucket.pdfs.name }
    "CORS_ORIGINS"         = { value = "http://localhost:5173,${var.frontend_url}" }
    "CLERK_SECRET_KEY"     = { value = var.clerk_secret_key }
    "CLERK_WEBHOOK_SECRET" = { value = var.clerk_webhook_secret }
    "USE_CELERY"           = { value = "false" }
  }
}
