import { useLocation, Link } from "react-router-dom";
import { useAuth } from "./context/AuthContext";

const tabs = [
  {
    label: "Home",
    path: "/",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" />
        <polyline points="9 21 9 12 15 12 15 21" />
      </svg>
    ),
  },
  {
    label: "Players",
    path: "/players",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="14" width="4" height="7" rx="1" />
        <rect x="9" y="9" width="4" height="12" rx="1" />
        <rect x="16" y="4" width="4" height="17" rx="1" />
      </svg>
    ),
  },
  {
    label: "History",
    path: "/history",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <polyline points="12 7 12 12 15 15" />
      </svg>
    ),
  },
];

const SignOutIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

export default function BottomNav() {
  const location           = useLocation();
  const { group, signOut } = useAuth();

  return (
    <>
      <style>{`
        @keyframes bn-pulse { 0%,100%{opacity:1} 50%{opacity:.5} }
        .bn-tab { -webkit-tap-highlight-color: transparent; }
        .bn-tab:active { opacity: 0.7; transform: scale(0.95); }
        .bn-signout:active { opacity: 0.7; }
      `}</style>

      {/* Group invite banner */}
      {group && (
        <div style={{
          position: "fixed", bottom: 64, left: 0, right: 0, height: 28,
          background: "rgba(10,12,16,0.97)",
          borderTop: "1px solid rgba(255,255,255,0.05)",
          display: "flex", alignItems: "center", justifyContent: "center",
          gap: 10, zIndex: 999,
          backdropFilter: "blur(12px)",
        }}>
          {/* Live dot */}
          <span style={{
            width: 5, height: 5, borderRadius: "50%",
            background: "#00e5a0",
            animation: "bn-pulse 2.5s ease-in-out infinite",
            flexShrink: 0,
          }} />
          <span style={{
            fontSize: 10, color: "rgba(255,255,255,0.3)",
            letterSpacing: "0.12em", textTransform: "uppercase",
            fontFamily: "'DM Mono', 'Courier New', monospace",
          }}>
            {group.name}
          </span>
          <span style={{ color: "rgba(255,255,255,0.12)", fontSize: 10 }}>·</span>
          <span style={{
            fontSize: 10, color: "rgba(255,255,255,0.2)",
            fontFamily: "'DM Mono', 'Courier New', monospace",
            letterSpacing: "0.15em",
          }}>
            {group.invite_code}
          </span>
        </div>
      )}

      {/* Nav bar */}
      <nav style={{
        position: "fixed", bottom: 0, left: 0, right: 0, height: 64,
        background: "rgba(10,12,16,0.97)",
        borderTop: "1px solid rgba(255,255,255,0.07)",
        display: "flex", alignItems: "stretch",
        zIndex: 1000,
        backdropFilter: "blur(20px)",
        boxShadow: "0 -1px 0 rgba(255,255,255,0.04), 0 -12px 32px rgba(0,0,0,0.6)",
      }}>
        {tabs.map(tab => {
          const isActive = tab.path === "/"
            ? location.pathname === "/"
            : location.pathname.startsWith(tab.path);
          return (
            <Link
              key={tab.path}
              to={tab.path}
              className="bn-tab"
              style={{
                flex: 1,
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                gap: 3, textDecoration: "none",
                color: isActive ? "#00e5a0" : "rgba(255,255,255,0.28)",
                position: "relative",
                transition: "color 0.2s ease",
              }}
            >
              {/* Active indicator pill at top */}
              <span style={{
                position: "absolute", top: 0, left: "50%",
                transform: "translateX(-50%)",
                width: isActive ? 28 : 0,
                height: 2,
                background: "#00e5a0",
                borderRadius: "0 0 3px 3px",
                boxShadow: isActive ? "0 0 10px rgba(0,229,160,0.6)" : "none",
                transition: "width 0.25s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.25s ease",
              }} />

              <span style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "transform 0.2s cubic-bezier(0.34,1.56,0.64,1)",
                transform: isActive ? "translateY(-1px) scale(1.08)" : "translateY(0) scale(1)",
              }}>
                {tab.icon}
              </span>
              <span style={{
                fontSize: 10, fontWeight: isActive ? 600 : 400,
                letterSpacing: "0.04em", lineHeight: 1,
                fontFamily: "'DM Sans', system-ui, sans-serif",
              }}>
                {tab.label}
              </span>
            </Link>
          );
        })}

        {/* Sign out */}
        <button
          onClick={signOut}
          className="bn-signout"
          style={{
            flex: 1, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 3,
            background: "transparent", border: "none",
            color: "rgba(255,255,255,0.28)",
            cursor: "pointer",
            transition: "color 0.2s ease",
            WebkitTapHighlightColor: "transparent",
            fontFamily: "inherit",
          }}
          onMouseEnter={e => (e.currentTarget.style.color = "#ff4d6d")}
          onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.28)")}
        >
          <span style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
            <SignOutIcon />
          </span>
          <span style={{
            fontSize: 10, fontWeight: 400, letterSpacing: "0.04em", lineHeight: 1,
            fontFamily: "'DM Sans', system-ui, sans-serif",
          }}>
            Sign Out
          </span>
        </button>
      </nav>
    </>
  );
}
