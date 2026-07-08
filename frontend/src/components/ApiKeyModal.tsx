import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "../store";
import { setApiKey, toggleSettings } from "../store/interactionSlice";
import { Key, Eye, EyeOff, ShieldAlert, X } from "lucide-react";

export const ApiKeyModal: React.FC = () => {
  const dispatch = useDispatch();
  const { apiKey, showSettings } = useSelector((state: RootState) => state.interaction);
  const [tempKey, setTempKey] = useState(apiKey);
  const [showKey, setShowKey] = useState(false);

  if (!showSettings) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    dispatch(setApiKey(tempKey.trim()));
  };

  return (
    <div className="modal-overlay">
      <div className="modal-container">
        <div className="modal-header">
          <div className="modal-title">
            <Key className="title-icon" size={20} />
            <h2>Groq API Key Setup</h2>
          </div>
          {apiKey && (
            <button 
              className="close-button" 
              onClick={() => dispatch(toggleSettings())}
              aria-label="Close settings"
            >
              <X size={18} />
            </button>
          )}
        </div>
        
        <form onSubmit={handleSave} className="modal-body">
          <p className="modal-description">
            To run the LangGraph agent, you need a Groq API Key. The app runs the 
            <strong> llama-3.3-70b-versatile</strong> or <strong>gemma2-9b-it</strong> model for structured entity extraction.
          </p>

          <div className="warning-card">
            <ShieldAlert className="warning-icon" size={20} />
            <div className="warning-text">
              <strong>Local & Secure:</strong> Your API key is stored directly in your browser's local storage and is only sent to your local FastAPI backend server (`localhost:8000`).
            </div>
          </div>

          <div className="input-group">
            <label htmlFor="api-key-input">Groq API Key</label>
            <div className="input-with-icon">
              <input
                id="api-key-input"
                type={showKey ? "text" : "password"}
                placeholder="gsk_..."
                value={tempKey}
                onChange={(e) => setTempKey(e.target.value)}
                className="api-input-field"
                required
              />
              <button
                type="button"
                className="toggle-password"
                onClick={() => setShowKey(!showKey)}
                tabIndex={-1}
              >
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <span className="helper-text">
              Don't have a key? Get one at the <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer">Groq Developer Console</a>.
            </span>
          </div>

          <div className="modal-footer">
            {apiKey && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => dispatch(toggleSettings())}
              >
                Cancel
              </button>
            )}
            <button type="submit" className="btn btn-primary">
              Save and Connect
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
