import { useNavigate, useOutletContext } from "react-router-dom";
import { useEffect, useState } from "react";
import { createAgent, deleteAgent, listSystemTools, updateAgent } from "../api";

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
  system_tools: ["get_current_time", "calculator"],
};

export default function AgentsPage() {
  const navigate = useNavigate();
  const {
    agents,
    selectedAgent,
    refreshAgents,
    upsertAgent,
    dropAgent,
    rememberAgent,
    setError: setShellError,
  } = useOutletContext();
  const [catalog, setCatalog] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingAgent, setEditingAgent] = useState(null);
  const [confirmingId, setConfirmingId] = useState(null);

  useEffect(() => {
    listSystemTools()
      .then(setCatalog)
      .catch((err) => setError(err.message));
  }, []);

  function startEdit(agent) {
    setEditingAgent(agent);
    setForm({
      name: agent.name,
      system_prompt: agent.system_prompt,
      model: agent.model,
      temperature: agent.temperature,
      system_tools: [...(agent.system_tools || [])],
    });
    setError("");
  }

  function cancelEdit() {
    setEditingAgent(null);
    setForm(emptyForm);
    setError("");
  }

  function toggleSystemTool(name) {
    setForm((current) => {
      const selected = current.system_tools.includes(name)
        ? current.system_tools.filter((item) => item !== name)
        : [...current.system_tools, name];
      return { ...current, system_tools: selected };
    });
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
        upsertAgent(updated);
        setEditingAgent(null);
        setForm(emptyForm);
      } else {
        const created = await createAgent(payload);
        upsertAgent(created);
        setForm(emptyForm);
      }
      await refreshAgents();
      setShellError("");
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
      dropAgent(agentId);
      if (editingAgent?.id === agentId) {
        cancelEdit();
      }
    } catch (err) {
      setError(err.message);
    }
  }

  function openChat(agent) {
    rememberAgent(agent);
    navigate(`/agents/${agent.id}/chat`);
  }

  function openTools(agent) {
    rememberAgent(agent);
    navigate(`/agents/${agent.id}/tools`);
  }

  const modelOptions = MODEL_OPTIONS.includes(form.model)
    ? MODEL_OPTIONS
    : [form.model, ...MODEL_OPTIONS];

  return (
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
          <div className="field">
            <span>System tools</span>
            <div className="tool-pick">
              {catalog.map((item) => (
                <label key={item.name} className="tool-pick-item">
                  <input
                    type="checkbox"
                    checked={form.system_tools.includes(item.name)}
                    onChange={() => toggleSystemTool(item.name)}
                  />
                  <span>
                    <strong>{item.name}</strong>
                    <span className="muted">{item.description}</span>
                  </span>
                </label>
              ))}
            </div>
            <p className="field-hint">HTTP tools are added after the agent exists.</p>
          </div>
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
                <p className="entity-meta">
                  Temperature {agent.temperature}
                  {(agent.system_tools || []).length
                    ? ` · ${(agent.system_tools || []).join(", ")}`
                    : " · No system tools"}
                </p>
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
  );
}
