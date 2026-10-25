# IssueBridge

> **Turn unclear open-source issues into well-defined tasks, and turn those tasks into actionable contribution plans.**

<img width="2265" height="1941" alt="image" src="https://github.com/user-attachments/assets/4bdbed83-be36-4975-9a26-1b7cdc86ed02" />


IssueBridge is a developer tool that bridges the gap between open-source issue quality and contributor onboarding. It uses locally running **Gemma 4** through **Ollama** for AI inference, alongside the public **GitHub REST API** for verified repository evidence.

No Google Gemini API key or hosted inference service is required.

---

## 1. The Problems IssueBridge Solves

### Problem A — Poorly Defined Issues
Bug reports submitted to open-source projects often omit reproduction steps, expected behavior, environment details, and acceptance criteria. Maintainers spend valuable time asking basic follow-up questions, while newcomers struggle to determine what actually needs fixing.

### Problem B — Difficult Contributor Onboarding
A contributor may find an interesting GitHub issue but feel overwhelmed by repository structure, unfamiliarity with relevant source files, undocumented setup quirks, or lack of guidance on what tests to run.

### The Solution — Two Connected Workflows

```
                           +---------------------------+
                           | Rough Bug Report / Idea   |
                           +---------------------------+
                                         |
                                         v
               +---------------------------------------------------+
               |                   IssueSmith                      |
               |  - Retrieves public repo context via GitHub API   |
               |  - Analyzes report with local Gemma 4             |
               |  - Identifies missing information questions       |
               |  - Suggests acceptance criteria & labels          |
               |  - Calculates deterministic readiness checklist   |
               |  - Produces editable, structured issue draft      |
               +---------------------------------------------------+
                                         |
                                         | [Generate Contributor Plan]
                                         | (transfers edited draft directly)
                                         v
   +-----------------------+   +-----------------------------------+
   | Existing GitHub Issue |-->|             FirstPR               |
   | URL (public issue)    |   |  - Gathers verified repo files    |
   +-----------------------+   |  - Grounds Gemma 4 via EvidenceIDs|
                               |  - Returns verified source links  |
                               |  - Generates 3-7 action steps     |
                               |  - Suggests targeted test cases   |
                               |  - Interactive PR checklist       |
                               +-----------------------------------+
```

1. **IssueSmith (Maintainer Workflow):** Transforms rough bug reports into structured, contributor-friendly issues with missing-information clarification and deterministic readiness checks.
2. **FirstPR (Contributor Workflow):** Helps contributors understand the issue, inspect verified repository files, and receive a step-by-step implementation and test checklist. Users can enter from an IssueSmith draft or directly from an existing public GitHub issue URL.

---

## 2. Architecture & Tech Stack

```
+---------------------------------------------------------------+
|                      React Frontend                           |
|       (TypeScript, Vite, Tailwind CSS, Lucide Icons)          |
+---------------------------------------------------------------+
                               |
                               | HTTP JSON / REST
                               v
+---------------------------------------------------------------+
|                      FastAPI Backend                          |
|             (Python 3.12, Pydantic, HTTPX)                    |
+---------------------------------------------------------------+
              |                                   |
              | Local HTTP                        | Public HTTPS
              v                                   v
+-----------------------------+     +---------------------------+
|    Ollama Local Runtime     |     |      GitHub REST API      |
| Model: gemma4:e4b (or e2b)  |     |  Fixed host:              |
| http://127.0.0.1:11434      |     |  https://api.github.com   |
+-----------------------------+     +---------------------------+
```

### Technology Highlights
- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS, Lucide React icons, Vitest, Happy-DOM, React Testing Library.
- **Backend:** Python 3.12, FastAPI, Pydantic v2, HTTPX, Pytest, Pytest-Asyncio.
- **Local AI:** Ollama running `gemma4:e4b` (or fallback `gemma4:e2b`).
- **Evidence Verification:** Internal Evidence IDs (`README`, `CONTRIBUTING`, `F1`, `F2`, ...) validated by the backend so that all file paths and URLs shown to the user point to real repository source files.

---

## 3. Prerequisites

