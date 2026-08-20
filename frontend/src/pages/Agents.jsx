import { useEffect, useState } from "react";
import { createAgent, deleteAgent, listAgents, updateAgent } from "../api";
import ChatPanel from "./ChatPanel";
import ToolsPanel from "./ToolsPanel";

const MODEL_OPTIONS = [
  "anthropic/claude-haiku-4.5",
  "openai/gpt-4o-mini",
  "google/gemini-2.0-flash-001",
];

const emptyForm = {
  name: "",
  system_prompt: "",
  model: "anthropic/claude-haiku-4.5",
  temperature: 0.7,
};

const views = [
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

export default function AgentsPage({ user, onLogout }) {
  const [agents, setAgents] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [editingAgent, setEditingAgent] = useState(null);
  const [confirmingId, setConfirmingId] = useState(null);
  const [view, setView] = useState("agents");

  async function refresh() {
    const data = await listAgents();
    setAgents(data);
  }

  useEffect(() => {
    refresh().catch((err) => setError(err.message));
  }, []);

  function startEdit(agent) {
    setView("agents");
    setEditingAgent(agent);
    setForm({
      name: agent.name,
      system_prompt: agent.system_prompt,
      model: agent.model,
      temperature: agent.temperature,
    });
    setError("");
  }

  function cancelEdit() {
    setEditingAgent(null);
    setForm(emptyForm);
    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const payload = {
      ...form,
      temperature: Number(String(form.temperature).replace(",", ".")),
    };
    try {
      if (editingAgent) {
        const updated = await updateAgent(editingAgent.id, payload);
        if (selectedAgent?.id === updated.id) {
          setSelectedAgent(updated);
        }
        setEditingAgent(null);
        setForm(emptyForm);
      } else {
        await createAgent(payload);
        setForm(emptyForm);
      }
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(agentId) {
    setError("");
    try {
      await deleteAgent(agentId);
      setConfirmingId(null);
      if (selectedAgent?.id === agentId) {
        setSelectedAgent(null);
        setView("agents");
      }
      if (editingAgent?.id === agentId) {
        cancelEdit();
      }
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  function openChat(agent) {
    setSelectedAgent(agent);
    setView("chat");
  }

  function openTools(agent) {
    setSelectedAgent(agent);
    setView("tools");
  }

  const modelOptions = MODEL_OPTIONS.includes(form.model)
    ? MODEL_OPTIONS
    : [form.model, ...MODEL_OPTIONS];

  const crumb = selectedAgent
    ? `Home / ${viewLabel(view)} / ${selectedAgent.name}`
    : `Home / ${viewLabel(view)}`;

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
          {views.map((item) => (
            <button
              key={item.id}
              type="button"
              className={view === item.id ? "nav-item nav-item-active" : "nav-item"}
              onClick={() => setView(item.id)}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <p className="sidebar-tenant">{user.tenant_name}</p>
          <p className="muted">{user.email}</p>
          <button type="button" className="ghost" onClick={onLogout}>
            Sign out
          </button>
        </div>
      </aside>

      <main className={view === "chat" ? "workspace workspace-chat" : "workspace"}>
        <header className="workspace-head">
          <p className="crumb">{crumb}</p>
          <h1>{view === "agents" && editingAgent ? "Edit agent" : viewLabel(view)}</h1>
          {view === "agents" ? (
            <p className="muted workspace-lead">Create and manage agents for this tenant.</p>
          ) : null}
        </header>

        {view === "agents" ? (
          <div className="workspace-grid">
            <section className="panel">
              <div className="panel-head">
                <div>
                  <p className="stat-label">{editingAgent ? "Update" : "New agent"}</p>
                  <h2>{editingAgent ? "Edit agent" : "Create agent"}</h2>
                </div>
              </div>
              <form className="stack" onSubmit={handleSubmit}>
                <label className="field">
                  <span>Name</span>
                  <input
                    value={form.name}
                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                    required
                  />
                </label>
                <label className="field">
                  <span>System prompt</span>
                  <textarea
                    rows={5}
                    value={form.system_prompt}
                    onChange={(event) =>
                      setForm({ ...form, system_prompt: event.target.value })
                    }
                    required
                  />
                </label>
                <label className="field">
                  <span>Model</span>
                  <select
                    value={form.model}
                    onChange={(event) => setForm({ ...form, model: event.target.value })}
                    required
                  >
                    {modelOptions.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Temperature</span>
                  <input
                    type="number"
                    min="0"
                    max="2"
                    step="0.1"
                    value={form.temperature}
                    onChange={(event) =>
                      setForm({ ...form, temperature: event.target.value })
                    }
                    required
                  />
                  <p className="field-hint">0 is consistent, 2 is more random.</p>
                </label>
                {error ? <p className="error">{error}</p> : null}
                <div className="form-actions">
                  <button className="primary" type="submit" disabled={busy}>
                    {busy ? "Saving" : editingAgent ? "Save agent" : "Create agent"}
                  </button>
                  {editingAgent ? (
                    <button type="button" className="ghost" onClick={cancelEdit}>
                      Cancel
                    </button>
                  ) : null}
                </div>
              </form>
            </section>

            <section>
              <div className="panel-head">
                <div>
                  <p className="stat-label">Catalog</p>
                  <h2>Your agents</h2>
                </div>
              </div>
              {agents === null ? (
                <ul className="agent-grid">
                  <li className="entity-card skeleton-card" />
                  <li className="entity-card skeleton-card" />
                  <li className="entity-card skeleton-card" />
                </ul>
              ) : agents.length === 0 ? (
                <div className="panel">
                  <div className="empty-state">
                    <p className="empty-title">No agents yet</p>
                    <p className="muted">Create an agent on the left to start chatting and attaching tools.</p>
                  </div>
                </div>
              ) : (
                <ul className="agent-grid">
                  {agents.map((agent) => (
                    <li
                      key={agent.id}
                      className={
                        selectedAgent?.id === agent.id
                          ? "entity-card entity-card-active"
                          : "entity-card"
                      }
                    >
                      <div className="entity-card-top">
                        <span className="entity-mark">{agent.name.slice(0, 1).toUpperCase()}</span>
                        <span className="badge">{agent.model}</span>
                      </div>
                      <h3>{agent.name}</h3>
                      <p className="muted prompt-preview">{agent.system_prompt}</p>
                      <p className="entity-meta">Temperature {agent.temperature}</p>
                      <div className="entity-card-actions">
                        {confirmingId === agent.id ? (
                          <>
                            <span className="muted">Delete this agent and its chats?</span>
                            <button
                              type="button"
                              className="ghost ghost-danger"
                              onClick={() => handleDelete(agent.id)}
                            >
                              Confirm
                            </button>
                            <button type="button" className="ghost" onClick={() => setConfirmingId(null)}>
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button type="button" className="primary" onClick={() => openChat(agent)}>
                              Chat
                            </button>
                            <button type="button" className="ghost" onClick={() => openTools(agent)}>
                              Tools
                            </button>
                            <button type="button" className="ghost" onClick={() => startEdit(agent)}>
                              Edit
                            </button>
                            <button
                              type="button"
                              className="ghost ghost-danger"
                              onClick={() => setConfirmingId(agent.id)}
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        ) : null}

        {view === "tools" ? <ToolsPanel agent={selectedAgent} /> : null}
        {view === "chat" ? <ChatPanel agent={selectedAgent} /> : null}
      </main>
    </div>
  );
}

function viewLabel(view) {
  if (view === "tools") {
    return "Tools";
  }
  if (view === "chat") {
    return "Chat";
  }
  return "Agents";
}
