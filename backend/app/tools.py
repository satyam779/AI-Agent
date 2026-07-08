import json
import datetime
from typing import List, Optional
from langchain_core.tools import tool
from .database import SessionLocal, HCPInteraction, FollowUpTask

def get_current_date_str():
    # Return today's date in MM/DD/YYYY format
    return datetime.date.today().strftime("%m/%d/%Y")

def get_current_time_str():
    # Return current time in HH:MM AM/PM format
    return datetime.datetime.now().strftime("%I:%M %p")

@tool
def log_interaction(
    hcp_name: str,
    topics_discussed: str,
    sentiment: str = "Neutral",
    materials_shared: Optional[str] = "",
    interaction_type: str = "Meeting",
    date: Optional[str] = None,
    time: Optional[str] = None,
    attendees: Optional[str] = "",
    samples_distributed: Optional[str] = "",
    outcomes: Optional[str] = "",
    followup_actions: Optional[str] = ""
) -> str:
    """
    Logs a new interaction with a healthcare professional (HCP). 
    Use this tool when the user describes a new interaction or meeting details.
    
    Args:
        hcp_name: The name of the Healthcare Professional (e.g., 'Dr. Smith').
        topics_discussed: Summary of what was discussed (e.g., 'Product X efficiency').
        sentiment: Sentiment of the interaction ('Positive', 'Neutral', or 'Negative').
        materials_shared: Comma-separated list of materials shared (e.g., 'Brochures, Samples').
        interaction_type: Type of interaction (e.g., 'Meeting', 'Call', 'Email', 'Lunch & Learn').
        date: Date of the interaction. Defaults to today's date if not provided.
        time: Time of the interaction. Defaults to current time if not provided.
        attendees: Any other attendees present.
        samples_distributed: Any clinical samples distributed (e.g., 'Sample X 10ml, Sample Y').
        outcomes: Key outcomes or agreements reached.
        followup_actions: Any follow-up actions or next steps.
    """
    if not date or date.lower() in ["today", "now", "current"]:
        date = get_current_date_str()
    if not time or time.lower() in ["now", "current"]:
        time = get_current_time_str()
        
    materials = []
    if materials_shared:
        clean_str = materials_shared.strip()
        if clean_str.startswith("[") and clean_str.endswith("]"):
            inner = clean_str[1:-1]
            materials = [m.replace("'", "").replace('"', "").strip() for m in inner.split(",") if m.strip()]
        else:
            materials = [m.strip() for m in clean_str.split(",") if m.strip()]
            
    materials_str = ", ".join(materials)

    db = SessionLocal()
    try:
        interaction = HCPInteraction(
            hcp_name=hcp_name,
            interaction_type=interaction_type,
            date=date,
            time=time,
            attendees=attendees,
            topics_discussed=topics_discussed,
            materials_shared=materials_str,
            sentiment=sentiment,
            samples_distributed=samples_distributed,
            outcomes=outcomes,
            followup_actions=followup_actions
        )
        db.add(interaction)
        db.commit()
        db.refresh(interaction)
        
        result = {
            "status": "success",
            "action": "log_interaction",
            "message": f"Successfully logged interaction with {hcp_name} on {date}.",
            "form_state": {
                "hcp_name": hcp_name,
                "interaction_type": interaction_type,
                "date": date,
                "time": time,
                "attendees": attendees,
                "topics_discussed": topics_discussed,
                "materials_shared": materials,
                "sentiment": sentiment,
                "samples_distributed": samples_distributed,
                "outcomes": outcomes,
                "followup_actions": followup_actions
            }
        }
        return json.dumps(result)
    except Exception as e:
        db.rollback()
        return json.dumps({"status": "error", "message": str(e)})
    finally:
        db.close()

