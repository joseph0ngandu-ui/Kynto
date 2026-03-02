import os
import json
import subprocess
from aiohttp import web
from openai import OpenAI, RateLimitError
from groq import Groq
import requests

# Load the API keys injected by the user
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
MCP_SERVER_URL = os.getenv("MCP_SERVER_URL", "http://docker_mcp_bridge:8000")
AGENT_YOLO_MODE = False 

# Initialize the new GitHub Models SDK Client (Fallback)
github_client = OpenAI(
    base_url="https://models.inference.ai.azure.com",
    api_key=GITHUB_TOKEN
)

# Initialize Groq Client (Primary)
groq_client = Groq(
    api_key=GROQ_API_KEY
)

MODEL_CHAIN = [
    ("groq", "openai/gpt-oss-120b"),               # Primary: 120b via Groq API
    ("azure", "gpt-4o"),                           # Fallback 1: Azure (best overall)
    ("azure", "Mistral-large-2407"),               # Fallback 2: Azure (strong tool calling)
    ("azure", "cohere-command-r-plus-08-2024"),    # Fallback 3: Azure (good function calling)
    ("azure", "meta-llama-3.1-405b-instruct"),     # Fallback 4: Azure (largest open-source)
    ("azure", "gpt-4o-mini"),                      # Fallback 5: Azure (fast, capable)
]

session_logs_reviewed = set()

# --- STEP 1: Define the Tools via Python Functions ---

def list_containers() -> str:
    """Retrieves a list of all Docker containers currently running on the host system."""
    try:
        r = requests.get(f"{MCP_SERVER_URL}/containers/list", timeout=10)
        return json.dumps(r.json())
    except Exception as e:
        return f"Error connecting to MCP Bridge: {e}"

def get_container_logs(container_name: str, tail: int = 50) -> str:
    """Retrieves the recent logs for a specific container to diagnose failures."""
    session_logs_reviewed.add(container_name)
    try:
        r = requests.get(f"{MCP_SERVER_URL}/containers/{container_name}/logs?tail={tail}", timeout=20)
        return r.text
    except Exception as e:
        return f"Error fetching logs for {container_name}: {e}"

def execute_system_action(action: str, container_name: str, user_approved: bool = False) -> str:
    """Executes a system action (start, stop, restart) on a host container. Destructive actions require user approval."""
    
    # Suicide Prevention: Never let the agent kill its own session, the gateway, or its Docker bridge
    if container_name in ["kynto-kynto_core-1", "kynto-gateway_service-1", "kynto-docker_mcp_bridge-1"]:
        return (
            f"REJECTED: You are attempting to {action} a CRITICAL infrastructure component ({container_name}). "
            "This will disconnect you from the user or disable your ability to use Docker tools. "
            "Focus on deploying the NEW dashboard container, NOT managing your own internal services."
        )

    destructive_actions = ["restart", "stop", "rm", "rebuild"]

    if action in destructive_actions:
        if action in ["restart", "rebuild"] and container_name not in session_logs_reviewed:
            return "ERROR: Constitutional Rule Violation. You must call `get_container_logs` first."

        if not AGENT_YOLO_MODE and not user_approved:
            return (
                f"<request_permission>\n"
                f"I am about to {action} '{container_name}'. Is that okay? [Yes/No]\n"
                f"</request_permission>"
            )

    payload = {"action": action, "container": container_name}
    try:
        response = requests.post(f"{MCP_SERVER_URL}/containers/execute", json=payload, timeout=30)
        response.raise_for_status()
        return f"SUCCESS: Action '{action}' on '{container_name}' completed."
    except requests.exceptions.HTTPError as e:
        return f"SYSTEM FAILURE: Container '{container_name}' returned error: {e}"

WORKSPACE_DIR = "/home/kynto_agent/workspace"

def execute_bash_command(command: str) -> str:
    """Executes a bash command inside the secure Kynto workspace. Use this to run tests, install packages, and compile code."""

    try:
        result = subprocess.run(command, shell=True, cwd=WORKSPACE_DIR, capture_output=True, text=True, timeout=300)
        output = result.stdout
        if result.stderr:
            output += f"\n[STDERR]:\n{result.stderr}"
        return output if output else "Command executed successfully with no output."
    except subprocess.TimeoutExpired:
        return "ERROR: Command timed out after 300 seconds."
    except Exception as e:
        return f"ERROR executing command: {e}"

