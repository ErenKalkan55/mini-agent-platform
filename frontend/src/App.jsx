import { useEffect, useState } from "react";
import { clearToken, getToken, me } from "./api";
import AgentsPage from "./pages/Agents";
import LoginPage from "./pages/Login";

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(getToken()));

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    me()
      .then(setUser)
      .catch(() => {
        clearToken();
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="boot">Loading...</div>;
  }

  if (!user) {
    return <LoginPage onLoggedIn={setUser} />;
  }

  return (
    <AgentsPage
      user={user}
      onLogout={() => {
        clearToken();
        setUser(null);
      }}
    />
  );
}
