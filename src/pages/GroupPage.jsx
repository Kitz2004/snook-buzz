import { useState } from "react";
import { useAuth } from "../context/AuthContext";

const T = {
  bg:        "#0a0c10",
  surface:   "#111318",
  card:      "#161920",
  border:    "#1e2330",
  borderHi:  "#2a3045",
  green:     "#00e5a0",
  greenGlow: "rgba(0,229,160,0.15)",
  red:       "#ff4d6d",
  textPrim:  "#f0f4ff",
  textSec:   "#8892a4",
  textMuted: "#4a5568",
  radius:    "12px",
  radiusSm:  "8px",
};

const inputStyle = {
  width: "100%", boxSizing: "border-box",
  background: T.bg, border: `1px solid ${T.border}`,
  borderRadius: T.radiusSm, padding: "12px 14px",
  color: T.textPrim, fontSize: 15, outline: "none",
  fontFamily: "inherit", transition: "border-color 0.2s",
};

const labelStyle = {
  fontSize: 11, fontWeight: 700, letterSpacing: "0.1em",
  textTransform: "uppercase", color: T.textSec,
  display: "block", marginBottom: 6,
};

export default function GroupPage() {
  const { createGroup, joinGroup, signOut, session } = useAuth();

  const [tab,       setTab]       = useState("create"); // "create" | "join"
  const [groupName, setGroupName] = useState("");
  const [code,      setCode]      = useState("");
  const [error,     setError]     = useState("");
  const [loading,   setLoading]   = useState(false);

  const handleCreate = async e => {
    e.preventDefault();
    if (!groupName.trim()) return;
    setError(""); setLoading(true);
    const { error } = await createGroup(groupName.trim());
    if (error) setError(error.message);
    setLoading(false);
  };

  const handleJoin = async e => {
    e.preventDefault();
    if (!code.trim()) return;
    setError(""); setLoading(true);
    const { error } = await joinGroup(code.trim());
    if (error) setError(error.message);
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: "100vh", background: T.bg,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "24px 16px",
      fontFamily: "'DM Sans','Segoe UI',sans-serif", color: T.textPrim,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; }
        input::placeholder { color: #3a4255; }
      `}</style>

      <div style={{ width: "100%", maxWidth: 420 }}>

        {/* Brand */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 10,
            background: T.surface, borderRadius: 999, padding: "8px 20px",
            border: `1px solid ${T.border}`, marginBottom: 16,
          }}>
            <span style={{ fontSize: 20 }}>🔴</span>
            <span style={{ fontWeight: 800, letterSpacing: "0.12em", fontSize: 13, color: T.green, textTransform: "uppercase" }}>
              Snook Buzz
            </span>
          </div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, letterSpacing: "-0.03em" }}>
            Set up your group
          </h1>
          <p style={{ margin: "8px 0 0", color: T.textSec, fontSize: 14 }}>
            Signed in as {session?.user?.email}
          </p>
        </div>

        {/* Tab switcher */}
        <div style={{
          display: "flex", gap: 3, marginBottom: 20,
          background: "rgba(255,255,255,0.03)",
          border: `1px solid ${T.border}`,
          borderRadius: 10, padding: 4,
        }}>
          {[["create", "Create Group"], ["join", "Join Group"]].map(([key, label]) => (
            <button
              key={key}
              onClick={() => { setTab(key); setError(""); }}
              style={{
                flex: 1, padding: "9px 0", borderRadius: 7, border: "none",
                cursor: "pointer", fontFamily: "inherit",
                fontSize: 13, fontWeight: 700, letterSpacing: "0.06em",
                textTransform: "uppercase", transition: "all 0.18s",
                background: tab === key ? T.green : "transparent",
                color:      tab === key ? "#000"  : T.textSec,
                boxShadow:  tab === key ? `0 2px 14px ${T.greenGlow}` : "none",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Card */}
        <div style={{
          background: T.card, border: `1px solid ${T.border}`,
          borderRadius: 16, padding: 24, boxShadow: "0 4px 40px rgba(0,0,0,0.5)",
        }}>

          {tab === "create" ? (
            <form onSubmit={handleCreate}>
              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>Group Name</label>
                <input
                  type="text" required
                  placeholder="e.g. The Cue Club"
                  value={groupName} onChange={e => setGroupName(e.target.value)}
                  style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = T.green)}
                  onBlur={e  => (e.target.style.borderColor = T.border)}
                />
              </div>

              <div style={{
                background: T.surface, border: `1px solid ${T.border}`,
                borderRadius: T.radiusSm, padding: "12px 14px",
                fontSize: 13, color: T.textSec, lineHeight: 1.6, marginBottom: 20,
              }}>
                Creating a group generates an <strong style={{ color: T.textPrim }}>invite code</strong> you can share with friends so they can join the same group.
              </div>

              {error && (
                <div style={{
                  background: "rgba(255,77,109,0.1)", border: `1px solid rgba(255,77,109,0.3)`,
                  borderRadius: T.radiusSm, padding: "10px 14px",
                  color: T.red, fontSize: 13, marginBottom: 16, fontWeight: 500,
                }}>
                  {error}
                </div>
              )}

              <button
                type="submit" disabled={loading}
                style={{
                  width: "100%", padding: "14px", borderRadius: T.radius,
                  background: loading ? T.surface : T.green,
                  border: loading ? `1px solid ${T.border}` : "none",
                  color: loading ? T.textMuted : "#000",
                  fontWeight: 800, fontSize: 15, cursor: loading ? "not-allowed" : "pointer",
                  fontFamily: "inherit", transition: "all 0.2s",
                  boxShadow: loading ? "none" : `0 0 24px ${T.greenGlow}`,
                }}
              >
                {loading ? "Creating…" : "Create Group"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleJoin}>
              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>Invite Code</label>
                <input
                  type="text" required
                  placeholder="Enter 8-character code"
                  value={code} onChange={e => setCode(e.target.value)}
                  style={{ ...inputStyle, textTransform: "lowercase", letterSpacing: "0.08em", fontSize: 16 }}
                  onFocus={e => (e.target.style.borderColor = T.green)}
                  onBlur={e  => (e.target.style.borderColor = T.border)}
                />
              </div>

              <div style={{
                background: T.surface, border: `1px solid ${T.border}`,
                borderRadius: T.radiusSm, padding: "12px 14px",
                fontSize: 13, color: T.textSec, lineHeight: 1.6, marginBottom: 20,
              }}>
                Ask the person who created your group for the invite code. You'll find it in the app settings once you're in.
              </div>

              {error && (
                <div style={{
                  background: "rgba(255,77,109,0.1)", border: `1px solid rgba(255,77,109,0.3)`,
                  borderRadius: T.radiusSm, padding: "10px 14px",
                  color: T.red, fontSize: 13, marginBottom: 16, fontWeight: 500,
                }}>
                  {error}
                </div>
              )}

              <button
                type="submit" disabled={loading}
                style={{
                  width: "100%", padding: "14px", borderRadius: T.radius,
                  background: loading ? T.surface : T.green,
                  border: loading ? `1px solid ${T.border}` : "none",
                  color: loading ? T.textMuted : "#000",
                  fontWeight: 800, fontSize: 15, cursor: loading ? "not-allowed" : "pointer",
                  fontFamily: "inherit", transition: "all 0.2s",
                  boxShadow: loading ? "none" : `0 0 24px ${T.greenGlow}`,
                }}
              >
                {loading ? "Joining…" : "Join Group"}
              </button>
            </form>
          )}
        </div>

        {/* Sign out */}
        <p style={{ textAlign: "center", marginTop: 20 }}>
          <button
            onClick={signOut}
            style={{
              background: "none", border: "none", color: T.textMuted,
              fontSize: 13, cursor: "pointer", fontFamily: "inherit",
            }}
          >
            Sign out
          </button>
        </p>
      </div>
    </div>
  );
}