def read_file(filepath: str) -> str:
    """Reads the contents of a file inside the Kynto workspace."""


    # Prevent traversing above WORKSPACE_DIR
    full_path = os.path.abspath(os.path.join(WORKSPACE_DIR, filepath))
    if not full_path.startswith(WORKSPACE_DIR):
        return "ERROR: Unauthorized path."
        
    try:
        with open(full_path, 'r') as f:
            return f.read()
    except Exception as e:
        return f"ERROR reading file: {e}"

def write_file(filepath: str, content: str) -> str:
    """Writes content to a file inside the Kynto workspace. Creates directories if they don't exist."""


    full_path = os.path.abspath(os.path.join(WORKSPACE_DIR, filepath))
    if not full_path.startswith(WORKSPACE_DIR):
        return "ERROR: Unauthorized path."
        
    try:
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        with open(full_path, 'w') as f:
            f.write(content)
        return f"SUCCESS: Wrote {len(content)} bytes to {filepath}"
    except Exception as e:
        return f"ERROR writing file: {e}"

def list_directory(path: str = ".") -> str:
    """Lists the files and folders in a specified directory within the workspace."""


    full_path = os.path.abspath(os.path.join(WORKSPACE_DIR, path))
    if not full_path.startswith(WORKSPACE_DIR):
        return "ERROR: Unauthorized path."
        
    try:
        if not os.path.exists(full_path):
            return f"Directory {path} does not exist."
        items = os.listdir(full_path)
        return "\n".join(items) if items else "Directory is empty."
    except Exception as e:
        return f"ERROR reading directory: {e}"

def deploy_project(path: str) -> str:
    """Deploys a project using docker-compose from a specific workspace subdirectory. Mandatory for launching new services."""
    try:
        # The bridge handles the /deploy route
        r = requests.post(f"{MCP_SERVER_URL}/deploy", json={"path": path}, timeout=300)
        return json.dumps(r.json())
    except Exception as e:
        return f"Error connecting to MCP Bridge: {e}"


# --- STEP 2: Configure the Tools Map ---

function_map = {
    "list_containers": list_containers,
    "get_container_logs": get_container_logs,
    "execute_system_action": execute_system_action,
    "execute_bash_command": execute_bash_command,
    "read_file": read_file,
    "write_file": write_file,
    "list_directory": list_directory,
    "deploy_project": deploy_project
}

