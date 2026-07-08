import json
import time
import asyncio
from typing import Annotated, Sequence, TypedDict, Dict, Any, List, Optional
from langchain_core.messages import BaseMessage, SystemMessage, HumanMessage, AIMessage, ToolMessage
from langchain_groq import ChatGroq
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages

# Import our tools
from .tools import (
    log_interaction, 
    edit_interaction, 
    get_hcp_history, 
    schedule_followup, 
    draft_followup_email
)
from .config import GROQ_MODEL, GROQ_API_KEY

# Simple cache for ChatGroq clients bound with tools per api_key
_LLM_CACHE: Dict[str, Any] = {}

def get_llm_with_tools(api_key: str, tools_list: list):
    key = api_key or "__default__"
    cache_key = f"{key}:{GROQ_MODEL}"
    if cache_key in _LLM_CACHE:
        return _LLM_CACHE[cache_key]

    llm = ChatGroq(
        api_key=api_key,
        model=GROQ_MODEL,
        temperature=0.1,
        timeout=15.0
    )
    llm_with_tools = llm.bind_tools(tools_list)
    _LLM_CACHE[cache_key] = llm_with_tools
    return llm_with_tools

# Pre-warm tools list and cache if server default key is present
TOOLS = [
    log_interaction,
    edit_interaction,
    get_hcp_history,
    schedule_followup,
    draft_followup_email,
]

if GROQ_API_KEY:
    try:
        # Warm the LLM client so first request is faster
        get_llm_with_tools(GROQ_API_KEY, TOOLS)
        print("Pre-warmed Groq LLM client with server default key.")
    except Exception as e:
        print(f"Warning: failed to pre-warm LLM: {e}")

class AgentState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], add_messages]
    form_state: Dict[str, Any]
    hcp_history: List[Dict[str, Any]]
    tool_logs: List[Dict[str, Any]]
    followup_email: Optional[str]

