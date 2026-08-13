import { useState } from "react";
import { login, me, register, setToken } from "../api";

export default function LoginPage({ onLoggedIn }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "register") {
        await register({
          email,
          password,
          tenant_name: tenantName,
        });
      }
      const token = await login({ email, password });
      setToken(token.access_token);
      const user = await me();
      onLoggedIn(user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-frame">
        <form className="auth-card" onSubmit={handleSubmit}>
          <p className="brand">MINI AGENT PLATFORM</p>
          <h1>{mode === "login" ? "Sign Into Your Account" : "Create Your Account"}</h1>
          <p className="subtitle">
            {mode === "login"
              ? "Welcome back. Please enter your credentials."
              : "Register a tenant and start managing agents."}
          </p>

          {mode === "register" ? (
            <label className="field">
              <span>Tenant name</span>
              <input
                value={tenantName}
                onChange={(event) => setTenantName(event.target.value)}
                required
                minLength={2}
              />
            </label>
          ) : null}

          <label className="field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label className="field">
            <span>Password</span>
            <div className="password-row">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={8}
              />
              <button
                type="button"
                className="ghost"
                onClick={() => setShowPassword((value) => !value)}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </label>

          {error ? <p className="error">{error}</p> : null}

          <button className="primary" type="submit" disabled={busy}>
            {busy ? "Please wait" : mode === "login" ? "Sign in" : "Create account"}
          </button>

          <button
            type="button"
            className="linkish"
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError("");
            }}
          >
            {mode === "login" ? "Need an account? Register" : "Already have an account? Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
