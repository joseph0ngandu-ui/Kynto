from aiohttp import web
import subprocess
import json
import socket

import os
import shutil

def execute_cmd(cmd: str) -> str:
    # Use unix socket for DOCKER_HOST manually through shell since it's mounted natively
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if result.returncode != 0:
        return f"Error: {result.stderr.strip()}"
    return result.stdout.strip()

def get_host_ips():
    try:
        # Try to get IPs from common commands, fallback to socket
        output = execute_cmd("hostname -I || ip addr show | grep 'inet ' | grep -v '127.0.0.1'")
        return output.split()
    except:
        return [socket.gethostbyname(socket.gethostname())]

async def system_info(request):
    """Exposes host-level information to the agent."""
    info = {
        "host_ips": get_host_ips(),
        "os": os.uname() if hasattr(os, 'uname') else "unknown",
        "docker_version": execute_cmd("docker version --format '{{.Server.Version}}'"),
        "free_disk": shutil.disk_usage("/").free // (1024 * 1024), # MB
        "status": "healthy"
    }
    return web.json_response(info)

async def check_port(request):
    """Checks if a port is open on the host."""
    try:
        port = int(request.query.get('port', 3000))
        # Simple socket connection check inside the network
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(1)
            # We check localhost since this container is on the bridge network and potentially host-mapped
            result = s.connect_ex(('127.0.0.1', port))
            return web.json_response({"port": port, "open": result == 0})
    except Exception as e:
        return web.json_response({"error": str(e)}, status=400)

async def expose_port(request):
    """Securely exposes a port on the host firewall (requires SUDO_PASSWORD env)."""
    data = await request.json()
    port = data.get("port")
    protocol = data.get("protocol", "tcp")
    password = os.getenv("SUDO_PASSWORD")
    
    if not password:
        return web.json_response({"error": "SUDO_PASSWORD not configured on bridge"}, status=500)
        
    cmd = f"echo '{password}' | sudo -S ufw allow {port}/{protocol}"
    output = execute_cmd(cmd)
    
    # ufw output can vary, but generally "Rule added", "updated", or "Skipping" means success
    success_keywords = ["Rule added", "updated", "Skipping", "v6"]
    if any(k in output for k in success_keywords):
        return web.json_response({"status": "Success", "output": output})
    return web.json_response({"status": "Error", "output": output}, status=500)

async def list_containers(request):
    """Outputs standard list of all containers formatted cleanly."""
    # format: container_id, image, status, names
    output = execute_cmd('docker ps -a --format \'{"id": "{{.ID}}", "image": "{{.Image}}", "status": "{{.Status}}", "name": "{{.Names}}"}\'')
    containers = []
    for line in output.split("\n"):
        if line.strip():
            try:
                containers.append(json.loads(line))
            except:
                pass
    return web.json_response(containers)

async def get_logs(request):
    name = request.match_info['name']
    tail = request.query.get('tail', '50')
    output = execute_cmd(f"docker logs --tail {tail} {name}")
    return web.Response(text=output)

async def execute_action(request):
    data = await request.json()
    action = data.get("action")
    container = data.get("container")
    
    allowed_actions = ["start", "stop", "restart", "rm"]
    if action not in allowed_actions:
        return web.json_response({"error": "Unauthorized action"}, status=403)
        
    output = execute_cmd(f"docker {action} {container}")
    return web.json_response({"status": "Success", "output": output})

async def deploy_project(request):
    data = await request.json()
    project_path = data.get("path", "dashboard")
    # Absolute path inside the bridge's /workspace mount
    full_path = f"/workspace/{project_path}"
    
    # Run docker compose up
    output = execute_cmd(f"docker compose -f {full_path}/docker-compose.yml up -d --build")
    return web.json_response({"status": "Success", "output": output})

app = web.Application()
app.add_routes([
    web.get('/system/info', system_info),
    web.get('/system/check_port', check_port),
    web.post('/network/expose', expose_port),
    web.get('/containers/list', list_containers),
    web.get('/containers/{name}/logs', get_logs),
    web.post('/containers/execute', execute_action),
    web.post('/deploy', deploy_project)
])

if __name__ == '__main__':
    web.run_app(app, port=8000)