@tool
def edit_interaction(
    hcp_name: Optional[str] = None,
    interaction_type: Optional[str] = None,
    date: Optional[str] = None,
    time: Optional[str] = None,
    attendees: Optional[str] = None,
    topics_discussed: Optional[str] = None,
    materials_shared: Optional[str] = None,
    sentiment: Optional[str] = None,
    samples_distributed: Optional[str] = None,
    outcomes: Optional[str] = None,
    followup_actions: Optional[str] = None
) -> str:
    """
    Modifies specific fields of the current interaction form state based on the user's correction.
    Use this tool when the user points out a mistake in the logged details (e.g. 'the name was actually Dr. John').
    Only specify the parameters that the user wants to update. Do not modify other fields.
    """
    updates = {}
    if hcp_name is not None:
        updates["hcp_name"] = hcp_name
    if interaction_type is not None:
        updates["interaction_type"] = interaction_type
    if date is not None:
        if date.lower() in ["today", "now", "current"]:
            updates["date"] = get_current_date_str()
        else:
            updates["date"] = date
    if time is not None:
        if time.lower() in ["now", "current"]:
            updates["time"] = get_current_time_str()
        else:
            updates["time"] = time
    if attendees is not None:
        updates["attendees"] = attendees
    if topics_discussed is not None:
        updates["topics_discussed"] = topics_discussed
    if materials_shared is not None:
        clean_str = materials_shared.strip()
        if clean_str.startswith("[") and clean_str.endswith("]"):
            inner = clean_str[1:-1]
            updates["materials_shared"] = [m.replace("'", "").replace('"', "").strip() for m in inner.split(",") if m.strip()]
        else:
            updates["materials_shared"] = [m.strip() for m in clean_str.split(",") if m.strip()]
    if sentiment is not None:
        updates["sentiment"] = sentiment
    if samples_distributed is not None:
        updates["samples_distributed"] = samples_distributed
    if outcomes is not None:
        updates["outcomes"] = outcomes
    if followup_actions is not None:
        updates["followup_actions"] = followup_actions

    # Update database record if needed (we'll update the most recent one for this HCP if hcp_name is known,
    # or just let the front-end merge state. Let's update the most recent db entry for the HCP to keep data consistent)
    db = SessionLocal()
    try:
        # Find the latest interaction
        query = db.query(HCPInteraction)
        if hcp_name:
            query = query.filter(HCPInteraction.hcp_name.like(f"%{hcp_name}%"))
        latest = query.order_by(HCPInteraction.created_at.desc()).first()
        
        if latest:
            if "interaction_type" in updates:
                latest.interaction_type = updates["interaction_type"]
            if "date" in updates:
                latest.date = updates["date"]
            if "time" in updates:
                latest.time = updates["time"]
            if "attendees" in updates:
                latest.attendees = updates["attendees"]
            if "topics_discussed" in updates:
                latest.topics_discussed = updates["topics_discussed"]
            if "materials_shared" in updates:
                latest.materials_shared = ", ".join(updates["materials_shared"])
            if "sentiment" in updates:
                latest.sentiment = updates["sentiment"]
            if "samples_distributed" in updates:
                latest.samples_distributed = updates["samples_distributed"]
            if "outcomes" in updates:
                latest.outcomes = updates["outcomes"]
            if "followup_actions" in updates:
                latest.followup_actions = updates["followup_actions"]
            if hcp_name is not None:
                latest.hcp_name = hcp_name
            db.commit()
            
        result = {
            "status": "success",
            "action": "edit_interaction",
            "message": f"Successfully updated the following fields: {', '.join(updates.keys())}",
            "updates": updates
        }
        return json.dumps(result)
    except Exception as e:
        db.rollback()
        return json.dumps({"status": "error", "message": str(e)})
    finally:
        db.close()

