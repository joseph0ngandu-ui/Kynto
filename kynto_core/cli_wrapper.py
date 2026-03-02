import os
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

def execute_bash_command(command: str) -> str:
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
        messages = [{"role": "system", "content": sys_msg}]
        messages.extend(history)
        messages.append({"role": "user", "content": task})

        last_response_text = ""
        model_index = 0
        
        for loop_iter in range(5): # Reduced loops for faster chat engagement
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
