# -----------------------------------------------------------------------------
# Cloudflare R2 Bucket — PDF file storage
# -----------------------------------------------------------------------------

resource "cloudflare_r2_bucket" "pdfs" {
  account_id = var.cloudflare_account_id
  name       = "${var.app_name}-pdfs"
  location   = "WNAM"
}

# CORS policy (configure manually in Cloudflare dashboard or via
# cloudflare_r2_bucket_cors resource if supported by your provider version):
#
# AllowedOrigins: ["http://localhost:5173", "${var.frontend_url}"]
# AllowedMethods: ["GET", "PUT", "HEAD"]
# AllowedHeaders: ["*"]
# MaxAgeSeconds: 3600
