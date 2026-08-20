import { Fragment, useEffect, useRef, useState } from "react";
import { sendChat } from "../api";

export default function ChatPanel({ agent }) {
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [toolEvents, setToolEvents] = useState([]);
  const bottomRef = useRef(null);

  useEffect(() => {
    setConversationId(null);
    setMessages([]);
    setDraft("");
    setError("");
    setToolEvents([]);
  }, [agent?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  if (!agent) {
    return (
      <section className="panel chat-panel">
        <h2>Chat</h2>
        <p className="muted">Select an agent from the list to start chatting.</p>
      </section>
    );
  }

  async function handleSend(event) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || busy) {
      return;
    }
    setBusy(true);
    setError("");
    setDraft("");
    try {
      const payload = { message: text };
      if (conversationId) {
        payload.conversation_id = conversationId;
      }
      const result = await sendChat(agent.id, payload);
      setConversationId(result.conversation_id);
      setMessages(result.messages);
      setToolEvents(result.tool_events || []);
    } catch (err) {
      setError(err.message);
      setDraft(text);
    } finally {
      setBusy(false);
    }
  }

  function handleNewConversation() {
    setConversationId(null);
    setMessages([]);
    setError("");
    setToolEvents([]);
  }

  return (
    <section className="panel chat-panel">
      <div className="chat-header">
        <div>
          <h2>Chat</h2>
          <p className="muted">
            {agent.name}
            {conversationId ? ` / conversation ${conversationId}` : ""}
          </p>
        </div>
        <button type="button" className="ghost" onClick={handleNewConversation}>
          New conversation
        </button>
      </div>

      <div className="chat-log">
        {messages.length === 0 && !busy ? (
          <p className="muted">Send a message to start this conversation.</p>
        ) : null}
        {messages.map((item, index) => (
          <Fragment key={item.id}>
            {item.role === "assistant" && index === messages.length - 1
              ? toolEvents.map((event, eventIndex) => (
                  <div key={`${event.name}-${eventIndex}`} className="bubble bubble-tool">
                    <span className="bubble-role">tool {event.name}</span>
                    <p>{event.content}</p>
                  </div>
                ))
              : null}
            <div className={`bubble bubble-${item.role}`}>
              <span className="bubble-role">{item.role}</span>
              <p>{item.content}</p>
            </div>
          </Fragment>
        ))}
        {busy ? <p className="muted">Waiting for the model...</p> : null}
        <div ref={bottomRef} />
      </div>

      <form className="chat-form" onSubmit={handleSend}>
        {error ? <p className="error">{error}</p> : null}
        <textarea
          rows={3}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          placeholder="Type a message"
          disabled={busy}
        />
        <button className="primary" type="submit" disabled={busy || !draft.trim()}>
          {busy ? "Sending" : "Send"}
        </button>
      </form>
    </section>
  );
}
