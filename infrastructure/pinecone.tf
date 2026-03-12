# -----------------------------------------------------------------------------
# Pinecone Serverless Index — vector embeddings for RAG
# -----------------------------------------------------------------------------

resource "pinecone_index" "main" {
  name      = "contract-intelligence"
  dimension = 1536
  metric    = "cosine"

  spec = {
    serverless = {
      cloud  = "aws"
      region = "us-east-1"
    }
  }
}
