terraform {
  required_version = ">= 1.5.0"

  required_providers {
    render = {
      source  = "render-oss/render"
      version = "~> 1.8"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.0"
    }
    pinecone = {
      source  = "pinecone-io/pinecone"
      version = "~> 3.0"
    }
  }
}

provider "render" {
  api_key = var.render_api_key
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

provider "pinecone" {
  api_key = var.pinecone_api_key
}
