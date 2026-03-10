import os
import re
import tempfile
import aiohttp
import asyncio
from slack_bolt.async_app import AsyncApp
from slack_bolt.adapter.socket_mode.async_handler import AsyncSocketModeHandler
import whisper

# Load secure tokens strictly from environment (no hardcoded fallbacks)
SLACK_APP_TOKEN = os.environ["SLACK_APP_TOKEN"]
SLACK_BOT_TOKEN = os.environ["SLACK_BOT_TOKEN"]
ALLOWED_MEMBER_ID = os.environ["ALLOWED_USER_ID"]
KYNTO_CORE_URL = "http://kynto_core:5000/execute"

# Initialize Core
app = AsyncApp(token=SLACK_BOT_TOKEN)
print("[+] Loading local Whisper model (tiny) to preserve server CPU...")
whisper_model = whisper.load_model("tiny")

async def submit_to_orchestrator(session: aiohttp.ClientSession, task_text: str, authorized: bool = False, history: list = None) -> dict:
    """Invokes the Kynto Agent Orchestrator and relays the command."""
    if authorized:
        task_text += " [USER_AUTHORIZED_DESTRUCTIVE_ACTION]"
        
    payload = {
        "system": "You are Kynto. Plan safely inside <thinking> tags.",
        "task": task_text,
        "history": history or [],
        "audio_file": None
    }
    try:
        async with session.post(KYNTO_CORE_URL, json=payload, timeout=aiohttp.ClientTimeout(total=1800)) as response:
            return await response.json()
    except Exception as e:
        return {"status": "error", "error_log": str(e), "files_changed": []}

async def process_task_loop(client, channel: str, thread_ts: str, task_text: str, authorized: bool = False):
    """Executes the ReAct loop and intercepts <request_permission> requirements."""
    async with aiohttp.ClientSession() as session:
        # Fetch up to 15 recent messages in the thread to provide conversational memory
        history = []
        if thread_ts:
            try:
                history_resp = await client.conversations_replies(channel=channel, ts=thread_ts)
                msgs = history_resp.get("messages", [])
                
                # We skip the very last message assuming it's the trigger event itself to avoid duplication
                for m in msgs[:-1][-15:]:
                    role = "assistant" if "bot_id" in m else "user"
                    # We strip Kynto's internal prefix formatting from its history to preserve pure tokens
                    content = m.get("text", "")
                    content = re.sub(r'<thinking>.*?</thinking>', '', content, flags=re.DOTALL).strip()
                    history.append({"role": role, "content": content})
            except Exception as e:
                print(f"History Fetch Error: {e}")

        result = await submit_to_orchestrator(session, task_text, authorized, history)
        
        # In this architecture, the kynto_core response text is returned in 'files_changed' index 0
        response_text = result.get("files_changed", [""])[0] if result.get("files_changed") else result.get("error_log", "")
        
        # Remove any internal <thinking> tags from the agent's output before showing the user
        response_text = re.sub(r'<thinking>.*?</thinking>', '', response_text, flags=re.DOTALL).strip()
        
        # Convert standard markdown to Slack mrkdwn (GPT-4o ignores system prompt formatting rules)
        response_text = re.sub(r'\*\*(.+?)\*\*', r'*\1*', response_text)  # **bold** -> *bold*
        response_text = re.sub(r'^#{1,6}\s*', '', response_text, flags=re.MULTILINE)  # ### headers -> plain text
        response_text = re.sub(r'^---+$', '', response_text, flags=re.MULTILINE)  # --- dividers -> remove
        response_text = re.sub(r'\n{3,}', '\n\n', response_text)  # collapse excessive newlines
        
        # Intercept Human-in-the-Loop constraints from the Orchestrator
        if "<request_permission>" in response_text:
            # Extract the actual question to present to the user
            match = re.search(r"<request_permission>(.*?)</request_permission>", response_text, re.DOTALL)
            warning_text = match.group(1).strip() if match else "I require permission to execute this destructive action."
            
            blocks = [
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f":warning: *Authorization Required*\n\n{warning_text}"
                    }
                },
                {
                    "type": "actions",
                    "elements": [
                        {
                            "type": "button",
                            "text": {"type": "plain_text", "text": "Confirm & Execute"},
                            "style": "danger",
                            "value": task_text, # Store the original task in the button payload
                            "action_id": "confirm_action_yes"
                        },
                        {
                            "type": "button",
                            "text": {"type": "plain_text", "text": "Cancel"},
                            "value": "cancel",
                            "action_id": "confirm_action_no"
                        }
                    ]
                }
            ]
            
            await client.chat_postMessage(
                channel=channel,
                thread_ts=thread_ts,
                blocks=blocks,
                text="Authorization Required for Destructive Action."
            )
            return

        # If it's a standard success response, print it out
        if not response_text:
            response_text = "_(No response)_"
        await client.chat_postMessage(channel=channel, thread_ts=thread_ts, text=response_text)

