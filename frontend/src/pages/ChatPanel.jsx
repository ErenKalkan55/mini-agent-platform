import { useOutletContext } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { listConversations, listMessages, sendChat } from "../api";

export default function ChatPanel() {
  const { selectedAgent: agent } = useOutletContext();
  const [conversationId, setConversationId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef(null);

  async function refreshConversations(agentId) {
    const data = await listConversations(agentId);
    setConversations(data);
  }

  useEffect(() => {
    setConversationId(null);
    setConversations([]);
    setMessages([]);
    setDraft("");
    setError("");
    if (!agent) {
      return;
    }
    refreshConversations(agent.id).catch((err) => setError(err.message));
  }, [agent?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  if (!agent) {
    return (
      <section className="panel">
        <div className="empty-state">
          <p className="empty-title">Select an agent</p>
          <p className="muted">Open an agent from the Agents page, then start a conversation.</p>
        </div>
      </section>
    );
  }

  async function openConversation(id) {
    setError("");
    setBusy(true);
    try {
      const data = await listMessages(agent.id, id);
      setConversationId(id);
      setMessages(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleSend(event) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || busy) {
      return;
    }
    const optimistic = { id: `tmp-${Date.now()}`, role: "user", content: text };
    setBusy(true);
    setError("");
    setDraft("");
    setMessages((prev) => [...prev, optimistic]);
    try {
      const payload = { message: text };
      if (conversationId) {
        payload.conversation_id = conversationId;
      }
      const result = await sendChat(agent.id, payload);
      setConversationId(result.conversation_id);
      setMessages(result.messages);
      await refreshConversations(agent.id);
    } catch (err) {
      setError(err.message);
      setDraft(text);
      setMessages((prev) => prev.filter((item) => item.id !== optimistic.id));
    } finally {
      setBusy(false);
    }
  }

  function handleNewConversation() {
    setConversationId(null);
    setMessages([]);
    setError("");
  }

  return (
    <section className="panel chat-shell">
      <aside className="chat-threads">
        <div className="chat-threads-head">
          <p className="stat-label">Conversations</p>
          <button type="button" className="ghost" onClick={handleNewConversation}>
            New
          </button>
        </div>
        {conversations.length > 0 ? (
          <ul className="conversation-list">
            {conversations.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={
                    item.id === conversationId
                      ? "conversation-btn conversation-btn-active"
                      : "conversation-btn"
                  }
                  onClick={() => openConversation(item.id)}
                  disabled={busy}
                >
                  <span className="conversation-title">{item.preview}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted chat-threads-empty">No conversations yet.</p>
        )}
      </aside>

      <div className="chat-stage">
        <div className="chat-stage-head">
          <p className="chat-agent-name">{agent.name}</p>
          <p className="muted">{conversationId ? "Saved conversation" : "New conversation"}</p>
        </div>

        <div className="chat-log">
          {messages.length === 0 && !busy ? (
            <div className="empty-state chat-empty">
              <p className="empty-title">Send a message</p>
              <p className="muted">This agent uses its system prompt and tools to answer.</p>
            </div>
          ) : null}
          {messages.map((item) =>
            item.role === "tool" ? (
              <details key={item.id} className="tool-trace">
                <summary>{item.tool_name || "tool"}</summary>
                <p>{item.content}</p>
              </details>
            ) : (
              <div key={item.id} className={`bubble bubble-${item.role}`}>
                <p>{item.content}</p>
                {item.role === "assistant" && item.prompt_tokens != null ? (
                  <p className="muted token-meta">
                    {item.prompt_tokens} / {item.completion_tokens ?? 0} tokens
                  </p>
                ) : null}
              </div>
            ),
          )}
          {busy ? (
            <div className="bubble bubble-assistant">
              <span className="typing" aria-label="Waiting for the model">
                <span />
                <span />
                <span />
              </span>
            </div>
          ) : null}
          <div ref={bottomRef} />
        </div>

        <form className="chat-form" onSubmit={handleSend}>
          {error ? <p className="error">{error}</p> : null}
          <div className="composer">
            <textarea
              rows={1}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder="Message"
              disabled={busy}
            />
            <button className="primary" type="submit" disabled={busy || !draft.trim()}>
              {busy ? "Sending" : "Send"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
