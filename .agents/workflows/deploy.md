---
description: How to deploy a premium project autonomously on Kynto
---

# Kynto Autonomous Deployment Workflow

// turbo-all
1. **Fetch Host Context**
   Call `curl http://docker_mcp_bridge:8000/system/info` to get host IPs (`100.65.188.111`, etc.).

2. **Validate Project Structure & Caching**
   - Ensure a `docker-compose.yml` exists.
   - If missing, generate one based on the project type (Node/Python/Static).
   - **MANDATORY**: Use BuildKit cache mounts in Dockerfiles:
     - `RUN --mount=type=cache,target=/root/.cache/pip ...`
     - `RUN --mount=type=cache,target=/root/.npm ...`
     - `RUN --mount=type=cache,target=/var/cache/apt ...`
   - Use high-fidelity images (Node 20+, Alpine-based).

3. **Deploy via Bridge**
   - Trigger deployment using the bridge `/deploy` endpoint.
   - Project path must be relative to the `agent_workspace`.

4. **Health Pulse**
   - Check container logs immediately: `docker logs <container_name>`.
   - Verify port is listening: `curl http://docker_mcp_bridge:8000/system/check_port?port=<port>`.

5. **Expose Port (New)**
   - Call `curl -X POST -H "Content-Type: application/json" -d '{"port": "<port>", "protocol": "tcp"}' http://docker_mcp_bridge:8000/network/expose` to open the firewall.

6. **Final Handover**
   - Provide the user with the direct Tailscale IP link and local network link.
   - `http://100.65.188.111:<port>`
