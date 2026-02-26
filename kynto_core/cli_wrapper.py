import os
import json
import subprocess
from aiohttp import web
from openai import OpenAI, RateLimitError
import requests

# Load the API key injected by the user
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")
MCP_SERVER_URL = os.getenv("MCP_SERVER_URL", "http://docker_mcp_bridge:8000")
AGENT_YOLO_MODE = False 

# Initialize the new GitHub Models SDK Client
client = OpenAI(
    base_url="https://models.inference.ai.azure.com",
    api_key=GITHUB_TOKEN
)

MODEL_CHAIN = [
    "gpt-4o",                          # 50/day  - best overall
    "gpt-4o-mini",                     # 150/day - fast, capable
    "Mistral-large-2411",              # 50/day  - strong tool calling
    "Cohere-command-r-plus-08-2024",   # 50/day  - good function calling
    "Meta-Llama-3.1-405B-Instruct",    # 50/day  - largest open-source
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


# --- STEP 2: Configure the Tools Map ---

function_map = {
    "list_containers": list_containers,
    "get_container_logs": get_container_logs,
    "execute_system_action": execute_system_action,
    "execute_bash_command": execute_bash_command,
    "read_file": read_file,
    "write_file": write_file,
    "list_directory": list_directory
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
            "name": "list_directory",
            "description": "Lists the files and folders in a specified directory within the workspace.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Relative directory path (default '.')"}
                }
            }
        }
    }
]

base_system_instruction = (
    "You are Kynto, an Elite Autonomous AI Software Engineer and advanced Personal Assistant (PA) for your user, Joseph Ngandu. You run in a secure backend Sandbox. "
    "You heavily utilize your OS tools (execute_bash_command, write_file, read_file) to write code, install standard dependencies, spin up servers, test applications, AND maintain long-term memory. "
    "Whenever Joseph tells you personal information, preferences, or goals, you MUST use your `write_file` tool to save or update them in a file named `joseph_profile.json` so you never forget. "
    "When asked to code an app, you MUST iterate autonomously: create the files, compile/test them using bash, read the generated error logs, fix the code, and repeat until the compilation works perfectly. "
    "Always plan your complex architectural loop in <thinking> tags. If any destructive remote Docker tool returns <request_permission>, halt and return exactly that string to the user. "
    "DO NOT EVER output standard safety alignment phrases claiming you have no memory. You HAVE memory via the attached profile. "
    "CRITICAL FORMATTING RULES: You are chatting on Slack, NOT a markdown renderer. "
    "NEVER use standard markdown syntax: no ** for bold, no ### headers, no --- dividers, no bullet symbols like - or *. "
    "Slack uses its own format: *bold* (single asterisks), _italic_ (underscores), `code` (backticks). Use these sparingly. "
    "Prefer plain text with normal punctuation. Write like a human texting a colleague. Keep responses concise and direct. "
    "When listing items, just use numbered lines (1. 2. 3.) or write them in a sentence. No decorative formatting."
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
            # Inject memory directly into the system prompt securely
            system_instruction += "\n\n[SYSTEM MEMORY INJECTION]\nYou are currently retrieving the following JSON profile from your persistent LTM drive:\n" + profile_context
            print("Successfully loaded joseph_profile.json into context window!")
        except Exception as e:
            print(f"Error reading profile: {e}")

    # Build initial message payload
    messages = [{"role": "system", "content": system_instruction}]
    
    # Unpack thread history from Gateway
    for h in history:
        # Claude strictly requires content to be strings
        if h.get("content"):
            messages.append({"role": h.get("role", "user"), "content": str(h.get("content"))})
            
    # Append the absolute current task text
    messages.append({"role": "user", "content": task})

    try:
        print(f"Processing Task: {task}")
        last_response_text = ""
        model_index = 0
        active_model = MODEL_CHAIN[0]
        tools_were_used = False
        verification_attempts = 0
        max_verifications = 3
        
        # Autonomous execution loop
        for loop_iter in range(25):  # Raised cap to allow verification rounds
            try:
                response = client.chat.completions.create(
                    model=active_model,
                    messages=messages,
                    tools=openai_tools,
                    temperature=0.0
                )
            except RateLimitError:
                model_index += 1
                if model_index < len(MODEL_CHAIN):
                    active_model = MODEL_CHAIN[model_index]
                    print(f"Rate limit hit, cascading to {active_model}")
                    response = client.chat.completions.create(
                        model=active_model,
                        messages=messages,
                        tools=openai_tools,
                        temperature=0.0
                    )
                else:
                    raise
            
            choice = response.choices[0]
            msg = choice.message
            messages.append(msg)

            if msg.content:
                last_response_text += msg.content + "\n"
            
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
                        "content": str(result)[:8000]
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
