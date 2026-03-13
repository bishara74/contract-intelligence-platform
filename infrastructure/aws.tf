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

# ---------------------------------------------------------------------------
# ECR repository for Lambda container image
# ---------------------------------------------------------------------------

resource "aws_ecr_repository" "process_contract" {
  name                 = "${var.app_name}-process"
  image_tag_mutability = "MUTABLE"
  force_delete         = true

  tags = {
    Project     = var.app_name
    Environment = var.environment
  }
}

# ---------------------------------------------------------------------------
# IAM role for Lambda execution
# ---------------------------------------------------------------------------

resource "aws_iam_role" "lambda_execution" {
  name = "${var.app_name}-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Project     = var.app_name
    Environment = var.environment
  }
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# ---------------------------------------------------------------------------
# Lambda function (container image from ECR)
# ---------------------------------------------------------------------------

resource "aws_lambda_function" "process_contract" {
  function_name = "${var.app_name}-process"
  role          = aws_iam_role.lambda_execution.arn
  package_type  = "Image"
  image_uri     = "${aws_ecr_repository.process_contract.repository_url}:latest"
  timeout       = 300
  memory_size   = 1024

  environment {
    variables = {
      OPENAI_API_KEY      = var.openai_api_key
      PINECONE_API_KEY    = var.pinecone_api_key
      PINECONE_INDEX_NAME = "contract-intelligence"
      DATABASE_URL        = var.database_url_sync
    }
  }

  depends_on = [aws_ecr_repository.process_contract]

  tags = {
    Project     = var.app_name
    Environment = var.environment
  }
}

output "lambda_function_name" {
  value = aws_lambda_function.process_contract.function_name
}

output "ecr_repository_url" {
  value = aws_ecr_repository.process_contract.repository_url
}
