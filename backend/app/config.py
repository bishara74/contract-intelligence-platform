from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Database
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/contract_intel"

    # OpenAI
    openai_api_key: str = ""

    # Pinecone
    pinecone_api_key: str = ""
    pinecone_index_name: str = "contract-intelligence"

    # Cloudflare R2
    r2_endpoint_url: str = ""
    r2_access_key_id: str = ""
    r2_secret_access_key: str = ""
    r2_bucket_name: str = "contract-intelligence"

    # Redis / Celery
    redis_url: str = "redis://redis:6379/0"
    use_celery: bool = False

    # AWS DynamoDB
    use_dynamodb: bool = False
    aws_region: str = "eu-central-1"
    dynamodb_table_name: str = "contract-intel-chat-messages"
    dynamodb_endpoint_url: str = ""  # Empty = real AWS, http://dynamodb-local:8000 for local
    aws_access_key_id_dynamo: str = ""
    aws_secret_access_key_dynamo: str = ""

    # AWS Lambda
    use_lambda: bool = False
    lambda_process_function_name: str = "contract-intel-process"

    # Clerk
    clerk_secret_key: str = ""
    clerk_webhook_secret: str = ""

    # CORS
    cors_origins: str = "http://localhost:5173,https://contract-intelligence-platform-3zjo.vercel.app,https://contract-intelligence-platform-3zjo-del8q4hgg.vercel.app"

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",")]


settings = Settings()
