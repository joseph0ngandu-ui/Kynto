import os
import re
import json
import subprocess
import base64
from aiohttp import web
from openai import OpenAI
from groq import Groq
import requests
import whisper
import torch

# Load the API keys injected by the user
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
MCP_SERVER_URL = os.getenv("MCP_SERVER_URL", "http://docker_mcp_bridge:8000")

# Initialize Whisper Model (Local + Cached)
WHISPER_CACHE = "/usr/share/whisper"
print(f"Loading Whisper Model from {WHISPER_CACHE}...")
model = whisper.load_model("tiny", download_root=WHISPER_CACHE)

# Initialize Clients
github_client = OpenAI(
    base_url="https://models.inference.ai.azure.com",
    api_key=GITHUB_TOKEN
)

groq_client = Groq(
    api_key=GROQ_API_KEY
)

MODEL_CHAIN = [
    ("groq", "openai/gpt-oss-120b"),
    ("azure", "gpt-4o"),
    ("azure", "gpt-4o-mini"),
]

WORKSPACE_DIR = "/home/kynto_agent/workspace"

def _docker_via_bridge(command: str):
    """
    Transparently intercept `docker ...` commands and route them through the MCP bridge.
    Returns the result string, or None if the command pattern isn't handled (falls through to bash).
    """
    cmd = command.strip()

    # docker ps / docker ps -a / docker container ls
    if re.match(r'docker\s+(ps|container\s+ls)', cmd):
        try:
            resp = requests.get(f"{MCP_SERVER_URL}/containers/list", timeout=15)
            containers = resp.json()
            if not containers:
                return "No containers found."
            lines = [f"{'CONTAINER ID':<15} {'NAME':<50} {'STATUS':<35} IMAGE"]
            for c in containers:
                lines.append(f"{c['id'][:12]:<15} {c['name']:<50} {c['status']:<35} {c['image']}")
            return '\n'.join(lines)
        except Exception as e:
            return f"Bridge error (containers/list): {e}"

    # docker logs [--tail N] <name>
    m = re.match(r'docker\s+logs\s+(?:--tail[=\s]+(\d+)\s+)?(\S+)', cmd)
    if m:
        tail = m.group(1) or '100'
        name = m.group(2)
        try:
            resp = requests.get(f"{MCP_SERVER_URL}/containers/{name}/logs?tail={tail}", timeout=15)
            return resp.text or "(no log output)"
        except Exception as e:
            return f"Bridge error (logs): {e}"

    # docker restart|stop|start|rm <name>
    m = re.match(r'docker\s+(restart|stop|start|rm)\s+(\S+)', cmd)
    if m:
        action, name = m.group(1), m.group(2)
        try:
            resp = requests.post(
                f"{MCP_SERVER_URL}/containers/execute",
                json={"action": action, "container": name},
                timeout=15
            )
            data = resp.json()
            return data.get('output') or data.get('status') or str(data)
        except Exception as e:
            return f"Bridge error (execute): {e}"

    # docker inspect / docker stats — surface info from container list
    m = re.match(r'docker\s+(inspect|stats)\s+(\S+)', cmd)
    if m:
        name = m.group(2)
        try:
            resp = requests.get(f"{MCP_SERVER_URL}/containers/list", timeout=15)
            containers = resp.json()
            match = next((c for c in containers if c['name'] == name or c['id'].startswith(name)), None)
            return json.dumps(match, indent=2) if match else f"Container '{name}' not found."
        except Exception as e:
            return f"Bridge error: {e}"

    return None  # unhandled pattern — let bash try


