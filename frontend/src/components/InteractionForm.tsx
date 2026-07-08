import React, { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import type { RootState } from "../store";
import { clearFlashFields, addLocalUserMessage, sendChatMessage } from "../store/interactionSlice";
import { User, Calendar, Clock, BookOpen, Users, HelpCircle, Bot, Sparkles, Mic, Square, Volume2 } from "lucide-react";

export const InteractionForm: React.FC = () => {
  const dispatch = useDispatch();
  const { formState, lastUpdatedFields } = useSelector((state: RootState) => state.interaction);
  const [recordingState, setRecordingState] = useState<"idle" | "recording" | "processing">("idle");
  const [recordSeconds, setRecordSeconds] = useState(0);

  // Clear flash state after animation completes
  useEffect(() => {
    if (lastUpdatedFields.length > 0) {
      const timer = setTimeout(() => {
        dispatch(clearFlashFields());
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [lastUpdatedFields, dispatch]);

  // Voice recording mock timer
  useEffect(() => {
    let interval: any;
    if (recordingState === "recording") {
      interval = setInterval(() => {
        setRecordSeconds((s) => s + 1);
      }, 1000);
    } else {
      setRecordSeconds(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [recordingState]);

  // Monitor recording duration to complete transcription (runs once when seconds reach 5)
  useEffect(() => {
    if (recordingState === "recording" && recordSeconds >= 5) {
      handleFinishedRecording();
    }
  }, [recordSeconds, recordingState]);

  const startVoiceRecording = () => {
    setRecordSeconds(0);
    setRecordingState("recording");
  };

  const handleFinishedRecording = () => {
    setRecordingState("processing");
    setTimeout(() => {
      setRecordingState("idle");
      // Predefined transcript from a doctor meeting voice note
      const transcript = "Today I met with Dr. Smith and discussed product X efficiency. The sentiment was positive and I shared the brochures.";
      dispatch(addLocalUserMessage(transcript));
      dispatch(sendChatMessage(transcript) as any);
    }, 1500);
  };

  // Helper to determine if field should flash
  const getFieldClass = (fieldName: string) => {
    const isUpdated = lastUpdatedFields.includes(fieldName);
    return `form-control-container ${isUpdated ? "flash-active" : ""}`;
  };

  return (
    <div className="interaction-form-panel">
      <div className="panel-header">
        <div className="header-badge">
          <Bot size={14} />
          <span>AI-Controlled Interface</span>
        </div>
        <h1>Log HCP Interaction</h1>
        <p className="panel-sub">
          Form updates automatically as you describe the interaction details to the AI Assistant.
        </p>
      </div>

      <div className="form-grid">
        {/* HCP Name */}
        <div className={getFieldClass("hcp_name")}>
          <label htmlFor="hcp-name-field">
            <User size={14} /> HCP Name
          </label>
          <input
            id="hcp-name-field"
            type="text"
            className="form-input read-only-input"
            value={formState.hcp_name || ""}
            placeholder="Dr. Smith"
            readOnly
          />
          {lastUpdatedFields.includes("hcp_name") && <span className="update-pill">AI Extracted</span>}
        </div>

        {/* Interaction Type */}
        <div className={getFieldClass("interaction_type")}>
          <label htmlFor="interaction-type-field">
            <HelpCircle size={14} /> Interaction Type
          </label>
          <select
            id="interaction-type-field"
            className="form-select read-only-input"
            value={formState.interaction_type || "Meeting"}
            disabled
          >
            <option value="Meeting">Meeting</option>
            <option value="Call">Call</option>
            <option value="Email">Email</option>
            <option value="Lunch & Learn">Lunch & Learn</option>
            <option value="Presentation">Presentation</option>
          </select>
          {lastUpdatedFields.includes("interaction_type") && <span className="update-pill">AI Extracted</span>}
        </div>

        {/* Date */}
        <div className={getFieldClass("date")}>
          <label htmlFor="date-field">
            <Calendar size={14} /> Date
          </label>
          <input
            id="date-field"
            type="text"
            className="form-input read-only-input"
            value={formState.date || ""}
            placeholder="MM/DD/YYYY"
            readOnly
          />
          {lastUpdatedFields.includes("date") && <span className="update-pill">AI Extracted</span>}
        </div>

        {/* Time */}
        <div className={getFieldClass("time")}>
          <label htmlFor="time-field">
            <Clock size={14} /> Time
          </label>
          <input
            id="time-field"
            type="text"
            className="form-input read-only-input"
            value={formState.time || ""}
            placeholder="HH:MM AM/PM"
            readOnly
          />
          {lastUpdatedFields.includes("time") && <span className="update-pill">AI Extracted</span>}
        </div>

        {/* Attendees */}
        <div className={`${getFieldClass("attendees")} full-width`}>
          <label htmlFor="attendees-field">
            <Users size={14} /> Attendees
          </label>
          <input
            id="attendees-field"
            type="text"
            className="form-input read-only-input"
            value={formState.attendees || ""}
            placeholder="Enter names or search..."
            readOnly
          />
          {lastUpdatedFields.includes("attendees") && <span className="update-pill">AI Extracted</span>}
        </div>

        {/* Topics Discussed */}
        <div className={`${getFieldClass("topics_discussed")} full-width`}>
          <label htmlFor="topics-discussed-field">
            <BookOpen size={14} /> Topics Discussed
          </label>
          <textarea
            id="topics-discussed-field"
            className="form-textarea read-only-input"
            value={formState.topics_discussed || ""}
            placeholder="Product details, efficacy, sample requests..."
            rows={3}
            readOnly
          />
          {lastUpdatedFields.includes("topics_discussed") && <span className="update-pill">AI Extracted</span>}
        </div>

        {/* Outcomes */}
        <div className={`${getFieldClass("outcomes")} full-width`}>
          <label htmlFor="outcomes-field">Outcomes</label>
          <textarea
            id="outcomes-field"
            className="form-textarea read-only-input"
            value={formState.outcomes || ""}
            placeholder="Key outcomes or agreements..."
            rows={2}
            readOnly
          />
          {lastUpdatedFields.includes("outcomes") && <span className="update-pill">AI Extracted</span>}
        </div>

        {/* Follow-up Actions */}
        <div className={`${getFieldClass("followup_actions")} full-width`}>
          <label htmlFor="followup-actions-field">Follow-up Actions</label>
          <textarea
            id="followup-actions-field"
            className="form-textarea read-only-input"
            value={formState.followup_actions || ""}
            placeholder="Follow-up action details..."
            rows={2}
            readOnly
          />
          {lastUpdatedFields.includes("followup_actions") && <span className="update-pill">AI Extracted</span>}
        </div>
      </div>

      {/* Voice Note Link */}
      <div className="voice-note-section">
        {recordingState === "idle" && (
          <button onClick={startVoiceRecording} className="voice-note-btn">
            <Mic size={14} />
            <span>Summarize from Voice Note (Requires Consent)</span>
          </button>
        )}
        {recordingState === "recording" && (
          <div className="voice-note-recording">
            <div className="pulse-dot"></div>
            <Volume2 size={16} className="volume-icon" />
            <span>Recording Voice Note... ({recordSeconds}s)</span>
            <button className="cancel-record-btn" onClick={() => setRecordingState("idle")}>
              <Square size={10} />
            </button>
          </div>
        )}
        {recordingState === "processing" && (
          <div className="voice-note-processing">
            <Sparkles size={14} className="spinning-sparkle" />
            <span>Transcribing & Analyzing with LangGraph...</span>
          </div>
        )}
      </div>

      {/* Materials Shared Display */}
      <div className="materials-container">
        <h3>Materials Shared / Samples Distributed</h3>
        
        <div className="materials-sub-section">
          <div className="materials-label-row">
            <div className="materials-header-label">Materials Shared</div>
            <button className="visual-add-btn" disabled>Search/Add</button>
          </div>
          <div className="materials-chips-list">
            {formState.materials_shared && formState.materials_shared.length > 0 ? (
              formState.materials_shared.map((item, idx) => (
                <span 
                  key={idx} 
                  className={`material-chip ${lastUpdatedFields.includes("materials_shared") ? "flash-chip" : ""}`}
                >
                  {item}
                </span>
              ))
            ) : (
              <span className="no-materials">No brochures shared yet.</span>
            )}
          </div>
        </div>

        <div className="materials-sub-section" style={{ marginTop: "12px" }}>
          <div className="materials-label-row">
            <div className="materials-header-label">Samples Distributed</div>
            <button className="visual-add-btn" disabled>+ Add Sample</button>
          </div>
          <div className="materials-chips-list">
            {formState.samples_distributed ? (
              <span 
                className={`material-chip ${lastUpdatedFields.includes("samples_distributed") ? "flash-chip" : ""}`}
              >
                {formState.samples_distributed}
              </span>
            ) : (
              <span className="no-materials">No samples added.</span>
            )}
          </div>
        </div>
      </div>

      {/* Sentiment Tracker */}
      <div className="sentiment-section">
        <h3>Interaction Sentiment</h3>
        <div className="sentiment-options">
          {["Positive", "Neutral", "Negative"].map((s) => {
            const isActive = formState.sentiment?.toLowerCase() === s.toLowerCase();
            return (
              <div 
                key={s} 
                className={`sentiment-card ${s.toLowerCase()} ${isActive ? "active" : "inactive"}`}
              >
                <div className="sentiment-indicator"></div>
                <span>{s}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
