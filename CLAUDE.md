# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is Kynto

Kynto is a self-hosted AI infrastructure management system. It lets a single authenticated user manage a home server's Docker containers via a Slack bot and a web dashboard. The AI agent can read logs, restart containers, execute bash commands in a sandbox, and deploy new projects — all with a human-in-the-loop approval gate for destructive actions.

## Services

The system is composed of four services that run in Docker on an isolated `kynto_internal` bridge network:

| Service | Language | Port | Role |
|---|---|---|---|
| `gateway_service` | Python (aiohttp + slack_bolt) | — | Slack bot interface |
| `kynto_core` | Python (aiohttp) | 5000 | AI agent brain (ReAct loop + Whisper) |
| `docker_mcp_bridge` | Python (aiohttp) | 8000 | Docker API proxy (only service with docker.sock) |
| `premium-dashboard/backend` | Node.js (Express) | 3001 | Web dashboard API |
| `premium-dashboard/frontend` | React + Vite | 5173 (dev) | Web dashboard UI |

### Service responsibilities

**`gateway_service/main.py`** — Slack Socket Mode bot. Authenticates all events against a single `ALLOWED_USER_ID`. Routes text and voice notes (transcribed via local Whisper) to `kynto_core`. Intercepts `<request_permission>` tags in responses and presents Slack interactive buttons for destructive action approval.

**`kynto_core/cli_wrapper.py`** — HTTP server at `/execute`. Runs a ReAct loop (up to 5 iterations) using a model chain with automatic fallback: Groq (openai/gpt-oss-120b) → Azure/GitHub Models GPT-4o → GPT-4o-mini. The only tool exposed to the AI is `execute_bash_command`, which runs in `/home/kynto_agent/workspace`. Also handles Whisper audio transcription.

**`docker_mcp_bridge/main.py`** — The sole service with access to `docker.sock`. Exposes a minimal REST API for listing containers, fetching logs, executing allowed actions (`start`, `stop`, `restart`, `rm`), deploying projects via `docker compose`, checking ports, and opening UFW firewall rules. `kynto_core` has zero Docker socket access and must go through this bridge.

**`premium-dashboard/backend/server.js`** — Express API with JWT auth (email OTP setup flow via nodemailer). Proxies AI chat to `kynto_core` using a "race pattern": if `kynto_core` responds within 10 seconds the response is synchronous; otherwise a `taskId` is returned for the frontend to poll at `/api/chat/status/:taskId` every 3 seconds. Persists conversations in `chatDb.js`. Exposes system stats (CPU, memory, disk) and Docker container stats/control via `dockerode`.

**`premium-dashboard/frontend/`** — React SPA with four views: Dashboard (system stats + container cards), Chat (full-page conversation manager with voice recording), Logs (audit trail), Settings. Auth token stored in `localStorage`. `VITE_API_URL` env var configures the backend URL.

## Security model

- **Zero-trust**: `kynto_core` has NO `docker.sock` mount. All Docker operations route through `docker_mcp_bridge`.
- **Constitutional rules** (`kynto/agent_orchestrator.py`): Before restarting a container, the agent must have called `get_container_logs` first. Destructive actions require explicit `user_approved=True` (from the Slack button callback) unless `AGENT_YOLO_MODE=True`.
- **Single-user**: All Slack events and dashboard actions check against a single registered identity.

## Commands

### Run the core stack
```bash
# From repo root — starts gateway_service, kynto_core, docker_mcp_bridge
docker compose up -d --build

# View logs for a specific service
docker compose logs -f kynto_core
```

### Run the premium dashboard
```bash
docker compose -f premium-dashboard/docker-compose.yml up -d --build
```

### Frontend development
```bash
cd premium-dashboard/frontend
npm install
npm run dev        # Vite dev server on port 5173
npm run build      # Production build to dist/
```

### Initial server setup (rootless Docker)
```bash
bash setup.sh
```

## Environment variables

All secrets are injected via `.env` at repo root (excluded from git).

**gateway_service**: `SLACK_APP_TOKEN`, `SLACK_BOT_TOKEN`, `ALLOWED_USER_ID`

**kynto_core**: `GITHUB_TOKEN` (Azure/GitHub Models), `GROQ_API_KEY`, `MCP_SERVER_URL`

**docker_mcp_bridge**: `ALLOWED_ACTIONS`, `ENFORCE_APPEND_ONLY_LOGS`, `SUDO_PASSWORD` (for UFW rules)

**dashboard backend**: `DASHBOARD_PASSWORD`, `JWT_SECRET`, `OTP_SECRET`, `KYNTO_CORE_URL`

**dashboard frontend**: `VITE_API_URL` (set in `.env.vercel` for Vercel deployments)

## Agent workspace and deployment workflow

The agent's coding sandbox is `agent_workspace/` (mounted at `/home/kynto_agent/workspace` in `kynto_core`). When deploying a new project, the agent follows `.agents/workflows/deploy.md`:

1. Fetch host IPs from `docker_mcp_bridge:8000/system/info`
2. Ensure a `docker-compose.yml` exists; generate one if missing (use BuildKit cache mounts)
3. Trigger deploy via `docker_mcp_bridge:8000/deploy` (path relative to `agent_workspace/`)
4. Check container logs and port availability
5. Open firewall via `docker_mcp_bridge:8000/network/expose`
6. Return Tailscale IP link to the user

## Key architectural patterns

- **Chat race pattern**: Backend starts the AI task, races it against a 10-second timer. Fast responses return directly; slow ones return a `taskId` for polling.
- **Model fallback chain**: `kynto_core` tries Groq first, then Azure GPT-4o, then GPT-4o-mini — automatically advancing `model_index` on any exception.
- **`<thinking>` tags**: The AI wraps reasoning in `<thinking>...</thinking>` which is stripped before display in both the Slack bot and dashboard.
- **`<request_permission>` tags**: Signal to `gateway_service` that a human approval Slack block should be presented before proceeding.
- **Audit log**: In-memory ring buffer (last 50 events) in the dashboard backend; persistent append-only log at `logs/audit_trail.log` via the bridge.
