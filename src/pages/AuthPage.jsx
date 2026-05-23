import { useState } from "react";
import { useAuth } from "../context/AuthContext";

const T = {
  bg:       "#0a0c10",
  surface:  "#111318",
  card:     "#161920",
  border:   "#1e2330",
  green:    "#00e5a0",
  greenGlow:"rgba(0,229,160,0.15)",
  red:      "#ff4d6d",
  textPrim: "#f0f4ff",
  textSec:  "#8892a4",
  textMuted:"#4a5568",
  radius:   "12px",
  radiusSm: "8px",
};

export default function AuthPage() {
  const { signIn, signUp } = useAuth();
  const [mode,     setMode]     = useState("login");   // "login" | "signup"
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [done,     setDone]     = useState(false);     // signup success message

  const handle = async e => {
    e.preventDefault();
    setError(""); setLoading(true);

    if (mode === "login") {
      const { error } = await signIn(email, password);
      if (error) setError(error.message);
    } else {
      const { error } = await signUp(email, password);
      if (error) setError(error.message);
      else       setDone(true);
    }
    setLoading(false);
  };

  const inputStyle = {
    width: "100%", boxSizing: "border-box",
    background: T.bg, border: `1px solid ${T.border}`,
    borderRadius: T.radiusSm, padding: "12px 14px",
    color: T.textPrim, fontSize: 15, outline: "none",
    fontFamily: "inherit", transition: "border-color 0.2s",
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

      <div style={{ width: "100%", maxWidth: 400 }}>

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
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, letterSpacing: "-0.03em" }}>
            {mode === "login" ? "Welcome back" : "Create account"}
          </h1>
          <p style={{ margin: "8px 0 0", color: T.textSec, fontSize: 14 }}>
            {mode === "login" ? "Sign in to your Snook Buzz account" : "Sign up to start tracking matches"}
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: T.card, border: `1px solid ${T.border}`,
          borderRadius: 16, padding: 24, boxShadow: "0 4px 40px rgba(0,0,0,0.5)",
        }}>
          {done ? (
            /* Signup success */
            <div style={{ textAlign: "center", padding: "16px 0" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
              <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>Account created!</div>
              <div style={{ color: T.textSec, fontSize: 14, lineHeight: 1.6 }}>
                You can now sign in with your email and password.
              </div>
              <button
                onClick={() => { setDone(false); setMode("login"); }}
                style={{
                  marginTop: 20, width: "100%", padding: "13px",
                  borderRadius: T.radius, background: T.green, border: "none",
                  color: "#000", fontWeight: 700, fontSize: 14,
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >
                Go to Sign In
              </button>
            </div>
          ) : (
            <form onSubmit={handle}>
              {/* Email */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: T.textSec, display: "block", marginBottom: 6 }}>
                  Email
                </label>
                <input
                  type="email" required
                  placeholder="you@example.com"
                  value={email} onChange={e => setEmail(e.target.value)}
                  style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = T.green)}
                  onBlur={e  => (e.target.style.borderColor = T.border)}
                />
              </div>

              {/* Password */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: T.textSec, display: "block", marginBottom: 6 }}>
                  Password
                </label>
                <input
                  type="password" required minLength={6}
                  placeholder="Min. 6 characters"
                  value={password} onChange={e => setPassword(e.target.value)}
                  style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = T.green)}
                  onBlur={e  => (e.target.style.borderColor = T.border)}
                />
              </div>

              {/* Error */}
              {error && (
                <div style={{
                  background: "rgba(255,77,109,0.1)", border: `1px solid rgba(255,77,109,0.3)`,
                  borderRadius: T.radiusSm, padding: "10px 14px",
                  color: T.red, fontSize: 13, marginBottom: 16, fontWeight: 500,
                }}>
                  {error}
                </div>
              )}

              {/* Submit */}
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
                {loading ? "Please wait…" : mode === "login" ? "Sign In" : "Create Account"}
              </button>
            </form>
          )}
        </div>

        {/* Toggle mode */}
        {!done && (
          <p style={{ textAlign: "center", marginTop: 20, fontSize: 14, color: T.textSec }}>
            {mode === "login" ? "Don't have an account? " : "Already have an account? "}
            <button
              onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); }}
              style={{
                background: "none", border: "none", color: T.green,
                fontWeight: 700, cursor: "pointer", fontSize: 14, fontFamily: "inherit",
                padding: 0,
              }}
            >
              {mode === "login" ? "Sign Up" : "Sign In"}
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
