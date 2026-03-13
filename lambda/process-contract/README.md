# Contract Processing Lambda

AWS Lambda function for serverless PDF contract processing. Handles the heavy compute pipeline: downloading PDFs from Cloudflare R2, parsing with PyMuPDF, chunking with LangChain, generating embeddings with OpenAI, and upserting vectors to Pinecone.

## Architecture

```
Cloudflare R2 (PDF) → Lambda → OpenAI Embeddings → Pinecone (vectors)
                             → PostgreSQL (status update)
```

## Environment Variables

| Variable | Description |
|---|---|
| `OPENAI_API_KEY` | OpenAI API key for embeddings (text-embedding-3-small) |
| `PINECONE_API_KEY` | Pinecone API key |
| `PINECONE_INDEX_NAME` | Pinecone index name (e.g. `contract-intelligence`) |
| `DATABASE_URL` | Sync PostgreSQL URL (e.g. `postgresql://user:pass@host/db`) — NOT asyncpg |

## Build

```bash
docker build -t contract-intel-process .
```

## Deploy to AWS

### 1. Create ECR Repository

```bash
aws ecr create-repository --repository-name contract-intel-process --region eu-central-1
```

### 2. Push Image to ECR

```bash
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=eu-central-1

aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com

docker tag contract-intel-process:latest $AWS_ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/contract-intel-process:latest
docker push $AWS_ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/contract-intel-process:latest
```

### 3. Create Lambda Function

```bash
aws lambda create-function \
  --function-name contract-intel-process \
  --package-type Image \
  --code ImageUri=$AWS_ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/contract-intel-process:latest \
  --role arn:aws:iam::$AWS_ACCOUNT_ID:role/contract-intelligence-platform-lambda-role \
  --timeout 300 \
  --memory-size 1024 \
  --region $REGION \
  --environment "Variables={OPENAI_API_KEY=sk-...,PINECONE_API_KEY=pcsk_...,PINECONE_INDEX_NAME=contract-intelligence,DATABASE_URL=postgresql://...}"
```

## Local Testing

Use the Lambda Runtime Interface Emulator (RIE) built into the base image:

```bash
docker run -p 9000:8080 \
  -e OPENAI_API_KEY=sk-... \
  -e PINECONE_API_KEY=pcsk_... \
  -e PINECONE_INDEX_NAME=contract-intelligence \
  -e DATABASE_URL=postgresql://... \
  contract-intel-process:latest

# Invoke
curl -X POST "http://localhost:9000/2015-03-31/functions/function/invocations" \
  -d '{
    "contract_id": "abc-123",
    "user_id": "user-456",
    "file_url": "https://r2-presigned-url...",
    "filename": "contract.pdf",
    "pinecone_namespace": "user_user-456_contract_abc-123"
  }'
```

## Input Event

```json
{
  "contract_id": "uuid-string",
  "user_id": "uuid-string",
  "file_url": "https://r2-presigned-download-url...",
  "filename": "contract.pdf",
  "pinecone_namespace": "user_{user_id}_contract_{contract_id}"
}
```

## Response

```json
{
  "statusCode": 200,
  "body": "{\"contract_id\": \"...\", \"page_count\": 6, \"chunk_count\": 21, \"status\": \"ready\"}"
}
```
