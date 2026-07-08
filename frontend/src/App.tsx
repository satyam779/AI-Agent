import React from "react";
import { InteractionForm } from "./components/InteractionForm";
import { ChatPanel } from "./components/ChatPanel";
import { ApiKeyModal } from "./components/ApiKeyModal";

const App: React.FC = () => {
  return (
    <div className="app-container">
      {/* Navbar header */}
      <nav className="app-navbar">
        <div className="navbar-brand">
          <div className="brand-logo">A</div>
          <h2>AIVOA CRM</h2>
        </div>
        
        <div className="navbar-right">
          <div className="header-badge" style={{ margin: 0 }}>
            <span>HCP Module</span>
          </div>
        </div>
      </nav>

      {/* Main split dashboard view */}
      <main className="split-screen-layout">
        <InteractionForm />
        <ChatPanel />
      </main>

      <ApiKeyModal />
    </div>
  );
};

export default App;
