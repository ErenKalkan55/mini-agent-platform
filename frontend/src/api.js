const TOKEN_KEY = "access_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request(path, { method = "GET", body, auth = false } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const token = getToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  const response = await fetch(path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 204) {
    return null;
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = data.detail;
    const message =
      typeof detail === "string"
        ? detail
        : Array.isArray(detail)
          ? detail.map((item) => item.msg).join(", ")
          : "Request failed";
    throw new Error(message);
  }
  return data;
}

export function register(payload) {
  return request("/api/v1/auth/register", { method: "POST", body: payload });
}

export function login(payload) {
  return request("/api/v1/auth/login", { method: "POST", body: payload });
}

export function me() {
  return request("/api/v1/auth/me", { auth: true });
}

export function listAgents() {
  return request("/api/v1/agents", { auth: true });
}

export function createAgent(payload) {
  return request("/api/v1/agents", { method: "POST", body: payload, auth: true });
}

export function updateAgent(agentId, payload) {
  return request(`/api/v1/agents/${agentId}`, {
    method: "PATCH",
    body: payload,
    auth: true,
  });
}

export function deleteAgent(agentId) {
  return request(`/api/v1/agents/${agentId}`, { method: "DELETE", auth: true });
}

export function sendChat(agentId, payload) {
  return request(`/api/v1/agents/${agentId}/chat`, {
    method: "POST",
    body: payload,
    auth: true,
  });
}

export function listConversations(agentId) {
  return request(`/api/v1/agents/${agentId}/conversations`, { auth: true });
}

export function listMessages(agentId, conversationId) {
  return request(
    `/api/v1/agents/${agentId}/conversations/${conversationId}/messages`,
    { auth: true },
  );
}

export function listSystemTools() {
  return request("/api/v1/system-tools", { auth: true });
}

export function listTools(agentId) {
  return request(`/api/v1/agents/${agentId}/tools`, { auth: true });
}

export function createTool(agentId, payload) {
  return request(`/api/v1/agents/${agentId}/tools`, {
    method: "POST",
    body: payload,
    auth: true,
  });
}

export function deleteTool(agentId, toolId) {
  return request(`/api/v1/agents/${agentId}/tools/${toolId}`, {
    method: "DELETE",
    auth: true,
  });
}