def execute_bash_command(command: str) -> str:
    # Transparently route docker commands through the MCP bridge
    if re.match(r'\s*docker\s', command):
        result = _docker_via_bridge(command)
        if result is not None:
            return result
        # Unrecognised docker subcommand — tell the model to use the bridge directly
        return (
            "[docker binary not available in this container]\n"
            "Use curl against the MCP bridge instead:\n"
            "  curl -s http://docker_mcp_bridge:8000/containers/list\n"
            "  curl -s http://docker_mcp_bridge:8000/containers/<name>/logs?tail=100\n"
            "  curl -s -X POST http://docker_mcp_bridge:8000/containers/execute "
            "-H 'Content-Type: application/json' -d '{\"action\":\"restart\",\"container\":\"<name>\"}'"
        )

    try:
        result = subprocess.run(command, shell=True, cwd=WORKSPACE_DIR, capture_output=True, text=True, timeout=300)
        output = result.stdout
        if result.stderr:
            output += f"\n[STDERR]:\n{result.stderr}"
        return output if output else "Command executed successfully."
    except Exception as e:
        return f"Error: {e}"

function_map = {
    "execute_bash_command": execute_bash_command
}

openai_tools = [
    {
        "type": "function",
        "function": {
            "name": "execute_bash_command",
            "description": "Execute a bash command in the workspace.",
            "parameters": {
                "type": "object",
                "properties": {
                    "command": {"type": "string"}
                },
                "required": ["command"]
            }
        }
    }
]

