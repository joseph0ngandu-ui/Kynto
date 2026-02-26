from aiohttp import web
import subprocess
import json
import socket

def execute_cmd(cmd: str) -> str:
    # Use unix socket for DOCKER_HOST manually through shell since it's mounted natively
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if result.returncode != 0:
        return f"Error: {result.stderr.strip()}"
    return result.stdout.strip()

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

app = web.Application()
app.add_routes([
    web.get('/containers/list', list_containers),
    web.get('/containers/{name}/logs', get_logs),
    web.post('/containers/execute', execute_action)
])

if __name__ == '__main__':
    web.run_app(app, port=8000)