- **Python 3.12+**
- **Node.js 20+** and **npm**
- **Ollama** installed on your system ([ollama.com/download](https://ollama.com/download))

---

## 4. Local Setup & Installation

### Step 1: Install and Launch Ollama

1. Download and install Ollama from [https://ollama.com/download](https://ollama.com/download).
2. Start the Ollama background service:
   ```bash
   ollama serve
   ```
   *(On Windows or macOS, opening the Ollama application from the Start Menu / Applications folder starts the service automatically).*

### Step 2: Download Gemma 4

Open a terminal and pull the default model:
```bash
ollama pull gemma4:e4b
```

> **Memory / Speed Note:**
> If `gemma4:e4b` is too slow or consumes too much RAM for your machine, pull the lightweight 2B parameter version:
> ```bash
> ollama pull gemma4:e2b
> ```
> Then set `OLLAMA_MODEL=gemma4:e2b` in `backend/.env`.

Verify installed models:
```bash
ollama list
```

### Step 3: Configure the Backend

1. Navigate to the `backend` folder:
   ```bash
   cd backend
   ```
2. Copy the example environment file:
   ```bash
   copy .env.example .env
   ```
3. Inspect `backend/.env`. Key configurable values:
   ```ini
   LLM_PROVIDER=ollama
   OLLAMA_BASE_URL=http://127.0.0.1:11434
   OLLAMA_MODEL=gemma4:e4b
   OLLAMA_TIMEOUT_SECONDS=180
   OLLAMA_NUM_CTX=8192
   OLLAMA_KEEP_ALIVE=5m

   # Optional GitHub token to increase API rate limit (public repo read only)
   GITHUB_TOKEN=
   FRONTEND_ORIGIN=http://localhost:5173
   BACKEND_PORT=8000
   REQUEST_TIMEOUT_SECONDS=15

   MAX_REPOSITORY_FILES=8
   MAX_FILE_CHARS=6000
   MAX_TOTAL_CONTEXT_CHARS=16000
   ```

### Step 4: Start the Backend

Create and activate a virtual environment, install dependencies, and launch FastAPI:

**Windows (PowerShell):**
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**Linux / macOS:**
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

The backend will start at `http://127.0.0.1:8000`. You can test health endpoints:
- `http://127.0.0.1:8000/api/health`
- `http://127.0.0.1:8000/api/health/llm`

### Step 5: Start the Frontend

In a separate terminal:
```bash
cd frontend
npm install
npm run dev
```

Open your browser at `http://localhost:5173`.

---

## 5. Manual Smoke Test (Local Ollama Verification)

To test your local Ollama connection, verify that Gemma 4 is properly pulled, and run a test structured inference without starting the full web app:

```bash
cd backend
.\.venv\Scripts\activate
python scripts/smoke_test_ollama.py
```

Expected output:
```text
============================================================
IssueBridge — Local Ollama & Gemma 4 Smoke Test
============================================================
Ollama Base URL : http://127.0.0.1:11434
Target Model    : gemma4:e4b
Context Window  : 8192
------------------------------------------------------------

[1/3] Checking Ollama service availability and model tags...
Status          : ready
Details         : Ollama is running with gemma4:e4b available.

[2/3] Testing live chat inference with structured JSON output...

[3/3] Inference succeeded! Received validated structured response:
  Title           : Fix CSV export failure when date filters applied
  Category        : bug
  Summary         : ...

Smoke test PASSED! Local Gemma 4 inference is fully operational.
```

---

## 6. Running Automated Tests

All automated unit and integration tests use mocked network responses so they run fast, offline, and without consuming local LLM resources.

### Backend Tests (Pytest)
```bash
cd backend
.\.venv\Scripts\activate
pytest -v
```
*(Tests URL validation, lookalike host rejection, PR URL rejection, evidence ID grounding, Ollama client retries, error response envelope, and deterministic readiness logic).*

### Frontend Tests (Vitest & Testing Library)
```bash
cd frontend
npm test
```
*(Tests header status indicators, Ollama offline alerts, IssueSmith form validation & state transfer, and FirstPR verified link rendering).*

### Frontend Production Build
```bash
cd frontend
npm run build
```

---

## 7. Security & Reliability Guardrails

- **Strict URL Validation:** Validates that repository URLs belong strictly to `github.com`. Rejects lookalike domains (`github.com.evil.com`, `githhub.com`, etc.) and non-GitHub hosts.
- **Fixed API Host:** Requests always go strictly to `https://api.github.com`. Arbitrary user-controlled API hosts are rejected to prevent SSRF.
- **PR URL Guard:** Explicitly rejects pull-request URLs when an issue URL is required.
- **Evidence ID Grounding:** Gemma 4 is instructed to reference internal evidence IDs (`README`, `CONTRIBUTING`, `F1`, `F2`, ...). The backend validates every ID before returning data and constructs source links only from verified GitHub API metadata.
- **Bounded Resource Budgets:** File size, aggregate context chars, and context windows are strictly bounded to prevent memory exhaustion on resource-constrained computers.
- **Honest Feedback:** Never claims generated code has been executed, never claims an issue has been published, and never masks local AI errors with fake success responses.

---

## 8. Out of Scope

The current version focuses strictly on local AI issue enhancement and contributor guidance. The following are intentionally out of scope:
- User accounts / logins
- GitHub OAuth or private repository access
- Automatic creation of Git branches, commits, or pull requests
- Arbitrary code execution inside user repositories
- Cloud LLM integrations (Google Gemini API, OpenAI, etc.)

---

## 9. License

MIT License. See [LICENSE](LICENSE) for details.
