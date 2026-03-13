provider "aws" {
  region     = var.aws_region
  access_key = var.aws_access_key_id
  secret_key = var.aws_secret_access_key
}

resource "aws_dynamodb_table" "chat_messages" {
  name         = "${var.app_name}-chat-messages"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "contract_id"
  range_key    = "created_at"

  attribute {
    name = "contract_id"
    type = "S"
  }

  attribute {
    name = "created_at"
    type = "S"
  }

  tags = {
    Project     = var.app_name
    Environment = var.environment
  }
}

output "dynamodb_table_name" {
  value = aws_dynamodb_table.chat_messages.name
}
