import React, { useState, useRef, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import type { RootState, AppDispatch } from "../store";
import { 
  addLocalUserMessage, 
  sendChatMessage, 
  resetDatabase,
  clearEmail,
  clearHistoryList,
  toggleSettings
} from "../store/interactionSlice";
import { 
  Send, 
  RotateCcw, 
  Wrench, 
  Mail, 
  Copy, 
  Check, 
  History, 
  Sparkles, 
  ChevronDown, 
  ChevronUp, 
  Calendar,
  Layers
} from "lucide-react";

export const ChatPanel: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { chatHistory, isLoading, hcpHistory, followupEmail } = useSelector(
    (state: RootState) => state.interaction
  );
  
  const [input, setInput] = useState("");
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll chat to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const query = input.trim();
    setInput("");
    
    // Add user message locally
    dispatch(addLocalUserMessage(query));
    
    // Send to backend
    dispatch(sendChatMessage(query));
  };

  const handleCopyEmail = () => {
    if (!followupEmail) return;
    navigator.clipboard.writeText(followupEmail);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  const toggleToolDetails = (toolId: string) => {
    setExpandedTools((prev) => ({
      ...prev,
      [toolId]: !prev[toolId],
    }));
  };

  const handlePresetClick = (text: string) => {
    setInput(text);
  };

  // Safe client-side markdown formatter
  const renderMessageContent = (content: string) => {
    let html = content
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    
    // Bold: **text**
    html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    
    // Italic: *text*
    html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");
    
    // Checkmark emojis
    html = html.replace(/✅/g, '<span class="emoji-green">✅</span>');
    html = html.replace(/⚠️/g, '<span class="emoji-yellow">⚠️</span>');
    html = html.replace(/❌/g, '<span class="emoji-red">❌</span>');
    html = html.replace(/🔄/g, '<span class="emoji-blue">🔄</span>');
    
    // Newlines: \n
    html = html.replace(/\n/g, "<br />");
    
    return <div dangerouslySetInnerHTML={{ __html: html }} />;
  };

  const presets = [
    {
      label: "1. Log Meeting",
      prompt: "Today I met with Dr. Smith and discussed product X efficiency. The sentiment was positive and I shared the brochures."
    },
    {
      label: "2. Edit Field",
      prompt: "Sorry, the name was actually Dr. John, and the sentiment was negative."
    },
    {
      label: "3. Schedule Action",
      prompt: "Schedule a follow-up call with Dr. John for next week to check sample inventory."
    },
    {
      label: "4. Generate Email",
      prompt: "Draft a follow-up email for Dr. John regarding the discussion."
    },
    {
      label: "5. Search History",
      prompt: "Show me the previous interaction history for Dr. John."
    }
  ];

  return (
    <div className="chat-panel">
      {/* Top Header */}
      <div className="chat-header">
        <div className="chat-header-info">
          <div className="assistant-avatar">🤖</div>
          <div>
            <h3>AI Assistant</h3>
            <span className="assistant-status">Active via LangGraph</span>
          </div>
        </div>
        
        <div className="header-actions">
          <button 
            onClick={() => dispatch(toggleSettings())} 
            className="action-icon-btn" 
            title="Groq API Settings"
          >
            <Wrench size={16} />
          </button>
          <button 
            onClick={() => dispatch(resetDatabase())} 
            className="action-icon-btn" 
            title="Reset Form & Database"
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </div>

      {/* Messages Window */}
      <div className="chat-messages-container">
        {chatHistory.map((msg) => (
          <div key={msg.id} className={`chat-message-row ${msg.role}`}>
            {msg.role === "assistant" && (
              <div className="message-avatar">🤖</div>
            )}
            
            <div className="message-bubble-wrapper">
              <div className="message-bubble">
                {renderMessageContent(msg.content)}
                <span className="message-time">{msg.timestamp}</span>
              </div>

              {/* LangGraph Tool Logs Display */}
              {msg.toolLogs && msg.toolLogs.length > 0 && (
                <div className="message-tool-logs">
                  <div className="tool-logs-header">
                    <Layers size={12} />
                    <span>LangGraph Graph Agent Actions</span>
                  </div>
                  {msg.toolLogs.map((tool, idx) => {
                    const toolId = `${msg.id}-tool-${idx}`;
                    const isExpanded = !!expandedTools[toolId];
                    return (
                      <div key={idx} className="tool-log-item">
                        <button 
                          onClick={() => toggleToolDetails(toolId)}
                          className="tool-log-trigger"
                        >
                          <div className="tool-name-desc">
                            <Wrench size={12} className="wrench-icon" />
                            <strong>{tool.tool_name}</strong>
                          </div>
                          {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>
                        
                        {isExpanded && (
                          <pre className="tool-log-params">
                            <code>{JSON.stringify(tool.parameters, null, 2)}</code>
                          </pre>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="chat-message-row assistant">
            <div className="message-avatar">🤖</div>
            <div className="message-bubble typing-bubble">
              <span className="typing-dot"></span>
              <span className="typing-dot"></span>
              <span className="typing-dot"></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Auxiliary Context Panels (History or Email Draft) */}
      {(hcpHistory.length > 0 || followupEmail) && (
        <div className="chat-auxiliary-container">
          {/* History Panel */}
          {hcpHistory.length > 0 && (
            <div className="aux-card history-card">
              <div className="aux-card-header">
                <div className="aux-card-title">
                  <History size={14} />
                  <h4>HCP History Log (SQL Query)</h4>
                </div>
                <button 
                  onClick={() => dispatch(clearHistoryList())} 
                  className="aux-close-btn"
                >
                  Clear
                </button>
              </div>
              <div className="aux-card-body">
                {hcpHistory.map((item, idx) => (
                  <div key={idx} className="history-item">
                    <div className="history-meta">
                      <span className="history-date">
                        <Calendar size={10} /> {item.date} {item.time}
                      </span>
                      <span className={`history-sentiment ${item.sentiment.toLowerCase()}`}>
                        {item.sentiment}
                      </span>
                    </div>
                    <div className="history-topic">
                      <strong>{item.interaction_type}:</strong> {item.topics_discussed}
                    </div>
                    {item.materials_shared && item.materials_shared.length > 0 && (
                      <div className="history-materials">
                        <span>Materials:</span> {item.materials_shared.join(", ")}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Email Draft Panel */}
          {followupEmail && (
            <div className="aux-card email-card">
              <div className="aux-card-header">
                <div className="aux-card-title">
                  <Mail size={14} />
                  <h4>Draft Follow-up Email</h4>
                </div>
                <div className="aux-header-actions">
                  <button onClick={handleCopyEmail} className="copy-btn" title="Copy to clipboard">
                    {copiedEmail ? <Check size={14} className="copied" /> : <Copy size={14} />}
                    <span>{copiedEmail ? "Copied" : "Copy"}</span>
                  </button>
                  <button 
                    onClick={() => dispatch(clearEmail())} 
                    className="aux-close-btn"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div className="aux-card-body">
                <pre className="email-draft-text">{followupEmail}</pre>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Input Panel */}
      <div className="chat-input-section">
        {/* Preset Chips */}
        <div className="preset-container">
          <div className="preset-label">
            <Sparkles size={11} /> Test Prompts:
          </div>
          <div className="preset-scroll">
            {presets.map((p, idx) => (
              <button
                key={idx}
                onClick={() => handlePresetClick(p.prompt)}
                className="preset-chip"
                title={p.prompt}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="chat-input-form">
          <input
            type="text"
            className="chat-text-input"
            placeholder="Describe HCP interaction or ask a tool to run..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
          />
          <button 
            type="submit" 
            className="chat-submit-btn" 
            disabled={!input.trim() || isLoading}
          >
            <Send size={16} />
            <span>Log</span>
          </button>
        </form>
      </div>
    </div>
  );
};
