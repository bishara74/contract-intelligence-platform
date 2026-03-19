from typing import Any

from fastapi import HTTPException
from fastapi.responses import JSONResponse


def success(data: Any, status_code: int = 200) -> JSONResponse:
    """Return a standardized success response."""
    return JSONResponse(
        status_code=status_code,
        content={"success": True, "data": data},
    )


def error(code: str, message: str, status_code: int = 400) -> JSONResponse:
    """Return a standardized error response."""
    return JSONResponse(
        status_code=status_code,
        content={"success": False, "error": {"code": code, "message": message}},
    )


def not_found(resource: str = "Resource") -> HTTPException:
    """Raise a 404 HTTPException."""
    raise HTTPException(status_code=404, detail=f"{resource} not found")
