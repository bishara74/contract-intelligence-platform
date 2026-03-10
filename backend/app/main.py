import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.routers import chat, clauses, contracts, health, risks

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup and shutdown events."""
    # Startup — ensure Pinecone index exists
    try:
        from app.services.vector_store import ensure_index_exists
        ensure_index_exists()
    except Exception as e:
        logger.warning("Pinecone index check failed (check credentials): %s", e)
    yield
    # Shutdown


app = FastAPI(
    title="Contract Intelligence API",
    description="AI-powered contract analysis with RAG, clause extraction, and risk detection.",
    version="1.0.0",
    lifespan=lifespan,
     redirect_slashes=False,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"success": False, "error": {"code": str(exc.status_code), "message": exc.detail}},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled exception on %s %s", request.method, request.url)
    return JSONResponse(
        status_code=500,
        content={"success": False, "error": {"code": "INTERNAL_ERROR", "message": str(exc)}},
    )


# Routers
app.include_router(health.router, prefix="/api/v1", tags=["health"])
app.include_router(contracts.router, prefix="/api/v1/contracts", tags=["contracts"])
app.include_router(chat.router, prefix="/api/v1/contracts", tags=["chat"])
app.include_router(clauses.router, prefix="/api/v1/contracts", tags=["clauses"])
app.include_router(risks.router, prefix="/api/v1/contracts", tags=["risks"])
