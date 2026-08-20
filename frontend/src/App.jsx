import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useEffect, useState } from "react";
import { clearToken, getToken, me, subscribeAuthExpired } from "./api";
import AppShell from "./layout/AppShell";
import AgentsPage from "./pages/Agents";
import ChatPanel from "./pages/ChatPanel";
import LoginPage from "./pages/Login";
import ToolsPanel from "./pages/ToolsPanel";

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(getToken()));

  useEffect(() => {
    return subscribeAuthExpired(() => setUser(null));
  }, []);

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    me()
      .then(setUser)
      .catch(() => {
        clearToken();
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="boot">Loading...</div>;
  }

  if (!user) {
    return <LoginPage onLoggedIn={setUser} />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          element={
            <AppShell
              user={user}
              onLogout={() => {
                clearToken();
                setUser(null);
              }}
            />
          }
        >
          <Route path="/" element={<Navigate to="/agents" replace />} />
          <Route path="/agents" element={<AgentsPage />} />
          <Route path="/tools" element={<ToolsPanel />} />
          <Route path="/chat" element={<ChatPanel />} />
          <Route path="/agents/:agentId/tools" element={<ToolsPanel />} />
          <Route path="/agents/:agentId/chat" element={<ChatPanel />} />
          <Route path="*" element={<Navigate to="/agents" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
