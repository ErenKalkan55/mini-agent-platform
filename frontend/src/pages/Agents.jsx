import { useEffect, useState } from "react";
import { createAgent, deleteAgent, listAgents, updateAgent } from "../api";
import ChatPanel from "./ChatPanel";
import ToolsPanel from "./ToolsPanel";

const emptyForm = {
  name: "",
  system_prompt: "",
  model: "anthropic/claude-haiku-4.5",
  temperature: 0.7,
};

export default function AgentsPage({ user, onLogout }) {
  const [agents, setAgents] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [editingAgent, setEditingAgent] = useState(null);

  async function refresh() {
    const data = await listAgents();
    setAgents(data);
  }

  useEffect(() => {
    refresh().catch((err) => setError(err.message));
  }, []);

  function startEdit(agent) {
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
      if (selectedAgent?.id === agentId) {
        setSelectedAgent(null);
      }
      if (editingAgent?.id === agentId) {
        cancelEdit();
      }
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <p className="brand">MINI AGENT PLATFORM</p>
        <div className="topbar-right">
          <span>{user.email}</span>
          <span className="muted">{user.tenant_name}</span>
          <button type="button" className="ghost" onClick={onLogout}>
            Sign out
          </button>
        </div>
      </header>

      <main className="layout">
        <section className="panel">
          <h2>{editingAgent ? "Edit agent" : "Create agent"}</h2>
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
              <input
                value={form.model}
                onChange={(event) => setForm({ ...form, model: event.target.value })}
                required
              />
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
            </label>
            {error ? <p className="error">{error}</p> : null}
            <button className="primary" type="submit" disabled={busy}>
              {busy ? "Saving" : editingAgent ? "Save agent" : "Create agent"}
            </button>
            {editingAgent ? (
              <button type="button" className="ghost" onClick={cancelEdit}>
                Cancel
              </button>
            ) : null}
          </form>
        </section>

        <section className="panel">
          <h2>Your agents</h2>
          {agents.length === 0 ? (
            <p className="muted">No agents yet.</p>
          ) : (
            <ul className="agent-list">
              {agents.map((agent) => (
                <li
                  key={agent.id}
                  className={
                    selectedAgent?.id === agent.id ? "agent-item agent-item-active" : "agent-item"
                  }
                >
                  <div>
                    <strong>{agent.name}</strong>
                    <p className="muted">
                      {agent.model} / temperature {agent.temperature}
                    </p>
                    <p className="prompt">{agent.system_prompt}</p>
                  </div>
                  <div className="agent-actions">
                    <button type="button" className="ghost" onClick={() => setSelectedAgent(agent)}>
                      Chat
                    </button>
                    <button type="button" className="ghost" onClick={() => startEdit(agent)}>
                      Edit
                    </button>
                    <button type="button" className="ghost" onClick={() => handleDelete(agent.id)}>
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <ToolsPanel agent={selectedAgent} />
        <ChatPanel agent={selectedAgent} />
      </main>
    </div>
  );
}
