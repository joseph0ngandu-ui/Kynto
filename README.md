# Kynto

Kynto is a self-hosted AI infrastructure management system. It lets a single authenticated user manage a home server's Docker containers via a Slack bot and a web dashboard. The AI agent can read logs, restart containers, execute bash commands in a sandbox, and deploy new projects — all with a human-in-the-loop approval gate for destructive actions.

## Key Features

- **Slack Bot Interface** — Chat with your server in natural language via Slack, including voice note support (transcribed by local Whisper).
- **AI ReAct Agent** — A reasoning loop (up to 5 iterations) powered by a model fallback chain: Groq → Azure/GitHub Models GPT-4o → GPT-4o-mini.
- **Zero-Trust Docker Proxy** — `kynto_core` has no direct access to `docker.sock`; all Docker operations are mediated by `docker_mcp_bridge`.
- **Human-in-the-Loop Approvals** — Destructive actions (stop, rm) require explicit Slack button confirmation before execution.
- **Web Dashboard** — React + Node.js dashboard with system stats, container management, conversation history, and an audit log.
- **Sandbox Deployments** — The AI agent can scaffold and deploy new Dockerised projects into a dedicated workspace directory.

## Architecture Overview

```
Slack ──► gateway_service ──► kynto_core ──► docker_mcp_bridge ──► docker.sock
                                   │
                         premium-dashboard/backend
                                   │
                         premium-dashboard/frontend (React)
```

All four services run on an isolated `kynto_stack_net` bridge network inside Docker.

| Service | Language | Port | Role |
|---|---|---|---|
| `gateway_service` | Python (aiohttp + slack_bolt) | — | Slack bot interface |
| `kynto_core` | Python (aiohttp) | 5000 | AI agent brain (ReAct loop + Whisper) |
| `docker_mcp_bridge` | Python (aiohttp) | 8000 | Docker API proxy (only service with `docker.sock`) |
| `premium-dashboard/backend` | Node.js (Express) | 3001 | Web dashboard API |
| `premium-dashboard/frontend` | React + Vite | 5173 (dev) | Web dashboard UI |

## Prerequisites

- Docker Engine ≥ 24 with `docker compose` plugin
- A Slack workspace with a Slack App configured in Socket Mode (see `slack_manifest.yaml`)
- API keys: Groq (`GROQ_API_KEY`) and/or a GitHub/Azure token (`GITHUB_TOKEN`) for the model fallback chain
- (Optional) Node.js ≥ 18 for local frontend development

## Installation & Setup

### 1. Clone the repository

```bash
git clone https://github.com/joseph0ngandu-ui/Kynto.git
cd Kynto
```

### 2. Initial server setup (rootless Docker)

```bash
bash setup.sh
```

### 3. Configure environment variables

Copy the example and fill in your secrets:

```bash
cp .env.example .env
```

| Variable | Service | Description |
|---|---|---|
| `SLACK_APP_TOKEN` | gateway_service | Slack Socket Mode app token (`xapp-…`) |
| `SLACK_BOT_TOKEN` | gateway_service | Slack bot OAuth token (`xoxb-…`) |
| `ALLOWED_USER_ID` | gateway_service | Slack user ID of the single authorised user |
| `GITHUB_TOKEN` | kynto_core | GitHub/Azure Models token for GPT-4o fallback |
| `GROQ_API_KEY` | kynto_core | Groq API key (primary model) |
| `MCP_SERVER_URL` | kynto_core | Set automatically in `docker-compose.yml` |
| `ALLOWED_ACTIONS` | docker_mcp_bridge | Comma-separated list of permitted Docker actions |
| `ENFORCE_APPEND_ONLY_LOGS` | docker_mcp_bridge | `true` to make the audit log append-only |
| `SUDO_PASSWORD` | docker_mcp_bridge | Password for UFW firewall commands |
| `DASHBOARD_PASSWORD` | dashboard backend | Initial dashboard password |
| `JWT_SECRET` | dashboard backend | Secret for signing JWT tokens |
| `OTP_SECRET` | dashboard backend | Secret for OTP generation |
| `KYNTO_CORE_URL` | dashboard backend | URL of `kynto_core` (default: `http://kynto_core:5000`) |
| `VITE_API_URL` | dashboard frontend | Backend URL for the React app |