@tool
def get_hcp_history(hcp_name: str) -> str:
    """
    Retrieves previous logged interactions with a specific Healthcare Professional (HCP) from the CRM database.
    Use this tool when the user asks about past interactions, history, or context for a specific doctor.
    """
    db = SessionLocal()
    try:
        interactions = db.query(HCPInteraction)\
            .filter(HCPInteraction.hcp_name.like(f"%{hcp_name}%"))\
            .order_by(HCPInteraction.created_at.desc())\
            .limit(5)\
            .all()
            
        history = []
        for i in interactions:
            history.append({
                "id": i.id,
                "hcp_name": i.hcp_name,
                "interaction_type": i.interaction_type,
                "date": i.date,
                "time": i.time,
                "attendees": i.attendees,
                "topics_discussed": i.topics_discussed,
                "materials_shared": [m.strip() for m in i.materials_shared.split(",") if m.strip()] if i.materials_shared else [],
                "sentiment": i.sentiment,
                "created_at": i.created_at.isoformat()
            })
            
        result = {
            "status": "success",
            "action": "get_hcp_history",
            "hcp_name": hcp_name,
            "history": history
        }
        return json.dumps(result)
    except Exception as e:
        return json.dumps({"status": "error", "message": str(e)})
    finally:
        db.close()

@tool
def schedule_followup(hcp_name: str, task_description: str, due_date: str) -> str:
    """
    Schedules a follow-up task or meeting in the database.
    Use this tool when the user wants to schedule a follow-up meeting, call, task, or action item.
    """
    # Normalize due date if "next week" or similar (simplistic parsing for prompt robustness)
    if due_date.lower() == "next week":
        due_date = (datetime.date.today() + datetime.timedelta(days=7)).strftime("%m/%d/%Y")
    elif due_date.lower() == "tomorrow":
        due_date = (datetime.date.today() + datetime.timedelta(days=1)).strftime("%m/%d/%Y")
    elif due_date.lower() == "today":
        due_date = get_current_date_str()

    db = SessionLocal()
    try:
        task = FollowUpTask(
            hcp_name=hcp_name,
            task_description=task_description,
            due_date=due_date,
            status="Pending"
        )
        db.add(task)
        db.commit()
        db.refresh(task)
        
        result = {
            "status": "success",
            "action": "schedule_followup",
            "message": f"Scheduled follow-up: '{task_description}' for {hcp_name} due by {due_date}.",
            "task": {
                "id": task.id,
                "hcp_name": hcp_name,
                "task_description": task_description,
                "due_date": due_date,
                "status": "Pending"
            }
        }
        return json.dumps(result)
    except Exception as e:
        db.rollback()
        return json.dumps({"status": "error", "message": str(e)})
    finally:
        db.close()

@tool
def draft_followup_email(hcp_name: str, topics_discussed: str, materials_shared: str = "", sentiment: str = "Neutral") -> str:
    """
    Drafts a professional follow-up email to the HCP based on the topics discussed and materials shared.
    Use this tool when the user asks to write, draft, or compose a follow-up email.
    """
    materials = []
    if materials_shared:
        clean_str = materials_shared.strip()
        if clean_str.startswith("[") and clean_str.endswith("]"):
            inner = clean_str[1:-1]
            materials = [m.replace("'", "").replace('"', "").strip() for m in inner.split(",") if m.strip()]
        else:
            materials = [m.strip() for m in clean_str.split(",") if m.strip()]
            
    materials_list = " and ".join(materials) if materials else "materials"
    
    subject = f"Follow-up: Our discussion regarding {topics_discussed.split('.')[0]}"
    
    body = (
        f"Dear {hcp_name},\n\n"
        f"Thank you for taking the time to discuss {topics_discussed} with me today. "
        f"I appreciate your insights and look forward to our continued collaboration.\n\n"
    )
    
    if materials:
        body += f"As promised, I have attached the following materials for your review: {', '.join(materials)}.\n\n"
    
    if sentiment.lower() == "positive":
        body += "I was delighted to hear your positive feedback regarding our products and look forward to discussing how we can further support your practice.\n\n"
    
    body += (
        "Please let me know if you have any questions or if I can provide any further clinical details.\n\n"
        "Best regards,\n\n"
        "[Sales Representative Name]\n"
        "Life Sciences Consultant"
    )
    
    result = {
        "status": "success",
        "action": "draft_followup_email",
        "email": {
            "subject": subject,
            "body": body
        }
    }
    return json.dumps(result)
