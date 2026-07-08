import os
import json
import asyncio
from dotenv import load_dotenv
from app.agent import run_agent_workflow

load_dotenv()
api_key = os.getenv("GROQ_API_KEY")

message = "Today I met with Dr. Smith, discussed Product X efficiency, sentiment was positive and shared brochures"
current_form_state = {
    "hcp_name": "",
    "interaction_type": "Meeting",
    "date": "",
    "time": "",
    "attendees": "",
    "topics_discussed": "",
    "materials_shared": [],
    "sentiment": "Neutral",
    "samples_distributed": "",
    "outcomes": "",
    "followup_actions": ""
}
chat_history = []

async def main():
    print("Running workflow with prompt...")
    try:
        result = await run_agent_workflow(
            message=message,
            current_form_state=current_form_state,
            chat_history=chat_history,
            api_key=api_key
        )
        print("\nWorkflow completed successfully!")
        print("Reply:", result.get("reply"))
        print("Form State:", json.dumps(result.get("form_state"), indent=2))
        print("Tool Logs:", json.dumps(result.get("tool_logs"), indent=2))
    except Exception as e:
        print(f"Error occurred: {str(e)}")

if __name__ == "__main__":
    asyncio.run(main())