async def run_agent_workflow(
    message: str, 
    current_form_state: Dict[str, Any], 
    chat_history: List[Dict[str, str]], 
    api_key: str
) -> Dict[str, Any]:
    """
    Executes the LangGraph agent workflow for the given user message,
    updating and returning the interaction form state.
    """
    if not api_key:
        api_key = GROQ_API_KEY
        
    if not api_key:
        return {
            "reply": "⚠️ **Groq API Key missing.** The server does not have a default Groq API key configured.",
            "form_state": current_form_state,
            "tool_logs": [],
            "hcp_history": [],
            "followup_email": None
        }

    tools_list = [
        log_interaction, 
        edit_interaction, 
        get_hcp_history, 
        schedule_followup, 
        draft_followup_email
    ]
    tools_map = {t.name: t for t in tools_list}

    # Initialize or retrieve cached LLM bound with tools
    try:
        llm_with_tools = get_llm_with_tools(api_key, tools_list)
    except Exception as e:
        return {
            "reply": f"⚠️ **Error initializing LLM:** {str(e)}",
            "form_state": current_form_state,
            "tool_logs": [],
            "hcp_history": [],
            "followup_email": None
        }
    # llm_with_tools is created above via cache

    # 1. Define nodes
    async def call_model(state: AgentState):
        messages = list(state["messages"])
        print(f"\n--- [LangGraph Node: call_model] ---")
        print(f"Messages history length: {len(messages)}")
        for idx, msg in enumerate(messages):
            print(f"  [{idx}] {msg.type.upper()}: {msg.content[:80]}...")
            
        # Add system context with current form state details
        current_date_str = datetime_info()
        system_prompt = (
            "You are a helpful AI CRM Assistant for a life science/pharmaceutical sales representative.\n"
            f"Current Date: {current_date_str}.\n"
            "Your main task is to manage the 'Log HCP Interaction' screen on the left side of the split screen.\n"
            "The user will talk to you, and you must use tools to log interactions, edit interaction details, "
            "schedule follow-ups, draft emails, and fetch history.\n\n"
            f"CURRENT FORM STATE:\n{json.dumps(state['form_state'], indent=2)}\n\n"
            "INSTRUCTIONS:\n"
            "1. When the user describes a meeting or interaction, call the `log_interaction` tool. Extract "
            "HCP Name (e.g., 'Dr. Smith'), date, sentiment, materials shared, topics, and type. If date is today, use today's date.\n"
            "2. When the user corrects details (e.g. 'Actually, the name was Dr. John' or 'the sentiment was negative'), "
            "call `edit_interaction` and pass ONLY the corrected fields as parameters. Do not touch other fields.\n"
            "3. If the user asks for historical context or previous interaction logs for a doctor, call `get_hcp_history`.\n"
            "4. If they want to schedule next steps or tasks, call `schedule_followup`.\n"
            "5. If they want a draft email, call `draft_followup_email`.\n"
            "6. Always response politely in Markdown format after executing tools. If a tool fails, explain why."
        )
        
        full_messages = [SystemMessage(content=system_prompt)] + messages
        print("Invoking Groq API model...")
        t0 = time.perf_counter()
        # Run blocking model call in threadpool to avoid blocking the event loop
        response = await asyncio.to_thread(llm_with_tools.invoke, full_messages)
        t1 = time.perf_counter()
        print(f"Groq response received. Model call took {(t1-t0):.2f}s")
        if hasattr(response, "tool_calls") and response.tool_calls:
            print(f"Model generated tool calls: {[tc['name'] for tc in response.tool_calls]}")
        else:
            print(f"Model generated text reply: {response.content[:120]}...")
        return {"messages": [response]}

    async def execute_tools(state: AgentState):
        messages = state["messages"]
        last_message = messages[-1]
        
        print("\n--- [LangGraph Node: execute_tools] ---")
        tool_logs = list(state.get("tool_logs", []))
        form_state = dict(state["form_state"])
        hcp_history = list(state.get("hcp_history", []))
        followup_email = state.get("followup_email")
        
        new_messages = []
        
        if hasattr(last_message, "tool_calls") and last_message.tool_calls:
            print(f"Executing {len(last_message.tool_calls)} tool calls...")
            for tool_call in last_message.tool_calls:
                name = tool_call["name"]
                args = tool_call["args"]
                tool_id = tool_call["id"]
                
                tool_func = tools_map.get(name)
                if tool_func:
                    try:
                        print(f"  Running tool '{name}' with arguments: {args}")
                        # Log tool launch
                        log_entry = {
                            "tool_name": name,
                            "description": f"Invoked tool '{name}'",
                            "parameters": args
                        }
                        tool_logs.append(log_entry)

                        # Run the tool with timing
                        tt0 = time.perf_counter()
                        # Run tool invoke in threadpool if it's blocking
                        result_str = await asyncio.to_thread(tool_func.invoke, args)
                        tt1 = time.perf_counter()
                        print(f"  Tool '{name}' finished in {(tt1-tt0):.2f}s")
                        print(f"  Tool result received: {result_str[:120]}...")
                        result_data = json.loads(result_str)
                        
                        # Process results to update state variables
                        if result_data.get("status") == "success":
                            action = result_data.get("action")
                            if action == "log_interaction":
                                form_state = result_data["form_state"]
                                print(f"  Updated form state via log_interaction")
                            elif action == "edit_interaction":
                                # Merge updates
                                for k, v in result_data["updates"].items():
                                    form_state[k] = v
                                print(f"  Merged updates via edit_interaction: {list(result_data['updates'].keys())}")
                            elif action == "get_hcp_history":
                                hcp_history = result_data["history"]
                                print(f"  Fetched {len(hcp_history)} history entries")
                            elif action == "draft_followup_email":
                                email = result_data["email"]
                                followup_email = f"Subject: {email['subject']}\n\n{email['body']}"
                                print(f"  Generated follow-up email draft")
                        
                        # Add tool response message
                        new_messages.append(ToolMessage(
                            content=result_str,
                            tool_call_id=tool_id,
                            name=name
                        ))
                    except Exception as err:
                        print(f"  Exception in tool '{name}' execution: {str(err)}")
                        new_messages.append(ToolMessage(
                            content=json.dumps({"status": "error", "message": str(err)}),
                            tool_call_id=tool_id,
                            name=name
                        ))
                        
        return {
            "messages": new_messages,
            "form_state": form_state,
            "tool_logs": tool_logs,
            "hcp_history": hcp_history,
            "followup_email": followup_email
        }

    # 2. Build the workflow graph
    workflow = StateGraph(AgentState)
    workflow.add_node("agent", call_model)
    workflow.add_node("tools", execute_tools)
    
    workflow.set_entry_point("agent")
    
    # Conditional edge to route to tools or end
    def route_tool(state: AgentState):
        last_msg = state["messages"][-1]
        if hasattr(last_msg, "tool_calls") and last_msg.tool_calls:
            return "tools"
        return END
        
    workflow.add_conditional_edges(
        "agent",
        route_tool,
        {
            "tools": "tools",
            END: END
        }
    )
    
    workflow.add_edge("tools", "agent")
    
    app = workflow.compile()

    # 3. Prepare initial state
    messages = []
    # Add chat history
    for msg in chat_history:
        if msg["role"] == "user":
            messages.append(HumanMessage(content=msg["content"]))
        elif msg["role"] == "assistant":
            messages.append(AIMessage(content=msg["content"]))
            
    # Add latest message
    messages.append(HumanMessage(content=message))
    
    initial_state = {
        "messages": messages,
        "form_state": current_form_state,
        "hcp_history": [],
        "tool_logs": [],
        "followup_email": None
    }
    
    # 4. Run graph
    try:
        final_output = await app.ainvoke(initial_state)
        # Extract response
        last_msg = final_output["messages"][-1]
        reply_content = last_msg.content if last_msg else "No response generated."
        
        return {
            "reply": reply_content,
            "form_state": final_output["form_state"],
            "tool_logs": final_output["tool_logs"],
            "hcp_history": final_output["hcp_history"],
            "followup_email": final_output["followup_email"]
        }
    except Exception as e:
        return {
            "reply": f"⚠️ **Execution error inside LangGraph workflow:** {str(e)}",
            "form_state": current_form_state,
            "tool_logs": [],
            "hcp_history": [],
            "followup_email": None
        }

def datetime_info():
    import datetime
    now = datetime.datetime.now()
    return now.strftime("%A, %B %d, %Y %I:%M %p")
