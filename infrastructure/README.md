# Infrastructure as Code — Contract Intelligence Platform

Terraform configurations for provisioning all cloud infrastructure that powers the Contract Intelligence Platform.

## Managed Resources

| Resource | Provider | Purpose |
|----------|----------|---------|
| Web Service | [Render](https://render.com) | FastAPI backend (Docker) |
| PostgreSQL | [Render](https://render.com) | Contract and user metadata |
| R2 Bucket | [Cloudflare](https://cloudflare.com) | PDF file storage (S3-compatible) |
| Vector Index | [Pinecone](https://pinecone.io) | Semantic search embeddings (1536-dim, cosine) |

## Not Managed by Terraform

| Resource | Reason |
|----------|--------|
| **Vercel frontend** | Managed via Vercel's GitHub integration — automatic deploys on push |
| **Clerk authentication** | No official Terraform provider available |
| **R2 CORS policy** | Can be configured via `cloudflare_r2_bucket_cors` resource or manually in the dashboard |

## Prerequisites

- [Terraform CLI](https://developer.hashicorp.com/terraform/downloads) >= 1.5.0
- API keys for:
  - **Render** — [Dashboard → Account Settings → API Keys](https://dashboard.render.com/settings#api-keys)
  - **Cloudflare** — API token with R2 read/write permissions
  - **Pinecone** — [Console → API Keys](https://app.pinecone.io)
  - **OpenAI** — [Platform → API Keys](https://platform.openai.com/api-keys)
  - **Clerk** — [Dashboard → API Keys](https://dashboard.clerk.com)

## Setup

```bash
cd infrastructure
cp terraform.tfvars.example terraform.tfvars
# Fill in your API keys in terraform.tfvars
terraform init
terraform plan
terraform apply
```

## Importing Existing Resources

Since the infrastructure already exists (set up manually via dashboards), use `terraform import` to bring existing resources under Terraform management:

```bash
# Render PostgreSQL
terraform import render_postgres.db <postgres-id>

# Render Web Service
terraform import render_web_service.api <service-id>

# Cloudflare R2 Bucket
terraform import cloudflare_r2_bucket.pdfs <account-id>/contract-intelligence-platform-pdfs

# Pinecone Index
terraform import pinecone_index.main contract-intelligence
```

> **Tip:** Resource IDs can be found in each provider's dashboard. After importing, run `terraform plan` to verify the state matches — you may need to adjust attribute values to eliminate drift.

## Using for New Environments

These configs are also useful for spinning up new environments (e.g., staging or disaster recovery):

```bash
cp terraform.tfvars.example terraform.tfvars.staging
# Edit with staging-specific values
terraform workspace new staging
terraform apply -var-file=terraform.tfvars.staging
```