@app.event("file_shared")
async def handle_voice_notes(body, logger, client):
    """Intercepts file uploads, securely downloads audio, transcribes it locally, and cleans up."""
    event = body.get("event", {})
    user_id = event.get("user_id")
    file_id = event.get("file_id")
    
    # Strictly enforce Authentication Scope
    if user_id != ALLOWED_MEMBER_ID:
        logger.warning(f"SECURITY ALERT: Dropped unauthorized file event from user {user_id}")
        return
        
    try:
        file_info_resp = await client.files_info(file=file_id)
        file_info = file_info_resp.get("file", {})
        
        if file_info.get("mimetype", "").startswith("audio/"):
            shares = file_info.get("shares", {})
            public_shares = shares.get("public", {})
            private_shares = shares.get("private", {})
            
            all_shares = {**public_shares, **private_shares}
            if not all_shares: return
                
            channel_id = list(all_shares.keys())[0]
            thread_ts = all_shares[channel_id][0].get("ts")
            
            await client.chat_postMessage(
                channel=channel_id,
                thread_ts=thread_ts,
                text=":headphones: _Listening..._"
            )
            
            download_url = file_info.get("url_private_download")
            headers = {"Authorization": f"Bearer {SLACK_BOT_TOKEN}"}
            
            # Secure execution: Temporary buffer scoped strictly to this execution block
            with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as temp_audio:
                temp_path = temp_audio.name
                async with aiohttp.ClientSession() as session:
                    async with session.get(download_url, headers=headers) as resp:
                        temp_audio.write(await resp.read())
            
            try:
                # Transcribe via Local Whisper
                transcription = whisper_model.transcribe(temp_path)
                transcribed_text = transcription["text"].strip()
                
                await client.chat_postMessage(
                    channel=channel_id,
                    thread_ts=thread_ts,
                    text=f"*:speaking_head_in_silhouette: Voice Command:* \"{transcribed_text}\"\n_Routing to AI Processor..._"
                )
                
                # Pass transcribed text into ReAct logic
                asyncio.create_task(process_task_loop(client, channel_id, thread_ts, transcribed_text, authorized=False))
            finally:
                # INTEGRITY ENFORCEMENT: Destroy file immediately
                if os.path.exists(temp_path):
                    os.remove(temp_path)
                    
    except Exception as e:
        logger.error(f"Failed to process Audio Interface: {e}")

@app.event("message")
async def handle_text_messages(body, logger, client):
    """Processes standard text commands sent by the authenticated user."""
    event = body.get("event", {})
    user_id = event.get("user")
    
    if user_id != ALLOWED_MEMBER_ID: return
    
    # Ignore messages without text or those that are just file shares (handled above)
    text = event.get("text", "")
    if not text or "files" in event: return

    channel_id = event.get("channel")
    # CRITICAL: Use thread_ts (parent) if this is a reply in a thread, otherwise use ts (starts new thread)
    thread_ts = event.get("thread_ts", event.get("ts"))
    
    # Clean the bot tag from the text (e.g. "<@U123456> hi" -> "hi")
    text = re.sub(r'<@U[A-Z0-9]+>', '', text).strip()
    
    await client.chat_postMessage(channel=channel_id, thread_ts=thread_ts, text=":hourglass_flowing_sand:")
    asyncio.create_task(process_task_loop(client, channel_id, thread_ts, text, authorized=False))

@app.event("app_mention")
async def handle_app_mentions(body, logger, client):
    """Fallback router for when the user tags Kynto explicitly in a channel."""
    await handle_text_messages(body, logger, client)

@app.action("confirm_action_yes")
async def handle_action_authorization(ack, body, client, logger):
    """Callback when the user explicitly clicks the 'Yes' confirmation button for a destructive action."""
    await ack()
    user_id = body.get("user", {}).get("id")
    if user_id != ALLOWED_MEMBER_ID: return
    
    # Extract channel and original task from the button payload
    channel_id = body["channel"]["id"]
    thread_ts = body["message"]["thread_ts"]
    original_task = body["actions"][0]["value"]
    
    # Immediately update the message to remove the buttons so they can't be clicked twice
    await client.chat_update(
        channel=channel_id,
        ts=body["message"]["ts"],
        text=":white_check_mark: *Action Authorized by Origin User. Executing...*",
        blocks=[]
    )
    
    # Re-run the task loop with authorized=True
    asyncio.create_task(process_task_loop(client, channel_id, thread_ts, original_task, authorized=True))

@app.action("confirm_action_no")
async def handle_action_rejection(ack, body, client, logger):
    """Callback when the user denies permission to Kynto."""
    await ack()
    if body.get("user", {}).get("id") != ALLOWED_MEMBER_ID: return
    
    channel_id = body["channel"]["id"]
    await client.chat_update(
        channel=channel_id,
        ts=body["message"]["ts"],
        text=":x: *Action Rejected by Origin User. System standing by.*",
        blocks=[]
    )

async def main():
    print(f"Kynto Sentinel Activating. Socket Mode tunneling to Slack...")
    handler = AsyncSocketModeHandler(app, SLACK_APP_TOKEN)
    await handler.start_async()

if __name__ == "__main__":
    asyncio.run(main())
