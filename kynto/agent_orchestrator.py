import os
import requests

MCP_SERVER_URL = os.getenv("MCP_SERVER_URL", "http://docker_mcp_bridge:8000")
AGENT_YOLO_MODE = False  # Constitutional Security Rule

class SystemTasksContext:
    def __init__(self):
        self.session_logs_reviewed = set()

    def list_containers(self) -> dict:
        try:
            r = requests.get(f"{MCP_SERVER_URL}/containers/list", timeout=10)
            return r.json()
        except:
            return {"status": "error", "message": "Failed to connect to Docker MCP Bridge"}

    def get_container_logs(self, container_name: str, tail: int = 50) -> str:
        self.session_logs_reviewed.add(container_name)
        try:
            r = requests.get(f"{MCP_SERVER_URL}/containers/{container_name}/logs?tail={tail}", timeout=20)
            return r.text
        except:
            return "Failed to fetch logs."

    def execute_system_action(self, action: str, container_name: str, user_approved: bool = False) -> str:
        destructive_actions = ["restart", "stop", "rm", "rebuild"]

        if action in destructive_actions:
            if action in ["restart", "rebuild"] and container_name not in self.session_logs_reviewed:
                return "ERROR: Constitutional Rule Violation. You must call `get_container_logs` first."

            if not AGENT_YOLO_MODE and not user_approved:
                return (
                    f"<request_permission>\n"
                    f"I have analyzed the logs for '{container_name}'. I believe we need to {action} it to fix the issue.\n"
                    f"I am about to {action} '{container_name}'. Is that okay? [Yes/No]\n"
                    f"</request_permission>"
                )

        payload = {"action": action, "container": container_name}
        try:
            response = requests.post(f"{MCP_SERVER_URL}/containers/execute", json=payload, timeout=30)
            response.raise_for_status()
            return f"SUCCESS: Action '{action}' on '{container_name}' completed."
        except requests.exceptions.HTTPError as e:
            return f"SYSTEM FAILURE: Container '{container_name}' returned error."
