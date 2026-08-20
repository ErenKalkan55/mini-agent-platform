import { useEffect, useState } from "react";
import { createTool, deleteTool, listSystemTools, listTools } from "../api";

const emptyForm = {
  name: "",
  description: "",
  method: "GET",
  url: "",
  argument_schema: '{"type":"object","properties":{},"required":[]}',
};

export default function ToolsPanel({ agent }) {
  const [systemTools, setSystemTools] = useState([]);
  const [tools, setTools] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh(agentId) {
    const [system, custom] = await Promise.all([
      listSystemTools(),
      listTools(agentId),
    ]);
    setSystemTools(system);
    setTools(custom);
  }

  useEffect(() => {
    if (!agent) {
      setTools([]);
      setError("");
      return;
    }
    refresh(agent.id).catch((err) => setError(err.message));
  }, [agent?.id]);

  if (!agent) {
    return (
      <section className="panel tools-panel">
        <h2>Tools</h2>
        <p className="muted">Select an agent to add HTTP tools.</p>
      </section>
    );
  }

  async function handleCreate(event) {
    event.preventDefault();
    setError("");
    let argumentSchema;
    try {
      argumentSchema = JSON.parse(form.argument_schema);
    } catch {
      setError("argument_schema must be valid JSON");
      return;
    }
    setBusy(true);
    try {
      await createTool(agent.id, {
        name: form.name.trim(),
        description: form.description.trim(),
        method: form.method,
        url: form.url.trim(),
        argument_schema: argumentSchema,
      });
      setForm(emptyForm);
      await refresh(agent.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(toolId) {
    setError("");
    try {
      await deleteTool(agent.id, toolId);
      await refresh(agent.id);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="panel tools-panel">
      <h2>Tools</h2>
      <p className="muted">{agent.name} — system tools are always on.</p>

      <ul className="tool-list">
        {systemTools.map((item) => (
          <li key={item.name} className="tool-item">
            <strong>{item.name}</strong>
            <span className="muted"> system</span>
            <p className="prompt">{item.description}</p>
          </li>
        ))}
        {tools.map((item) => (
          <li key={item.id} className="tool-item">
            <div className="tool-item-head">
              <div>
                <strong>{item.name}</strong>
                <p className="muted">
                  {item.method} {item.url}
                </p>
              </div>
              <button type="button" className="ghost" onClick={() => handleDelete(item.id)}>
                Delete
              </button>
            </div>
            <p className="prompt">{item.description}</p>
          </li>
        ))}
      </ul>

      <h3>Add HTTP tool</h3>
      <form className="stack" onSubmit={handleCreate}>
        <label className="field">
          <span>Name</span>
          <input
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            placeholder="get_weather"
            required
          />
        </label>
        <label className="field">
          <span>Description</span>
          <textarea
            rows={3}
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
            placeholder="Fetch weather for a city. Use when the user asks about weather."
            required
          />
        </label>
        <label className="field">
          <span>Method</span>
          <select
            value={form.method}
            onChange={(event) => setForm({ ...form, method: event.target.value })}
          >
            <option value="GET">GET</option>
            <option value="POST">POST</option>
          </select>
        </label>
        <label className="field">
          <span>URL</span>
          <input
            value={form.url}
            onChange={(event) => setForm({ ...form, url: event.target.value })}
            placeholder="https://wttr.in/{city}?format=3"
            required
          />
        </label>
        <label className="field">
          <span>Argument schema (JSON)</span>
          <textarea
            rows={5}
            value={form.argument_schema}
            onChange={(event) => setForm({ ...form, argument_schema: event.target.value })}
            required
          />
        </label>
        {error ? <p className="error">{error}</p> : null}
        <button className="primary" type="submit" disabled={busy}>
          {busy ? "Saving" : "Add tool"}
        </button>
      </form>
    </section>
  );
}
