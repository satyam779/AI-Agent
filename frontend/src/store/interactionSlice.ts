import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";

export interface FormState {
  hcp_name: string;
  interaction_type: string;
  date: string;
  time: string;
  attendees: string;
  topics_discussed: string;
  materials_shared: string[];
  sentiment: string;
  samples_distributed: string;
  outcomes: string;
  followup_actions: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  toolLogs?: Array<{
    tool_name: string;
    description: string;
    parameters: any;
  }>;
}

export interface InteractionState {
  formState: FormState;
  chatHistory: ChatMessage[];
  hcpHistory: any[];
  followupEmail: string | null;
  isLoading: boolean;
  apiKey: string;
  showSettings: boolean;
  lastUpdatedFields: string[]; // List of fields that were updated in the last action for flash animations
}

const initialFormState: FormState = {
  hcp_name: "",
  interaction_type: "Meeting",
  date: "",
  time: "",
  attendees: "",
  topics_discussed: "",
  materials_shared: [],
  sentiment: "Neutral",
  samples_distributed: "",
  outcomes: "",
  followup_actions: "",
};

const savedApiKey = localStorage.getItem("groq_api_key") || "";

const initialState: InteractionState = {
  formState: initialFormState,
  chatHistory: [
    {
      id: "welcome",
      role: "assistant",
      content: "👋 **Welcome to AI-First CRM HCP Module.**\n\nLog your interaction details here via chat (e.g., *'Today I met with Dr. Smith, discussed Product X efficiency, sentiment was positive and shared brochures.'*). The AI assistant will parse and populate the CRM form on the left automatically.",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ],
  hcpHistory: [],
  followupEmail: null,
  isLoading: false,
  apiKey: savedApiKey,
  showSettings: false,
  lastUpdatedFields: [],
};

// Async thunk to send chat message to FastAPI
export const sendChatMessage = createAsyncThunk(
  "interaction/sendChatMessage",
  async (message: string, { getState, rejectWithValue }) => {
    const state = getState() as { interaction: InteractionState };
    const { formState, chatHistory, apiKey } = state.interaction;

    // Filter out welcome message or format for backend compatibility.
    // Also avoid sending a duplicate user message if the UI already added
    // the same user message locally before dispatching this thunk.
    const formattedHistory = chatHistory
      .filter((m) => m.id !== "welcome")
      .filter((m) => !(m.role === "user" && m.content === message))
      .map((m) => ({
        role: m.role,
        content: m.content,
      }));

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (apiKey) {
        headers["X-Groq-Api-Key"] = apiKey;
      }

      const response = await fetch("/api/chat", {
        method: "POST",
        headers,
        body: JSON.stringify({
          message,
          form_state: formState,
          chat_history: formattedHistory,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to communicate with the server.");
      }

      return await response.json();
    } catch (error: any) {
      return rejectWithValue(error.message || "Server connection failed.");
    }
  }
);

// Async thunk to reset database
export const resetDatabase = createAsyncThunk(
  "interaction/resetDatabase",
  async (_, { rejectWithValue }) => {
    try {
      const response = await fetch("/api/reset", {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to reset database");
      return await response.json();
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

const interactionSlice = createSlice({
  name: "interaction",
  initialState,
  reducers: {
    setApiKey: (state, action: PayloadAction<string>) => {
      state.apiKey = action.payload;
      localStorage.setItem("groq_api_key", action.payload);
      if (action.payload) {
        state.showSettings = false;
      }
    },
    toggleSettings: (state) => {
      state.showSettings = !state.showSettings;
    },
    clearFlashFields: (state) => {
      state.lastUpdatedFields = [];
    },
    clearEmail: (state) => {
      state.followupEmail = null;
    },
    clearHistoryList: (state) => {
      state.hcpHistory = [];
    },
    addLocalUserMessage: (state, action: PayloadAction<string>) => {
      state.chatHistory.push({
        id: Math.random().toString(36).substr(2, 9),
        role: "user",
        content: action.payload,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
      state.isLoading = true;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(sendChatMessage.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(sendChatMessage.fulfilled, (state, action) => {
        state.isLoading = false;
        const { reply, form_state, tool_logs, hcp_history, followup_email } = action.payload;

        // Calculate which fields updated to trigger flash animation
        const updatedFields: string[] = [];
        Object.keys(form_state).forEach((key) => {
          const k = key as keyof FormState;
          if (JSON.stringify(state.formState[k]) !== JSON.stringify(form_state[k])) {
            updatedFields.push(k);
          }
        });
        state.lastUpdatedFields = updatedFields;

        // Update form state
        state.formState = form_state;

        // Update history details if tool was run
        if (hcp_history && hcp_history.length > 0) {
          state.hcpHistory = hcp_history;
        }

        // Update email if tool was run
        if (followup_email) {
          state.followupEmail = followup_email;
        }

        // Add AI response to chat logs
        state.chatHistory.push({
          id: Math.random().toString(36).substr(2, 9),
          role: "assistant",
          content: reply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          toolLogs: tool_logs || [],
        });
      })
      .addCase(sendChatMessage.rejected, (state, action) => {
        state.isLoading = false;
        state.chatHistory.push({
          id: Math.random().toString(36).substr(2, 9),
          role: "assistant",
          content: `❌ **Error:** ${action.payload || "Failed to contact backend API. Make sure the FastAPI backend is running on port 8000."}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        });
      })
      .addCase(resetDatabase.fulfilled, (state) => {
        state.formState = initialFormState;
        state.hcpHistory = [];
        state.followupEmail = null;
        state.chatHistory.push({
          id: Math.random().toString(36).substr(2, 9),
          role: "assistant",
          content: "🔄 **Database and form fields reset successfully.** Ready for a new interaction!",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        });
      });
  },
});

export const { setApiKey, toggleSettings, clearFlashFields, clearEmail, clearHistoryList, addLocalUserMessage } =
  interactionSlice.actions;

export default interactionSlice.reducer;