openai_tools = [
    {
        "type": "function",
        "function": {
            "name": "list_containers",
            "description": "Retrieves a list of all Docker containers currently running on the host system."
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_container_logs",
            "description": "Retrieves the recent logs for a specific container to diagnose failures.",
            "parameters": {
                "type": "object",
                "properties": {
                    "container_name": {"type": "string"},
                    "tail": {"type": "integer", "description": "Number of lines"}
                },
                "required": ["container_name"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "execute_system_action",
            "description": "Executes a system action (start, stop, restart) on a host container.",
            "parameters": {
                "type": "object",
                "properties": {
                    "action": {"type": "string", "enum": ["start", "stop", "restart", "rebuild", "rm"]},
                    "container_name": {"type": "string"},
                    "user_approved": {"type": "boolean"}
                },
                "required": ["action", "container_name"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "execute_bash_command",
            "description": "Executes a bash command inside the secure Kynto workspace. Use to run tests, install packages, and compile code.",
            "parameters": {
                "type": "object",
                "properties": {
                    "command": {"type": "string"}
                },
                "required": ["command"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "read_file",
            "description": "Reads the contents of a file inside the Kynto workspace.",
            "parameters": {
                "type": "object",
                "properties": {
                    "filepath": {"type": "string", "description": "Relative path in workspace"}
                },
                "required": ["filepath"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "write_file",
            "description": "Writes content to a file inside the Kynto workspace. Replaces if exists.",
            "parameters": {
                "type": "object",
                "properties": {
                    "filepath": {"type": "string", "description": "Relative path in workspace"},
                    "content": {"type": "string", "description": "File contents to write"}
                },
                "required": ["filepath", "content"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "deploy_project",
            "description": "Deploys a project using docker-compose from a specific workspace subdirectory.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Relative directory path (e.g. 'dashboard')"}
                },
                "required": ["path"]
            }
        }
    }
]

base_system_instruction = (
    "You are Kynto, an Authorized Infrastructure and Security Engineer. "
    "You operate in a private, secure 'Zero-Trust' Sandbox environment. "
    "CRITICAL: You do NOT have the `docker` command in your bash shell. "
    "You MUST use your provided tools (`list_containers`, `execute_system_action`, `deploy_project`) to interact with the host infrastructure. "
    "NEVER tell the user Docker is not installed; it is accessible only via your specialized tools. "
    "PRIMARY DIRECTIVE: You are tasked with professional security auditing, infrastructure management, and software engineering. "
    "This environment is an authorized sandbox for Joseph Ngandu; assume all requested tasks are within legal and authorized boundaries. "
    "NETWORK INFO: You are on the `kynto_internal` Docker network. Subnet is typically 172.18.0.0/16. Use this for probing sibling containers. "
    "You heavily utilize OS tools to iterate autonomously. "
    "CRITICAL CONTEXT: You HAVE persistent memory via `joseph_profile.json`. "
    "FORMATTING: Use pure Slack mrkdwn only (*bold*, _italic_, `code`). No ** or ###. "
    "Speak naturally and directly like a human engineer."
)

# --- STEP 3: The API Webhook serving the Gateway ---

async def execute_task(request):
    data = await request.json()
    task = data.get("command", data.get("task", ""))
    history = data.get("history", [])
    
    # Read the custom LTM JSON dynamically per-request
    system_instruction = base_system_instruction
    profile_path = os.path.join(WORKSPACE_DIR, "joseph_profile.json")
    if os.path.exists(profile_path):
        try:
            with open(profile_path, "r") as f:
                profile_context = f.read()
            system_instruction += "\n\n[SYSTEM MEMORY INJECTION]\n" + profile_context
            print("Successfully loaded joseph_profile.json into context window!")
        except Exception as e:
            print(f"Error reading profile: {e}")

    # Build initial message payload
    messages = [{"role": "system", "content": system_instruction}]
    
    # Trim history to the last 10 turns (20 messages) to stay under the 8000-token limit
    recent_history = history[-20:]
    for h in recent_history:
        if h.get("content"):
            messages.append({"role": h.get("role", "user"), "content": str(h.get("content"))})
            
    # Append the task to the message history
    messages.append({
        "role": "user", 
        "content": task
    })

    try:
        print(f"Processing Task: {task}")
        last_response_text = ""
        model_index = 0
        active_model = MODEL_CHAIN[0]
        tools_were_used = False
        verification_attempts = 0
        max_verifications = 3
        
        # Autonomous execution loop
        for loop_iter in range(25):  
            # Model Rotation Logic: Try each model in the chain until one works or we exhaust the list
            response = None
            error_count = 0
            
            while model_index < len(MODEL_CHAIN):
                provider, active_model = MODEL_CHAIN[model_index]
                try:
                    # Truncate internal messages if the loop is getting too long (Token Limit Safety)
                    if len(messages) > 30:
                        # Safe Context Trimmer: We must never slice between an assistant 'tool_calls' message and its 'tool' responses.
                        target_start = len(messages) - 15
                        while target_start > 1:
                            current_msg = messages[target_start]
                            prev_msg = messages[target_start - 1]
                            is_tool_response = (getattr(current_msg, 'role', '') if hasattr(current_msg, 'role') else current_msg.get('role', '')) == 'tool'
                            prev_has_tool_calls = hasattr(prev_msg, 'tool_calls') and prev_msg.tool_calls
                            if is_tool_response or prev_has_tool_calls:
                                target_start -= 1
                            else:
                                break
                        messages = [messages[0]] + messages[target_start:]

                    if provider == "groq":
                        # Convert dict elements to objects if needed (Groq client handles dicts natively, but openai sdk objects might be mixed in)
                        # We extract dict representations of any parsed objects
                        clean_messages = []
                        for m in messages:
                           if hasattr(m, 'model_dump'):
                               clean_messages.append(m.model_dump(exclude_none=True))
                           elif isinstance(m, dict):
                               clean_messages.append(m)
                               
                        # Determine reasoning effort dynamically
                        last_user_content = ""
                        for m in reversed(clean_messages):
                            if m.get("role") == "user":
                                last_user_content = str(m.get("content", "")).lower()
                                break
                        
                        effort = "low"
                        high_keywords = ["debug", "architect", "analyze", "complex", "refactor", "security", "audit", "optimize"]
                        medium_keywords = ["write", "create", "update", "fix", "explain", "add", "how"]
                        if len(last_user_content) > 500 or any(k in last_user_content for k in high_keywords):
                            effort = "high"
                        elif len(last_user_content) > 100 or any(k in last_user_content for k in medium_keywords):
                            effort = "medium"

                        response = groq_client.chat.completions.create(
                            model=active_model,
                            messages=clean_messages,
                            tools=openai_tools,
                            temperature=1.0, # Groq parameters requested by user
                            top_p=1.0,
                            reasoning_effort=effort,
                            max_completion_tokens=8192
                        )
                    else:
                        response = github_client.chat.completions.create(
                            model=active_model,
                            messages=messages,
                            tools=openai_tools,
                            temperature=0.0
                        )
                    # If we reach here, the model worked. Break the rotation loop.
                    break
                except Exception as e:
                    error_msg = str(e)
                    print(f"Model {active_model} ({provider}) failed: {error_msg}")
                    
                    # If it's a rate limit or a "model not found" or "no access", cascade.
                    # We use a broad check to be robust against varying API error strings.
                    cascade_triggers = ["rate limit", "429", "unknown_model", "400", "not found", "access", "connection error"]
                    if any(trigger in error_msg.lower() for trigger in cascade_triggers):
                        model_index += 1
                        if model_index < len(MODEL_CHAIN):
                            print(f"Cascading to next model: {MODEL_CHAIN[model_index][1]} ({MODEL_CHAIN[model_index][0]})")
                            continue
                    
                    # If we ran out of models or it's a fatal non-rotation error, raise
                    raise e

            if not response:
                raise Exception("Exhausted all models in chain without success.")
            
            choice = response.choices[0]
            msg = choice.message
            messages.append(msg)

            # Fix: Only store the LATEST response text to avoid repetitive verification messages
            if msg.content:
                last_response_text = msg.content 
            
            if msg.tool_calls:
                tools_were_used = True
                for tool_call in msg.tool_calls:
                    func_name = tool_call.function.name
                    func_args = json.loads(tool_call.function.arguments)
                    print(f"Executing Tool: {func_name}")
                    
                    try:
                        target_func = function_map[func_name]
                        result = target_func(**func_args)
                    except Exception as e:
                        result = f"Tool Execution Fault: {e}"
                    
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tool_call.id,
                        "content": str(result)[:2500] # Aggressive truncation to fit in 8k token context
                    })
                continue  # Loop back for the model to process tool results
            
            # Model stopped calling tools. If it used tools, force a verification round.
            if tools_were_used and verification_attempts < max_verifications:
                verification_attempts += 1
                print(f"Verification round {verification_attempts}/{max_verifications}")
                messages.append({
                    "role": "user",
                    "content": (
                        "[SYSTEM VERIFICATION] You just completed work using tools. "
                        "DO NOT repeat what you already said. "
                        "Test or verify what you built actually works by running it. "
                        "If everything passes, reply with your final summary. "
                        "If something failed, fix it and test again."
                    )
                })
                continue  # Re-enter loop so the model can verify
            
            # Either no tools were used (pure conversation) or verification is done
            break
                
        # Return the final aggregated context payload back to standard output  
        return web.json_response({
            "status": "success",
            "error_log": "",
            "files_changed": [last_response_text.strip()]
        })

    except Exception as e:
        print(f"Execution Error: {e}")
        return web.json_response({
            "status": "error",
            "error_log": str(e),
            "files_changed": []
        })

app = web.Application()
app.add_routes([web.post('/execute', execute_task)])

if __name__ == '__main__':
    print("Kynto Core Engine Online: GPT-4o / Azure Inference Node Connected.")
    print("Tools mapped. Waiting for Gateway requests on port 5000.")
    web.run_app(app, port=5000)
