# -----------------------------------------------------------------------------
# Provider API keys
# -----------------------------------------------------------------------------

variable "render_api_key" {
  description = "Render API key"
  type        = string
  sensitive   = true
}

variable "cloudflare_api_token" {
  description = "Cloudflare API token with R2 permissions"
  type        = string
  sensitive   = true
}

variable "cloudflare_account_id" {
  description = "Cloudflare account ID"
  type        = string
}

variable "pinecone_api_key" {
  description = "Pinecone API key"
  type        = string
  sensitive   = true
}

variable "openai_api_key" {
  description = "OpenAI API key for LLM and embeddings"
  type        = string
  sensitive   = true
}

# -----------------------------------------------------------------------------
# Clerk authentication
# -----------------------------------------------------------------------------

variable "clerk_secret_key" {
  description = "Clerk secret key for backend auth"
  type        = string
  sensitive   = true
}

variable "clerk_webhook_secret" {
  description = "Clerk webhook signing secret"
  type        = string
  sensitive   = true
  default     = ""
}

# -----------------------------------------------------------------------------
# Cloudflare R2 credentials
# -----------------------------------------------------------------------------

variable "r2_access_key_id" {
  description = "R2 S3-compatible access key ID"
  type        = string
  sensitive   = true
}

variable "r2_secret_access_key" {
  description = "R2 S3-compatible secret access key"
  type        = string
  sensitive   = true
}

# -----------------------------------------------------------------------------
# Application settings
# -----------------------------------------------------------------------------

variable "app_name" {
  description = "Application name used for resource naming"
  type        = string
  default     = "contract-intelligence-platform"
}

variable "environment" {
  description = "Deployment environment (prod, staging, etc.)"
  type        = string
  default     = "prod"
}

variable "github_repo_url" {
  description = "GitHub repository URL for Render deployments"
  type        = string
  default     = "https://github.com/bishara74/contract-intelligence-platform"
}

variable "frontend_url" {
  description = "Frontend URL for CORS configuration"
  type        = string
  default     = "https://contract-intelligence-platform-3zjo.vercel.app"
}

# -----------------------------------------------------------------------------
# AWS (DynamoDB)
# -----------------------------------------------------------------------------

variable "aws_region" {
  description = "AWS region for DynamoDB and Lambda"
  type        = string
  default     = "eu-central-1"
}

variable "aws_access_key_id" {
  description = "AWS access key"
  type        = string
  sensitive   = true
}

variable "aws_secret_access_key" {
  description = "AWS secret key"
  type        = string
  sensitive   = true
}