### 4. Create the audit log file

```bash
mkdir -p logs && touch logs/audit_trail.log
```

### 5. Start the core stack

```bash
docker compose up -d --build
```

### 6. Start the premium dashboard (optional)

```bash
docker compose -f premium-dashboard/docker-compose.yml up -d --build
```

## Usage

### Slack Bot

Once the stack is running and your Slack App is installed in your workspace, message the bot directly:

- `"List all running containers"` — shows container status
- `"Show me the logs for kynto_core"` — streams recent logs
- `"Restart the nginx container"` — triggers an approval prompt before acting
- Voice notes are automatically transcribed and processed

Destructive actions present interactive Slack buttons for confirmation before execution.

### Web Dashboard

Open `http://<your-server>:3001` (or your configured `VITE_API_URL`) in a browser.

- **Dashboard** — live CPU, memory, disk usage and container cards
- **Chat** — full conversation interface with voice recording
- **Logs** — audit trail of all agent actions
- **Settings** — configure dashboard preferences

### Frontend Development

```bash
cd premium-dashboard/frontend
npm install
npm run dev      # Vite dev server on port 5173
npm run build    # Production build to dist/
```

## Project Structure

```
Kynto/
├── gateway_service/        # Slack bot (Python)
│   ├── main.py
│   ├── Dockerfile
│   └── requirements.txt
├── kynto_core/             # AI agent brain (Python)
│   ├── cli_wrapper.py
│   └── Dockerfile
├── docker_mcp_bridge/      # Docker API proxy (Python)
│   ├── main.py
│   └── Dockerfile
├── kynto/
│   └── agent_orchestrator.py  # Constitutional rules for the agent
├── premium-dashboard/
│   ├── backend/            # Express API (Node.js)
│   ├── frontend/           # React + Vite SPA
│   └── docker-compose.yml
├── agent_workspace/        # AI coding sandbox (mounted into kynto_core)
├── logs/
│   └── audit_trail.log     # Persistent append-only audit log
├── docker-compose.yml      # Core stack compose file
├── setup.sh                # Initial server setup script
└── slack_manifest.yaml     # Slack App manifest
```

## Security

- `kynto_core` has **no** `docker.sock` mount. All Docker operations route through `docker_mcp_bridge`.
- Destructive actions require explicit `user_approved=True` (from the Slack button callback) unless `AGENT_YOLO_MODE=True`.
- All Slack events and dashboard actions are checked against a single registered user identity.
- The audit log is optionally enforced as append-only via `ENFORCE_APPEND_ONLY_LOGS`.

## Troubleshooting

**Bot doesn't respond in Slack**
- Verify `SLACK_APP_TOKEN` and `SLACK_BOT_TOKEN` are set correctly.
- Check `ALLOWED_USER_ID` matches your Slack user ID.
- Run `docker compose logs -f gateway_service` for errors.

**`docker_mcp_bridge` health check fails**
- Ensure `docker.sock` is accessible at `/run/user/1000/docker.sock`.
- Run `docker compose logs -f docker_mcp_bridge` for errors.

**Dashboard not loading**
- Ensure the backend is running: `docker compose -f premium-dashboard/docker-compose.yml ps`.
- Check `VITE_API_URL` points to the correct backend address.

**AI agent not responding**
- Verify `GROQ_API_KEY` and/or `GITHUB_TOKEN` are valid.
- Run `docker compose logs -f kynto_core` to inspect model errors.

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on how to report issues, suggest features, and submit pull requests.

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
