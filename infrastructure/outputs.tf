output "api_url" {
  description = "Render web service URL"
  value       = render_web_service.api.url
}

output "database_url" {
  description = "PostgreSQL connection string"
  value       = render_postgres.db.connection_info.internal_connection_string
  sensitive   = true
}

output "r2_bucket_name" {
  description = "Cloudflare R2 bucket name"
  value       = cloudflare_r2_bucket.pdfs.name
}

output "pinecone_index_name" {
  description = "Pinecone index name"
  value       = pinecone_index.main.name
}
