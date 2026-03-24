# Contributing to Kynto

Thank you for your interest in contributing to Kynto! This document describes how to report bugs, suggest features, set up a development environment, and submit pull requests.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Reporting Issues](#reporting-issues)
- [Suggesting Features](#suggesting-features)
- [Development Setup](#development-setup)
- [Pull Request Process](#pull-request-process)
- [Code Style Guidelines](#code-style-guidelines)
- [Testing Requirements](#testing-requirements)
- [Commit Message Conventions](#commit-message-conventions)

## Code of Conduct

By participating in this project you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md). Please read it before contributing.

## Reporting Issues

Before opening a new issue, please search the [existing issues](https://github.com/joseph0ngandu-ui/Kynto/issues) to avoid duplicates.

When filing a bug report, include:

1. **Description** — A clear and concise description of the problem.
2. **Steps to reproduce** — Numbered steps that reliably reproduce the issue.
3. **Expected behaviour** — What you expected to happen.
4. **Actual behaviour** — What actually happened.
5. **Environment** — OS, Docker version, relevant service logs (`docker compose logs -f <service>`).
6. **Screenshots / logs** — Attach relevant output where possible.

## Suggesting Features

Feature requests are welcome. Open an issue with the label `enhancement` and include:

1. **Problem statement** — What problem does this feature solve?
2. **Proposed solution** — How would you like the feature to work?
3. **Alternatives considered** — Any alternative approaches you have thought about.
4. **Additional context** — Mockups, references, or related issues.

## Development Setup

### Prerequisites

- Docker Engine ≥ 24 with the `docker compose` plugin
- Python 3.11+ (for service development without Docker)
- Node.js ≥ 18 (for dashboard frontend development)
- A Slack App configured in Socket Mode (see `slack_manifest.yaml`)

### With Docker (recommended)

```bash
# 1. Fork and clone the repository
git clone https://github.com/<your-fork>/Kynto.git
cd Kynto

# 2. Run initial server setup (rootless Docker)
bash setup.sh

# 3. Create and populate your .env file
cp .env.example .env
# Edit .env with your API keys and tokens

# 4. Create the audit log
mkdir -p logs && touch logs/audit_trail.log

# 5. Start the core stack
docker compose up -d --build

# 6. (Optional) Start the premium dashboard
docker compose -f premium-dashboard/docker-compose.yml up -d --build
```

### Frontend development (without Docker)

```bash
cd premium-dashboard/frontend
npm install
npm run dev   # Vite dev server at http://localhost:5173
```

### Viewing logs

```bash
docker compose logs -f <service_name>
# e.g.: docker compose logs -f kynto_core
```

## Pull Request Process

1. **Fork** the repository and create a feature branch from `main`:
   ```bash
   git checkout -b feature/my-feature
   ```
2. **Make your changes** following the code style guidelines below.
3. **Test your changes** (see [Testing Requirements](#testing-requirements)).
4. **Commit** with a descriptive message following the [commit conventions](#commit-message-conventions).
5. **Push** to your fork:
   ```bash
   git push origin feature/my-feature
   ```
6. **Open a Pull Request** against the `main` branch. Fill in the PR template, linking any related issues.
7. **Address review feedback** — maintainers may request changes. Update your branch and push again; the PR will update automatically.
8. Once approved and all checks pass, a maintainer will merge your PR.

## Code Style Guidelines

### Python

- Follow [PEP 8](https://peps.python.org/pep-0008/) with a line length of 120 characters.
- Use type hints where practical.
- Keep functions small and focused on a single responsibility.
- Document public functions and classes with docstrings.

### JavaScript / TypeScript

- Use [Prettier](https://prettier.io/) defaults (2-space indentation, single quotes).
- Prefer `const` over `let`; avoid `var`.
- Use async/await over raw Promise chains.
- Name React components in PascalCase and hooks with the `use` prefix.

### General

- Delete dead code rather than commenting it out.
- Avoid hardcoding secrets or credentials — use environment variables.
- Keep Docker images minimal; prefer multi-stage builds where applicable.

## Testing Requirements

Before submitting a pull request:

- Ensure the affected service(s) build successfully:
  ```bash
  docker compose build <service_name>
  ```
- Verify health checks pass for modified services:
  ```bash
  docker compose up -d && docker compose ps
  ```
- For frontend changes, confirm the build completes without errors:
  ```bash
  cd premium-dashboard/frontend && npm run build
  ```
- Manually exercise the affected code path and include evidence (logs or screenshots) in the PR description.

## Commit Message Conventions

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <short summary>

[optional body]

[optional footer(s)]
```

**Types:**

| Type | When to use |
|---|---|
| `feat` | A new feature |
| `fix` | A bug fix |
| `docs` | Documentation-only changes |
| `style` | Formatting, whitespace (no logic change) |
| `refactor` | Code restructuring (no feature or bug fix) |
| `test` | Adding or updating tests |
| `chore` | Build process, dependency updates, CI changes |

**Examples:**

```
feat(kynto_core): add model fallback to GPT-4o-mini
fix(gateway_service): handle empty Slack message payload
docs: add CONTRIBUTING.md
chore(docker): upgrade base Python image to 3.12-slim
```

Keep the summary line under 72 characters and use the imperative mood ("add" not "added").