async def execute_task(request):
    try:
        data = await request.json()
        task = data.get('task', '')
        history = data.get('history', [])
        sys_msg = data.get('system', "You are Kynto, an expert engineer.")
        audio_file = data.get('audio_file') # Base64 string

        # 1. Specialized Transcription Path
        if audio_file and "transcribe" in task.lower():
            print("Direct Transcription Request Detected.")
            tmp_audio = f"/tmp/voice_{os.getpid()}.webm"
            try:
                with open(tmp_audio, "wb") as f:
                    f.write(base64.b64decode(audio_file))
                
                # Transcribe using Whisper
                result = model.transcribe(tmp_audio)
                text = result['text'].strip()
                os.remove(tmp_audio)
                
                print(f"Transcription Success: {text[:50]}...")
                return web.json_response({
                    "status": "success",
                    "transcription": text,
                    "files_changed": [text] # Backwards compatibility
                })
            except Exception as e:
                print(f"Transcription Error: {e}")
                return web.json_response({"status": "error", "error_log": str(e)})

        # 2. Standard Autonomous Task Path
        # If no system message was provided by the caller, use the canonical ReAct prompt.
        # Callers that send "You are Kynto. Plan safely inside <thinking> tags." are overridden
        # here so the enforcement lives in one place.
        REACT_SYSTEM_PROMPT = """You are Kynto, a senior autonomous systems engineer running on a home server. You have one tool: `execute_bash_command`. You operate under a strict Reason-Act (ReAct) framework.

## DOCKER ACCESS — IMPORTANT
You do NOT have the `docker` binary. All Docker operations MUST go through the MCP bridge:
  Base URL: http://docker_mcp_bridge:8000

  GET  /containers/list                          → list all containers (JSON array)
  GET  /containers/{name}/logs?tail=100          → fetch container logs
  POST /containers/execute                       → run an action
       body: {"action": "start|stop|restart|rm", "container": "<name>"}
  GET  /system/info                              → host IPs, docker version, free disk
  GET  /system/check_port?port=<n>               → check if a port is open
  POST /network/expose                           → open UFW firewall rule
       body: {"port": <n>, "protocol": "tcp"}
  POST /deploy                                   → docker compose up a project
       body: {"path": "<relative path in agent_workspace>"}

  Example — list containers:
    curl -s http://docker_mcp_bridge:8000/containers/list

  Example — get logs:
    curl -s http://docker_mcp_bridge:8000/containers/kynto-kynto_core-1/logs?tail=50

  Example — restart a container:
    curl -s -X POST http://docker_mcp_bridge:8000/containers/execute \
      -H 'Content-Type: application/json' \
      -d '{"action": "restart", "container": "kynto-kynto_core-1"}'

## MANDATORY OPERATING PROCEDURE

### Step 1 — REASON (inside <thinking> tags)
Before every response, write your full reasoning:
- What exactly is being asked?
- What is the current state? (you do NOT know until you check)
- What command(s) will give you ground truth?
- What could go wrong?

### Step 2 — ACT
Call `execute_bash_command` with a concrete, targeted command. Do NOT guess or assume the state of the system. READ before you WRITE. CHECK before you CLAIM.

### Step 3 — OBSERVE
Read the tool output. If it contradicts your assumption, update your reasoning and act again.

### Step 4 — CONCLUDE
Only after you have tool output as evidence, write your final response. Your conclusion MUST reference specific output from your tool calls. Never say "Done" or "Complete" without quoting or summarizing what the tool returned.

## HARD RULES
- NEVER say "Done", "Complete", "Fixed", or "Finished" without at least one preceding tool call whose output confirms the outcome.
- NEVER assume a service is running, a file exists, or a command succeeded without checking.
- If a task requires multiple steps, execute them one at a time and verify each before proceeding.
- For destructive actions (delete, stop, overwrite), you MUST ask for permission first.
  Respond with ONLY a <request_permission> block (outside of <thinking>) — no other text.
  Do NOT put <request_permission> inside <thinking>. Wait for USER_AUTHORIZED_DESTRUCTIVE_ACTION before executing.
- Always show your reasoning. A response with no `<thinking>` block is invalid.
- If you cannot complete a task (missing permissions, missing tool, etc.), explain exactly why with the specific error you observed.

## OUTPUT FORMAT
<thinking>
[Your full reasoning here. Mandatory.]
</thinking>

[Your actual response to the user, with evidence from tool calls.]

For destructive actions — your COMPLETE response must be exactly this format (nothing else):
<request_permission>
I want to [describe action] on [specific resource names]. Here is why: [reason].
</request_permission>"""

        effective_sys = REACT_SYSTEM_PROMPT if not sys_msg or sys_msg.strip() in (
            "You are Kynto. Plan safely inside <thinking> tags.",
            "You are Kynto, an expert engineer.",
            ""
        ) else sys_msg

        messages = [{"role": "system", "content": effective_sys}]
        messages.extend(history)
        messages.append({"role": "user", "content": task})

        last_response_text = ""
        model_index = 0
        
        for loop_iter in range(8): # ReAct loops: read→reason→act→verify needs headroom
            provider, active_model = MODEL_CHAIN[model_index]
            try:
                if provider == "groq":
                    response = groq_client.chat.completions.create(
                        model=active_model,
                        messages=messages,
                        tools=openai_tools,
                        temperature=0.7
                    )
                else:
                    response = github_client.chat.completions.create(
                        model=active_model,
                        messages=messages,
                        tools=openai_tools,
                        temperature=0.0
                    )
                
                msg = response.choices[0].message
                messages.append(msg)
                if msg.content:
                    last_response_text = msg.content

                if msg.tool_calls:
                    for tool_call in msg.tool_calls:
                        f_name = tool_call.function.name
                        f_args = json.loads(tool_call.function.arguments)
                        print(f"Tool: {f_name}")
                        res = function_map[f_name](**f_args)
                        messages.append({
                            "role": "tool",
                            "tool_call_id": tool_call.id,
                            "content": str(res)
                        })
                    continue
                break
            except Exception as e:
                print(f"Model Error: {e}")
                model_index += 1
                if model_index >= len(MODEL_CHAIN):
                    return web.json_response({"status": "error", "error_log": str(e)})

        return web.json_response({
            "status": "success",
            "files_changed": [last_response_text.strip()]
        })

    except Exception as e:
        print(f"Global Error: {e}")
        return web.json_response({"status": "error", "error_log": str(e)})

app = web.Application()
app.add_routes([web.post('/execute', execute_task)])

if __name__ == '__main__':
    web.run_app(app, port=5000)
