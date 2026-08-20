import { NavLink, Outlet, useLocation, useMatch, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { listAgents } from "../api";

const LAST_AGENT_KEY = "selected_agent_id";

const nav = [
  {
    id: "agents",
    label: "Agents",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    id: "tools",
    label: "Tools",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
      </svg>
    ),
  },
  {
    id: "chat",
    label: "Chat",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
];

function readStoredAgentId() {
  const raw = sessionStorage.getItem(LAST_AGENT_KEY);
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : null;
}

export default function AppShell({ user, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const toolsMatch = useMatch("/agents/:agentId/tools");
  const chatMatch = useMatch("/agents/:agentId/chat");
  const onTools = Boolean(useMatch("/tools") || toolsMatch);
  const onChat = Boolean(useMatch("/chat") || chatMatch);
  const routeAgentId = Number(toolsMatch?.params.agentId || chatMatch?.params.agentId || 0) || null;

  const [agents, setAgents] = useState(null);
  const [error, setError] = useState("");

  async function refreshAgents() {
    const data = await listAgents();
    setAgents(data);
    return data;
  }

  useEffect(() => {
    refreshAgents().catch((err) => setError(err.message));
  }, []);

  const selectedAgent = useMemo(() => {
    if (!agents || !routeAgentId) {
      return null;
    }
    return agents.find((item) => item.id === routeAgentId) || null;
  }, [agents, routeAgentId]);

  useEffect(() => {
    if (selectedAgent) {
      sessionStorage.setItem(LAST_AGENT_KEY, String(selectedAgent.id));
    }
  }, [selectedAgent]);

  useEffect(() => {
    if (agents && routeAgentId && !selectedAgent) {
      navigate("/agents", { replace: true });
    }
  }, [agents, routeAgentId, selectedAgent, navigate]);

  function rememberAgent(agent) {
    sessionStorage.setItem(LAST_AGENT_KEY, String(agent.id));
  }

  function agentPath(section) {
    if (selectedAgent) {
      return `/agents/${selectedAgent.id}/${section}`;
    }
    const stored = readStoredAgentId();
    if (stored && agents?.some((item) => item.id === stored)) {
      return `/agents/${stored}/${section}`;
    }
    return `/${section}`;
  }

  function upsertAgent(updated) {
    setAgents((list) => {
      if (!list) {
        return list;
      }
      if (list.some((item) => item.id === updated.id)) {
        return list.map((item) => (item.id === updated.id ? updated : item));
      }
      return [...list, updated];
    });
  }

  function dropAgent(agentId) {
    setAgents((list) => (list ? list.filter((item) => item.id !== agentId) : list));
    if (readStoredAgentId() === agentId) {
      sessionStorage.removeItem(LAST_AGENT_KEY);
    }
    if (routeAgentId === agentId) {
      navigate("/agents", { replace: true });
    }
  }

  const crumb = selectedAgent
    ? `Home / ${onChat ? "Chat" : onTools ? "Tools" : "Agents"} / ${selectedAgent.name}`
    : `Home / ${onChat ? "Chat" : onTools ? "Tools" : "Agents"}`;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="sidebar-mark">M</span>
          <div>
            <p className="sidebar-product">MINI AGENT</p>
            <p className="sidebar-sub">Platform</p>
          </div>
        </div>
        <nav className="sidebar-nav">
          {nav.map((item) => {
            const to =
              item.id === "agents" ? "/agents" : agentPath(item.id);
            const active =
              item.id === "agents"
                ? location.pathname === "/agents"
                : item.id === "tools"
                  ? onTools
                  : onChat;
            return (
              <NavLink
                key={item.id}
                to={to}
                className={active ? "nav-item nav-item-active" : "nav-item"}
              >
                {item.icon}
                {item.label}
              </NavLink>
            );
          })}
        </nav>
        <div className="sidebar-foot">
          <p className="sidebar-tenant">{user.tenant_name}</p>
          <p className="muted">{user.email}</p>
          <button type="button" className="ghost" onClick={onLogout}>
            Sign out
          </button>
        </div>
      </aside>

      <main className={onChat ? "workspace workspace-chat" : "workspace"}>
        <header className="workspace-head">
          <p className="crumb">{crumb}</p>
          <h1>{onChat ? "Chat" : onTools ? "Tools" : "Agents"}</h1>
          {!onChat && !onTools ? (
            <p className="muted workspace-lead">Create and manage agents for this tenant.</p>
          ) : null}
        </header>
        {error ? <p className="error">{error}</p> : null}
        <Outlet
          context={{
            agents,
            selectedAgent,
            refreshAgents,
            upsertAgent,
            dropAgent,
            rememberAgent,
            setError,
          }}
        />
      </main>
    </div>
  );
}
