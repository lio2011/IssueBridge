"""
Manual Smoke Test for Local Ollama & Gemma 4
IssueBridge Local AI Verification

Usage:
    cd backend
    .venv\\Scripts\\activate
    python scripts/smoke_test_ollama.py
"""

import sys
import os
import json
import asyncio
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.core.config import get_settings
from app.services.ai_service import AIService, ISSUESMITH_SYSTEM_PROMPT
from app.models.schemas import IssueDraft


async def main():
    settings = get_settings()
    print("=" * 60)
    print("IssueBridge -- Local Ollama & Gemma 4 Smoke Test")
    print("=" * 60)
    print(f"Ollama Base URL : {settings.ollama_base_url}")
    print(f"Target Model    : {settings.ollama_model}")
    print(f"Context Window  : {settings.ollama_num_ctx}")
    print(f"Keep Alive      : {settings.ollama_keep_alive}")
    print("-" * 60)

    ai_service = AIService()

    # Step 1: Health check
    print("\n[1/3] Checking Ollama service availability and model tags...")
    health = await ai_service.check_health()
    print(f"Status          : {health['status']}")
    print(f"Details         : {health['details']}")
    print(f"Available Models: {health.get('available_models', [])}")

    if health["status"] == "ollama_unavailable":
        print("\n[!] Ollama is not currently reachable.")
        print("    Please start Ollama service ('ollama serve' or open the Ollama app).")
        return 1

    if health["status"] == "model_not_found":
        print(f"\n[!] Configured model '{settings.ollama_model}' is not pulled.")
        print(f"    Run: ollama pull {settings.ollama_model}")
        print("    Or set OLLAMA_MODEL=gemma4:e2b in backend/.env if memory is constrained.")
        return 1

    # Step 2: Test live inference
    print("\n[2/3] Testing live chat inference with structured JSON output...")
    test_prompt = """Target Repository: test-org/test-repo
Reported Problem: The CSV export button fails silently when date filters are applied.
Actual Behavior: Nothing happens when clicking export with active filters.
Expected Behavior: Download CSV file with filtered rows.
Steps to Reproduce:
1. Go to Reports page
2. Select date range 2026-01-01 to 2026-01-10
3. Click Export CSV
"""

    try:
        from app.services.issue_analyzer import RawIssueSmithResponse
        res = await ai_service.generate_structured(
            system_prompt=ISSUESMITH_SYSTEM_PROMPT,
            user_prompt=test_prompt,
            response_model=RawIssueSmithResponse,
        )
        print("\n[3/3] Inference succeeded! Received validated structured response:")
        print(f"  Title           : {res.title}")
        print(f"  Category        : {res.issue_type}")
        print(f"  Summary         : {res.summary}")
        print(f"  Labels          : {res.suggested_labels}")
        print(f"  Criteria Count  : {len(res.acceptance_criteria)}")
        print(f"  Missing Info Qs : {len(res.missing_information)}")
        print("\nSmoke test PASSED! Local Gemma 4 inference is fully operational.")
        return 0
    except Exception as e:
        print(f"\n[!] Inference failed with error: {str(e)}")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
