import { useOutletContext } from "react-router-dom";
import { useEffect, useState } from "react";
import { createTool, deleteTool, listSystemTools, listTools, updateAgent } from "../api";

const emptyArg = { name: "", type: "string", required: false, description: "" };

const emptyForm = {
  name: "",
  description: "",
  method: "GET",
  url: "",
};

function schemaFromArgs(rows) {
  const properties = {};
  const required = [];
  for (const row of rows) {
    const name = row.name.trim();
    if (!name) {
      continue;
    }
    properties[name] = {
      type: row.type,
      description: row.description.trim() || name,
    };
    if (row.required) {
      required.push(name);
    }
  }
  return { type: "object", properties, required };
}

export default function ToolsPanel() {
  const { selectedAgent: agent, upsertAgent } = useOutletContext();
  const [systemTools, setSystemTools] = useState([]);
  const [tools, setTools] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [args, setArgs] = useState([]);
  const [showJson, setShowJson] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmingId, setConfirmingId] = useState(null);

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
      setDrawerOpen(false);
      return;
    }
    refresh(agent.id).catch((err) => setError(err.message));
  }, [agent?.id]);

  if (!agent) {
    return (
      <section className="panel">
        <div className="empty-state">
          <p className="empty-title">Select an agent</p>
          <p className="muted">Open an agent from the Agents page to add HTTP tools.</p>
        </div>
      </section>
    );
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setForm(emptyForm);
    setArgs([]);
    setShowJson(false);
    setError("");
  }

  async function handleCreate(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await createTool(agent.id, {
        name: form.name.trim(),
        description: form.description.trim(),
        method: form.method,
        url: form.url.trim(),
        argument_schema: schemaFromArgs(args),
      });
      closeDrawer();
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
      setConfirmingId(null);
      await refresh(agent.id);
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggleSystemTool(name) {
    if (!agent) {
      return;
    }
    const current = agent.system_tools || [];
    const next = current.includes(name)
      ? current.filter((item) => item !== name)
      : [...current, name];
    setError("");
    try {
      const updated = await updateAgent(agent.id, { system_tools: next });
      upsertAgent(updated);
    } catch (err) {
      setError(err.message);
    }
  }

  function updateArg(index, patch) {
    setArgs((rows) => rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  }

  const preview = JSON.stringify(schemaFromArgs(args), null, 2);

  return (
    <div className="tools-page">
      <section>
        <div className="section-head">
          <div>
            <p className="stat-label">Selected</p>
            <h2>System tools</h2>
          </div>
        </div>
        <ul className="tool-grid">
          {systemTools.map((item) => {
            const enabled = (agent.system_tools || []).includes(item.name);
            return (
              <li key={item.name} className="entity-card">
                <div className="entity-card-top">
                  <span className="entity-mark">S</span>
                  <span className={enabled ? "badge badge-ok" : "badge"}>
                    {enabled ? "On" : "Off"}
                  </span>
                </div>
                <h3>{item.name}</h3>
                <p className="muted prompt-preview">{item.description}</p>
                <div className="entity-card-actions">
                  <button type="button" className="ghost" onClick={() => toggleSystemTool(item.name)}>
                    {enabled ? "Disable" : "Enable"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <div className="section-head">
          <div>
            <p className="stat-label">Custom</p>
            <h2>HTTP tools</h2>
          </div>
          <button type="button" className="primary" onClick={() => setDrawerOpen(true)}>
            Add HTTP tool
          </button>
        </div>
        {tools.length === 0 ? (
          <div className="panel">
            <div className="empty-state">
              <p className="empty-title">No HTTP tools yet</p>
              <p className="muted">Add one when this agent needs to call an external API.</p>
            </div>
          </div>
        ) : (
          <ul className="tool-grid">
            {tools.map((item) => (
              <li key={item.id} className="entity-card">
                <div className="entity-card-top">
                  <span className="entity-mark">{item.method.slice(0, 1)}</span>
                  <span className="badge badge-accent">{item.method}</span>
                </div>
                <h3>{item.name}</h3>
                <p className="muted prompt-preview">{item.description}</p>
                <p className="entity-meta">{item.url}</p>
                <div className="entity-card-actions">
                  {confirmingId === item.id ? (
                    <>
                      <span className="muted">Delete this tool?</span>
                      <button type="button" className="ghost ghost-danger" onClick={() => handleDelete(item.id)}>
                        Confirm
                      </button>
                      <button type="button" className="ghost" onClick={() => setConfirmingId(null)}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button type="button" className="ghost ghost-danger" onClick={() => setConfirmingId(item.id)}>
                      Delete
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {drawerOpen ? (
        <div className="drawer-root">
          <button type="button" className="drawer-mask" aria-label="Close" onClick={closeDrawer} />
          <aside className="drawer">
            <div className="drawer-head">
              <div>
                <p className="stat-label">New capability</p>
                <h2>Add HTTP tool</h2>
              </div>
              <button type="button" className="ghost" onClick={closeDrawer}>
                Close
              </button>
            </div>
            <form className="drawer-body stack" onSubmit={handleCreate}>
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
                <p className="field-hint">
                  Use {"{city}"} in the path to map an argument. Local URLs are blocked.
                </p>
              </label>
              <div className="field">
                <span>Arguments</span>
                {args.map((row, index) => (
                  <div key={index} className="arg-row">
                    <input
                      value={row.name}
                      onChange={(event) => updateArg(index, { name: event.target.value })}
                      placeholder="name"
                      required
                    />
                    <select
                      value={row.type}
                      onChange={(event) => updateArg(index, { type: event.target.value })}
                    >
                      <option value="string">string</option>
                      <option value="integer">integer</option>
                      <option value="number">number</option>
                      <option value="boolean">boolean</option>
                    </select>
                    <label className="arg-check">
                      <input
                        type="checkbox"
                        checked={row.required}
                        onChange={(event) => updateArg(index, { required: event.target.checked })}
                      />
                      Required
                    </label>
                    <button
                      type="button"
                      className="ghost ghost-danger"
                      onClick={() => setArgs((rows) => rows.filter((_, rowIndex) => rowIndex !== index))}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="ghost"
                  onClick={() => setArgs((rows) => [...rows, { ...emptyArg }])}
                >
                  Add argument
                </button>
                <button type="button" className="linkish" onClick={() => setShowJson((value) => !value)}>
                  {showJson ? "Hide JSON" : "Show JSON"}
                </button>
                {showJson ? <pre className="json-preview">{preview}</pre> : null}
              </div>
              {error ? <p className="error">{error}</p> : null}
              <div className="drawer-foot">
                <button type="button" className="ghost" onClick={closeDrawer}>
                  Cancel
                </button>
                <button className="primary" type="submit" disabled={busy}>
                  {busy ? "Saving" : "Save tool"}
                </button>
              </div>
            </form>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
