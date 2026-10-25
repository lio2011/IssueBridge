import logging
import uuid
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

from app.core.config import get_settings
from app.api.endpoints import router as api_router
from app.services.ai_service import AIServiceError
from app.services.github_service import GitHubServiceError
from app.models.schemas import ErrorResponse, APIError

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("issuebridge")

settings = get_settings()

app = FastAPI(
    title="IssueBridge API",
    description="Bridge the gap between unclear bug reports and actionable open-source contributions using local Gemma 4.",
    version="1.0.0",
)

# CORS setup
origins = [
    settings.frontend_origin,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Exception handlers with consistent error envelope
@app.exception_handler(AIServiceError)
async def ai_service_exception_handler(request: Request, exc: AIServiceError):
    req_id = str(uuid.uuid4())[:8]
    logger.warning(f"AI Service Error [{req_id}] ({exc.code}): {exc.message}")
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": exc.code, "message": exc.message, "request_id": req_id}},
    )

@app.exception_handler(GitHubServiceError)
async def github_service_exception_handler(request: Request, exc: GitHubServiceError):
    req_id = str(uuid.uuid4())[:8]
    logger.warning(f"GitHub Service Error [{req_id}] ({exc.code}): {exc.message}")
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": exc.code, "message": exc.message, "request_id": req_id}},
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    req_id = str(uuid.uuid4())[:8]
    error_details = []
    for err in exc.errors():
        field_loc = " -> ".join(str(l) for l in err.get("loc", []))
        msg = err.get("msg", "")
        error_details.append(f"{field_loc}: {msg}")
    combined_msg = "Validation failed: " + "; ".join(error_details)
    logger.info(f"Input Validation Error [{req_id}]: {combined_msg}")
    return JSONResponse(
        status_code=400,
        content={"error": {"code": "INVALID_INPUT", "message": combined_msg, "request_id": req_id}},
    )

@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    req_id = str(uuid.uuid4())[:8]
    logger.error(f"Unhandled Server Error [{req_id}]: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected error occurred while processing the request.",
                "request_id": req_id,
            }
        },
    )

# Include routes
app.include_router(api_router)
