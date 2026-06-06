import { useState, useEffect, useCallback } from "react";
import { supabase } from "../supabase.js";
import { useAuth } from "../context/AuthContext";

const REFRESH_INTERVAL = 30000;

// ─── THEME ────────────────────────────────────────────────────────────────────
const T = {
  bg:        "#090b0f",
  surface:   "#0f1218",
  card:      "#141820",
  border:    "rgba(255,255,255,0.06)",
  borderHi:  "rgba(255,255,255,0.11)",
  green:     "#00e5a0",
  greenGlow: "rgba(0,229,160,0.12)",
  greenDim:  "#00b87e",
  red:       "#ff4d6d",
  gold:      "#ffc53d",
  silver:    "#b4bcc8",
  bronze:    "#cd7f4e",
  text:      "#edf1f7",
  textSec:   "#7c8799",
  textMuted: "#4a5263",
  textFaint: "#2e3545",
  winText:   "#00e5a0",
  winBg:     "rgba(0,229,160,0.08)",
  lossText:  "#ff4d6d",
  lossBg:    "rgba(255,77,109,0.08)",
};

const MEDAL = {
  0: { bg: "rgba(255,197,61,0.07)",  border: "rgba(255,197,61,0.3)",   text: "#ffc53d", emoji: "🥇" },
  1: { bg: "rgba(180,188,200,0.06)", border: "rgba(180,188,200,0.25)", text: "#b4bcc8", emoji: "🥈" },
  2: { bg: "rgba(186,120,76,0.06)",  border: "rgba(186,120,76,0.25)",  text: "#cd7f4e", emoji: "🥉" },
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const winPct = (w, t) => (!t ? "—" : (w / t * 100).toFixed(1) + "%");
const winPctColor = p => {
  if (p === "—") return T.textMuted;
  const n = parseFloat(p);
  return n >= 60 ? T.winText : n >= 40 ? "#cdd4dc" : T.lossText;
};
const streakFmt = s => {
  if (!s) return { label: "—", color: T.textMuted };
  return s > 0
    ? { label: `W${s}`,           color: T.winText  }
    : { label: `L${Math.abs(s)}`, color: T.lossText };
};
const pad2    = n => String(n).padStart(2, "0");
const fmtDate = iso => {
  const d = new Date(iso);
  return `${pad2(d.getDate())}/${pad2(d.getMonth()+1)}/${String(d.getFullYear()).slice(2)}`;
};
const winRatio = (w, t) => (!t ? 0 : w / t);

// ─── GLOBAL STYLES ────────────────────────────────────────────────────────────
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800;900&family=DM+Mono:wght@400;500;600&display=swap');

  @keyframes pulse        { 0%,100%{opacity:1} 50%{opacity:.35} }
  @keyframes dot-bounce   { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-7px)} }
  @keyframes fadeSlide    { from{opacity:0;transform:translateX(-8px)} to{opacity:1;transform:none} }
  @keyframes profileIn    { from{opacity:0;transform:translateY(18px) scale(0.97)} to{opacity:1;transform:none} }
  @keyframes shimmer      { from{background-position:200% 0} to{background-position:-200% 0} }

  .lb-cards { display:none !important; }
  .lb-table { display:block !important; }

  .profile-panel {
    margin: 40px auto !important;
    border-radius: 18px !important;
  }
  .profile-panel::-webkit-scrollbar { width: 3px; }
  .profile-panel::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius:3px; }

  .stats-grid { grid-template-columns: repeat(4,1fr) !important; }

  .lb-row { transition: background 0.15s ease; }
  .lb-row:hover td { background: rgba(0,229,160,0.03) !important; }
  .lb-card { transition: transform 0.15s ease, box-shadow 0.15s ease; }
  .lb-card:active { transform: scale(0.985); opacity: 0.85; }

  @media (max-width:599px) {
    .lb-cards  { display:flex !important; flex-direction:column; gap:8px; }
    .lb-table  { display:none !important; }
    .stats-grid { grid-template-columns: repeat(2,1fr) !important; }
    .profile-panel {
      margin: 0 !important;
      min-height: 100dvh !important;
      max-height: 100dvh !important;
      border-radius: 0 !important;
      border: none !important;
    }
    .lb-page  { padding: 20px 14px 100px !important; }
    .lb-title { font-size: 26px !important; }
  }
`;

// ─── LOADING DOTS ─────────────────────────────────────────────────────────────
function LoadingDots() {
  return (
    <div style={{
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "80px 24px", gap: 18,
    }}>
      <div style={{ display: "flex", gap: 7 }}>
        {[0, 1, 2].map(i => (
          <span key={i} style={{
            width: 7, height: 7, borderRadius: "50%",
            background: T.green, display: "inline-block",
            animation: `dot-bounce 1.1s ease-in-out ${i * 0.15}s infinite`,
          }} />
        ))}
      </div>
      <span style={{
        fontSize: 10, color: T.textMuted,
        letterSpacing: "0.14em", textTransform: "uppercase",
        fontFamily: "'DM Mono', monospace",
      }}>
        Loading
      </span>
    </div>
  );
}

// ─── AVATAR ───────────────────────────────────────────────────────────────────
function Avatar({ name, size = 36, fontSize = 14 }) {
  const initials = name
    ? name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()
    : "?";
  return (
    <div style={{
      width: size, height: size,
      borderRadius: Math.round(size * 0.28),
      flexShrink: 0, userSelect: "none",
      background: `linear-gradient(145deg, ${T.greenDim}, ${T.green})`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize, fontWeight: 800, color: "#071a13",
      fontFamily: "'DM Sans', sans-serif",
      boxShadow: `0 0 0 1px rgba(0,229,160,0.2)`,
    }}>
      {initials}
    </div>
  );
}

// ─── STAT TILE ────────────────────────────────────────────────────────────────
function StatTile({ label, value, color, sub }) {
  return (
    <div style={{
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderRadius: 10, padding: "12px 14px",
      display: "flex", flexDirection: "column", gap: 3,
    }}>
      <span style={{
        fontSize: 9, color: T.textMuted, textTransform: "uppercase",
        letterSpacing: "0.14em", fontFamily: "'DM Mono', monospace",
      }}>
        {label}
      </span>
      <span style={{
        fontSize: 20, fontWeight: 700,
        color: color || T.text, lineHeight: 1.1,
        fontFamily: "'DM Mono', monospace",
      }}>
        {value ?? "—"}
      </span>
      {sub && (
        <span style={{ fontSize: 10, color: T.textFaint, fontFamily: "'DM Mono', monospace" }}>
          {sub}
        </span>
      )}
    </div>
  );
}

// ─── MATCH ROW (in profile) ───────────────────────────────────────────────────
function MatchRow({ match, index }) {
  const isWin = match.is_winner;
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "28px 1fr auto",
      gap: 10, alignItems: "center",
      padding: "10px 12px",
      background: index % 2 === 0 ? T.surface : "transparent",
      borderRadius: 8,
      borderLeft: `2px solid ${isWin ? T.winText : T.lossText}`,
      animation: "fadeSlide 0.2s ease both",
      animationDelay: `${index * 20}ms`,
    }}>
      <div style={{
        width: 24, height: 24, borderRadius: 6, flexShrink: 0,
        background: isWin ? T.winBg : T.lossBg,
        color: isWin ? T.winText : T.lossText,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontWeight: 800, fontSize: 10,
        fontFamily: "'DM Mono', monospace",
      }}>
        {isWin ? "W" : "L"}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: 600, color: T.text,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          vs {match.opponent_name || "Unknown"}
        </div>
        <div style={{ fontSize: 10, color: T.textMuted, marginTop: 2, fontFamily: "'DM Mono', monospace" }}>
          SNOOKER · {fmtDate(match.played_at)}
        </div>
      </div>
    </div>
  );
}

// ─── H2H ROW ──────────────────────────────────────────────────────────────────
function H2HRow({ name, wins, losses, index }) {
  const total = wins + losses;
  const p     = total > 0 ? ((wins / total) * 100).toFixed(0) : 0;
  const dom   = wins > losses;
  const even  = wins === losses;
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "1fr auto auto",
      gap: 12, alignItems: "center",
      padding: "9px 12px",
      background: index % 2 === 0 ? T.surface : "transparent",
      borderRadius: 8,
    }}>
      <span style={{
        fontSize: 13, fontWeight: 600, color: T.text,
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      }}>
        {name}
      </span>
      <span style={{
        fontSize: 12, color: T.textSec,
        fontFamily: "'DM Mono', monospace", whiteSpace: "nowrap",
      }}>
        <span style={{ color: T.winText }}>{wins}W</span>
        {" / "}
        <span style={{ color: T.lossText }}>{losses}L</span>
      </span>
      <span style={{
        fontSize: 11, fontWeight: 700,
        padding: "2px 8px", borderRadius: 5,
        background: dom ? T.winBg : even ? "rgba(255,255,255,0.04)" : T.lossBg,
        color: dom ? T.winText : even ? T.textMuted : T.lossText,
        whiteSpace: "nowrap",
        fontFamily: "'DM Mono', monospace",
      }}>
        {p}%
      </span>
    </div>
  );
}

// ─── SECTION LABEL ────────────────────────────────────────────────────────────
function SectionLabel({ children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
      <span style={{
        fontSize: 9, fontWeight: 700, textTransform: "uppercase",
        letterSpacing: "0.16em", color: T.textMuted,
        fontFamily: "'DM Mono', monospace",
      }}>
        {children}
      </span>
      <div style={{ flex: 1, height: 1, background: T.border }} />
    </div>
  );
}

// ─── PLAYER PROFILE OVERLAY ───────────────────────────────────────────────────
function PlayerProfile({ player, onClose }) {
  const [profile, setProfile] = useState(null);
  const [matches, setMatches] = useState([]);
  const [h2h,     setH2h]     = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    const fn = e => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);

      const { data: breakData } = await supabase
        .from("match_players")
        .select("highest_break, matches!inner(game_type)")
        .eq("player_id", player.id)
        .eq("matches.game_type", "Snooker")
      const highestBreak = breakData?.length ? Math.max(...breakData.map(b => b.highest_break)) : null;
      const breaks50  = breakData?.filter(b => b.highest_break >= 50).length  ?? 0;
      const breaks100 = breakData?.filter(b => b.highest_break >= 100).length ?? 0;

      const { data: mpData } = await supabase
        .from("match_players")
        .select(`id, match_id, is_winner, matches!inner(id, game_type, played_at)`)
        .eq("player_id", player.id)
        .eq("matches.game_type", "Snooker")
        .order("matches(played_at)", { ascending: false })
        .limit(10);

      const enriched = [];
      if (mpData) {
        await Promise.all(mpData.map(async mp => {
          const { data: opps } = await supabase
            .from("match_players")
            .select("players!inner(name)")
            .eq("match_id", mp.match_id)
            .neq("player_id", player.id)
            .limit(1);
          enriched.push({
            ...mp,
            opponent_name: opps?.[0]?.players?.name ?? "Unknown",
            game_type: mp.matches?.game_type,
            played_at: mp.matches?.played_at,
          });
        }));
        enriched.sort((a, b) => new Date(b.played_at) - new Date(a.played_at));
      }

      const { data: allMp } = await supabase
        .from("match_players")
        .select(`match_id, is_winner, score, matches!inner(id, game_type)`)
        .eq("player_id", player.id)
        .eq("matches.game_type", "Snooker");
      const h2hMap = {};
      if (allMp) {
        await Promise.all(allMp.map(async mp => {
          const { data: opps } = await supabase
            .from("match_players")
            .select("player_id, score, players!inner(name)")
            .eq("match_id", mp.match_id)
            .neq("player_id", player.id);
          if (!opps?.length) return;
          const myScore = mp.score ?? 0;
          for (const opp of opps) {
            const oppScore = opp.score ?? 0;
            if (!h2hMap[opp.player_id])
              h2hMap[opp.player_id] = { name: opp.players.name, wins: 0, losses: 0 };
            if (myScore > oppScore) h2hMap[opp.player_id].wins++;
            else                    h2hMap[opp.player_id].losses++;
          }
        }));
      }
      const h2hSorted = Object.values(h2hMap).sort((a, b) => (b.wins + b.losses) - (a.wins + a.losses));

      if (!cancelled) {
        setProfile({ ...player, highestBreak, breaks50, breaks100 });
        setMatches(enriched);
        setH2h(h2hSorted);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [player.id]);

  const snookerMatches = player.snooker_matches ?? 0;
  const snookerWins    = player.snooker_wins ?? 0;
  const snookerLosses  = player.snooker_losses ?? 0;
  const wp       = snookerMatches > 0 ? ((snookerWins / snookerMatches) * 100).toFixed(1) + "%" : "0.0%";
  const favourite  = h2h.length ? [...h2h].sort((a, b) => b.wins   - a.wins)[0]   : null;
  const nemesis    = h2h.length ? [...h2h].sort((a, b) => b.losses - a.losses)[0] : null;
  const mostPlayed = h2h.length ? h2h[0] : null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 300,
        background: "rgba(0,0,0,0.82)",
        backdropFilter: "blur(8px)",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        overflowY: "auto", WebkitOverflowScrolling: "touch",
      }}
    >
      <div
        className="profile-panel"
        onClick={e => e.stopPropagation()}
        style={{
          background: T.card,
          width: "100%", maxWidth: 600,
          margin: "40px auto",
          borderRadius: 18,
          border: `1px solid ${T.borderHi}`,
          overflow: "hidden",
          boxShadow: "0 32px 100px rgba(0,0,0,0.8)",
          animation: "profileIn 0.22s cubic-bezier(0.16,1,0.3,1)",
          display: "flex",
          flexDirection: "column",
          maxHeight: "calc(100vh - 80px)",
        }}
      >
        {/* Header */}
        <div style={{
          background: `linear-gradient(160deg, rgba(0,229,160,0.04) 0%, transparent 60%)`,
          borderBottom: `1px solid ${T.border}`,
          padding: "22px 22px 20px",
          position: "relative",
          flexShrink: 0,
        }}>
          <button
            onClick={onClose}
            style={{
              position: "absolute", top: 16, right: 16,
              background: "rgba(255,255,255,0.04)",
              border: `1px solid ${T.border}`,
              color: T.textMuted, cursor: "pointer",
              borderRadius: 8, width: 32, height: 32,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 15, lineHeight: 1, zIndex: 1,
              transition: "all 0.15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = T.text; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = T.textMuted; }}
          >
            ✕
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 14, paddingRight: 48 }}>
            <Avatar name={player.name} size={54} fontSize={20} />
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontSize: 20, fontWeight: 800, color: T.text,
                letterSpacing: "-0.3px",
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                fontFamily: "'DM Sans', sans-serif",
              }}>
                {player.name}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5, flexWrap: "wrap" }}>
                <span style={{
                  background: T.winBg, color: T.winText,
                  border: `1px solid rgba(0,229,160,0.25)`,
                  borderRadius: 6, padding: "2px 8px",
                  fontSize: 11, fontWeight: 700,
                  fontFamily: "'DM Mono', monospace",
                }}>
                  {wp} WR
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{
          padding: "22px 22px 36px",
          overflowY: "auto",
          flex: 1,
          WebkitOverflowScrolling: "touch",
        }}>
          {loading ? <LoadingDots /> : (
            <>
              <SectionLabel>Snooker Stats</SectionLabel>
              <div className="stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 8, marginBottom: 28 }}>
                <StatTile label="Matches"  value={snookerMatches}                                    />
                <StatTile label="Wins"     value={snookerWins}             color={T.winText}         />
                <StatTile label="Losses"   value={snookerLosses}           color={T.lossText}        />
                <StatTile label="Win %"    value={wp}                      color={T.green}           />
                <StatTile label="Hi Break" value={profile?.highestBreak ?? "—"} color={T.gold}  sub="snooker" />
                <StatTile label="50+ Breaks" value={profile?.breaks50 ?? 0}  color={"#e8a838"}       />
                <StatTile label="Centuries"  value={profile?.breaks100 ?? 0} color={T.green}         />
              </div>

              {h2h.length > 0 && (
                <>
                  <SectionLabel>Player Insights</SectionLabel>
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
                    gap: 8, marginBottom: 28,
                  }}>
                    {favourite?.wins > 0 && (
                      <div style={{
                        background: T.surface, border: `1px solid ${T.border}`,
                        borderRadius: 10, padding: "13px 14px",
                      }}>
                        <div style={{
                          fontSize: 9, color: T.textMuted, textTransform: "uppercase",
                          letterSpacing: "0.12em", marginBottom: 7,
                          fontFamily: "'DM Mono', monospace",
                        }}>
                          Favourite victim
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: T.winText, marginBottom: 3 }}>
                          {favourite.name}
                        </div>
                        <div style={{ fontSize: 11, color: T.textFaint }}>
                          {favourite.wins} wins against
                        </div>
                      </div>
                    )}
                    {nemesis?.losses > 0 && (
                      <div style={{
                        background: T.surface, border: `1px solid ${T.border}`,
                        borderRadius: 10, padding: "13px 14px",
                      }}>
                        <div style={{
                          fontSize: 9, color: T.textMuted, textTransform: "uppercase",
                          letterSpacing: "0.12em", marginBottom: 7,
                          fontFamily: "'DM Mono', monospace",
                        }}>
                          Nemesis
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: T.lossText, marginBottom: 3 }}>
                          {nemesis.name}
                        </div>
                        <div style={{ fontSize: 11, color: T.textFaint }}>
                          {nemesis.losses} losses to
                        </div>
                      </div>
                    )}
                    {mostPlayed && (
                      <div style={{
                        background: T.surface, border: `1px solid ${T.border}`,
                        borderRadius: 10, padding: "13px 14px",
                      }}>
                        <div style={{
                          fontSize: 9, color: T.textMuted, textTransform: "uppercase",
                          letterSpacing: "0.12em", marginBottom: 7,
                          fontFamily: "'DM Mono', monospace",
                        }}>
                          Most played
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 3 }}>
                          {mostPlayed.name}
                        </div>
                        <div style={{ fontSize: 11, color: T.textFaint }}>
                          {mostPlayed.wins + mostPlayed.losses} matches
                        </div>
                      </div>
                    )}
                  </div>

                  <SectionLabel>Head-to-Head</SectionLabel>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 28 }}>
                    {h2h.map((row, i) => (
                      <H2HRow key={row.name} name={row.name} wins={row.wins} losses={row.losses} index={i} />
                    ))}
                  </div>
                </>
              )}

              <SectionLabel>Last 10 Matches</SectionLabel>
              {matches.length === 0 ? (
                <div style={{ color: T.textMuted, fontSize: 13, padding: "16px 0" }}>
                  No matches recorded yet.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  {matches.map((m, i) => <MatchRow key={m.id} match={m} index={i} />)}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── BREAK VIEW TOGGLE ────────────────────────────────────────────────────────
function BreakViewToggle({ value, onChange }) {
  const opts = [
    { key: "results", label: "Results" },
    { key: "breaks",  label: "Breaks"  },
  ];
  return (
    <div style={{
      display: "inline-flex", gap: 3, marginBottom: 20,
      background: "rgba(255,255,255,0.03)",
      border: `1px solid ${T.border}`,
      borderRadius: 8, padding: 3,
    }}>
      {opts.map(({ key, label }) => {
        const active = value === key;
        return (
          <button key={key} onClick={() => onChange(key)} style={{
            padding: "7px 14px", borderRadius: 6, border: "none", cursor: "pointer",
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
            transition: "all 0.18s ease",
            background: active ? T.green : "transparent",
            color: active ? "#071a13" : T.textMuted,
            boxShadow: active ? `0 2px 12px rgba(0,229,160,0.2)` : "none",
          }}>
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ─── SNOOKER TABLE (desktop) ──────────────────────────────────────────────────
function SnookerTable({ rows, view, onRowClick }) {
  const showBreaks = view === "breaks";
  const cols = showBreaks
    ? ["#", "Player", "Hi Break", "50+ Breaks", "Centuries"]
    : ["#", "Player", "Played", "Wins", "Win %", "Hi Break"];
  return (
    <div style={{ borderRadius: 12, border: `1px solid ${T.border}`, overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead style={{ background: "rgba(255,255,255,0.025)", borderBottom: `1px solid ${T.border}` }}>
          <tr>
            {cols.map((h, i) => (
              <th key={h} style={{
                padding: "11px 16px", fontSize: 9, fontWeight: 700,
                letterSpacing: "0.15em", textTransform: "uppercase", color: T.textMuted,
                textAlign: i <= 1 ? "left" : "right", whiteSpace: "nowrap",
                width: i === 0 ? 52 : undefined,
                fontFamily: "'DM Mono', monospace",
              }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            const pct     = winPct(row.wins, row.played);
            const isMedal = idx < 3;
            const tdBase  = { padding: "13px 16px", textAlign: "right", verticalAlign: "middle", fontSize: 13, color: T.textSec, fontFamily: "'DM Mono', monospace", fontVariantNumeric: "tabular-nums" };
            return (
              <tr
                key={row.player_id}
                className="lb-row"
                onClick={() => row.playerObj && onRowClick(row.playerObj)}
                style={{
                  cursor: row.playerObj ? "pointer" : "default",
                  background: isMedal ? MEDAL[idx].bg : idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)",
                  borderLeft: `2px solid ${isMedal ? MEDAL[idx].border : "transparent"}`,
                  borderBottom: `1px solid rgba(255,255,255,0.03)`,
                }}
              >
                <td style={{ padding: "13px 16px", textAlign: "center", verticalAlign: "middle" }}>
                  <span style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    width: 28, height: 28, borderRadius: 7,
                    fontSize: isMedal ? 16 : 11, fontWeight: 700,
                    background: isMedal ? "transparent" : "rgba(255,255,255,0.04)",
                    color: isMedal ? MEDAL[idx].text : T.textMuted,
                    fontFamily: "'DM Mono', monospace",
                  }}>
                    {isMedal ? MEDAL[idx].emoji : idx + 1}
                  </span>
                </td>
                <td style={{ padding: "13px 16px", verticalAlign: "middle" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Avatar name={row.name} size={28} fontSize={11} />
                    <span style={{
                      fontSize: 13, fontWeight: isMedal ? 700 : 500,
                      color: isMedal ? MEDAL[idx].text : T.text,
                      fontFamily: "'DM Sans', sans-serif",
                    }}>
                      {row.name}
                    </span>
                  </div>
                </td>
                {showBreaks ? (<>
                  <td style={tdBase}>
                    {row.highest_break != null
                      ? <span style={{ fontWeight: 700, color: T.gold }}>{row.highest_break}</span>
                      : <span style={{ color: T.textFaint }}>—</span>}
                  </td>
                  <td style={tdBase}>
                    {row.breaks50 > 0
                      ? <span style={{ fontWeight: 700, color: "#e8a838" }}>{row.breaks50}</span>
                      : <span style={{ color: T.textFaint }}>—</span>}
                  </td>
                  <td style={tdBase}>
                    {row.breaks100 > 0
                      ? <span style={{ fontWeight: 700, color: T.green }}>{row.breaks100}</span>
                      : <span style={{ color: T.textFaint }}>—</span>}
                  </td>
                </>) : (<>
                  <td style={tdBase}>{row.played}</td>
                  <td style={tdBase}>{row.wins}</td>
                  <td style={{ padding: "13px 16px", textAlign: "right", verticalAlign: "middle" }}>
                    <span style={{ color: winPctColor(pct), fontWeight: 600, fontSize: 13, fontFamily: "'DM Mono', monospace", fontVariantNumeric: "tabular-nums" }}>
                      {pct}
                    </span>
                  </td>
                  <td style={tdBase}>
                    {row.highest_break != null
                      ? <span style={{ fontWeight: 700, color: T.gold }}>{row.highest_break}</span>
                      : <span style={{ color: T.textFaint }}>—</span>}
                  </td>
                </>)}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── SNOOKER CARD (mobile) ────────────────────────────────────────────────────
function SnookerCard({ row, idx, view, onClick }) {
  const isMedal    = idx < 3;
  const showBreaks = view === "breaks";
  const pct        = winPct(row.wins, row.played);
  return (
    <div
      onClick={() => row.playerObj && onClick(row.playerObj)}
      className="lb-card"
      style={{
        background: isMedal ? MEDAL[idx].bg : "rgba(255,255,255,0.015)",
        border: `1px solid ${isMedal ? MEDAL[idx].border : T.border}`,
        borderRadius: 12, padding: "13px 14px",
        display: "flex", alignItems: "center", gap: 12,
        cursor: row.playerObj ? "pointer" : "default",
      }}
    >
      <div style={{
        flexShrink: 0, width: 30, height: 30, borderRadius: 8,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: isMedal ? "transparent" : "rgba(255,255,255,0.04)",
        fontSize: isMedal ? 18 : 12, fontWeight: 800,
        color: isMedal ? MEDAL[idx].text : T.textMuted,
        fontFamily: "'DM Mono', monospace",
      }}>
        {isMedal ? MEDAL[idx].emoji : idx + 1}
      </div>
      <Avatar name={row.name} size={34} fontSize={13} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14, fontWeight: isMedal ? 700 : 600,
          color: isMedal ? MEDAL[idx].text : T.text,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          marginBottom: 3, fontFamily: "'DM Sans', sans-serif",
        }}>
          {row.name}
        </div>
        {showBreaks ? (
          <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
            {row.highest_break != null && (
              <span style={{ fontSize: 11, color: T.gold, fontWeight: 700 }}>🎱 Hi: {row.highest_break}</span>
            )}
            <span style={{ fontSize: 11, color: "#e8a838", fontWeight: 700, fontFamily: "'DM Mono', monospace" }}>
              50+: {row.breaks50 || 0}
            </span>
            <span style={{ fontSize: 11, color: T.green, fontWeight: 700, fontFamily: "'DM Mono', monospace" }}>
              100+: {row.breaks100 || 0}
            </span>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: T.textSec, fontFamily: "'DM Mono', monospace" }}>
              <span style={{ color: T.winText, fontWeight: 700 }}>{row.wins}W</span>
              {" / "}
              {row.played} played
            </span>
            <span style={{ fontSize: 11, color: winPctColor(pct), fontWeight: 600, fontFamily: "'DM Mono', monospace" }}>
              {pct}
            </span>
            {row.highest_break != null && (
              <span style={{ fontSize: 11, color: T.gold, fontWeight: 700 }}>
                🎱 {row.highest_break}
              </span>
            )}
          </div>
        )}
      </div>
      {!showBreaks && (
        <div style={{ flexShrink: 0, textAlign: "right" }}>
          <div style={{
            fontSize: 16, fontWeight: 800,
            color: isMedal ? MEDAL[idx].text : T.green,
            fontFamily: "'DM Mono', monospace", fontVariantNumeric: "tabular-nums",
          }}>
            {pct}
          </div>
          <div style={{
            fontSize: 9, color: T.textMuted,
            letterSpacing: "0.12em", textTransform: "uppercase",
            marginTop: 1, fontFamily: "'DM Mono', monospace",
          }}>
            WIN %
          </div>
        </div>
      )}
      {row.playerObj && <span style={{ color: T.textFaint, fontSize: 14, flexShrink: 0 }}>›</span>}
    </div>
  );
}

// ─── EMPTY STATE ──────────────────────────────────────────────────────────────
function EmptyState({ emoji, title, subtitle }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: "80px 24px", gap: 16, textAlign: "center",
    }}>
      <div style={{
        width: 72, height: 72, borderRadius: 20,
        background: "rgba(255,255,255,0.03)",
        border: `1px solid ${T.border}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 34,
      }}>
        {emoji}
      </div>
      <div>
        <div style={{
          color: T.text, fontWeight: 700, fontSize: 16, marginBottom: 6,
          fontFamily: "'DM Sans', sans-serif",
        }}>
          {title}
        </div>
        <div style={{ color: T.textMuted, fontSize: 13, lineHeight: 1.6, maxWidth: 260 }}>
          {subtitle}
        </div>
      </div>
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function Players() {
  const [snookerRows,    setSnookerRows]    = useState([]);
  const [snookerLoading, setSnookerLoading] = useState(true);
  const [snookerError,   setSnookerError]   = useState(null);
  const [allPlayers,     setAllPlayers]     = useState({});
  const [lastUpdated,    setLastUpdated]    = useState(null);
  const [countdown,      setCountdown]      = useState(30);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [breakView,      setBreakView]      = useState("results");

  const { group } = useAuth();
  const groupId   = group?.id;

  const fetchSnooker = useCallback(async () => {
    try {
      const { data: playerData, error: pErr } = await supabase
        .from("players")
        .select("id, name, snooker_matches, snooker_wins, snooker_losses")
        .eq("group_id", groupId)
        .gt("snooker_matches", 0);
      if (pErr) throw pErr;

      const { data: breakData } = await supabase
        .from("match_players")
        .select(`player_id, highest_break, matches!inner(game_type)`)
        .eq("group_id", groupId)
        .eq("matches.game_type", "Snooker")
        .not("highest_break", "is", null);

      const breakMap    = {};
      const breaks50Map  = {};
      const breaks100Map = {};
      for (const row of breakData || []) {
        const pid = row.player_id;
        if (!breakMap[pid] || row.highest_break > breakMap[pid])
          breakMap[pid] = row.highest_break;
        if (row.highest_break >= 50)
          breaks50Map[pid]  = (breaks50Map[pid]  || 0) + 1;
        if (row.highest_break >= 100)
          breaks100Map[pid] = (breaks100Map[pid] || 0) + 1;
      }

      const rows = (playerData || []).map(p => ({
        player_id:     p.id,
        name:          p.name,
        played:        p.snooker_matches ?? 0,
        wins:          p.snooker_wins    ?? 0,
        losses:        p.snooker_losses  ?? 0,
        highest_break: breakMap[p.id]    ?? null,
        breaks50:      breaks50Map[p.id]  ?? 0,
        breaks100:     breaks100Map[p.id] ?? 0,
      }));

      const sorted = [...rows].sort((a, b) => {
        const ar = winRatio(a.wins, a.played), br = winRatio(b.wins, b.played);
        if (br !== ar) return br - ar;
        return b.wins - a.wins;
      });
      setSnookerRows(sorted);

      const map = {};
      for (const p of playerData || []) map[p.id] = p;
      setAllPlayers(map);

      setSnookerError(null);
    } catch (e) {
      setSnookerError(e.message || "Failed to load snooker rankings.");
    } finally {
      setSnookerLoading(false);
    }
  }, [groupId]);

  const refresh = useCallback(async () => {
    await fetchSnooker();
    setLastUpdated(new Date());
    setCountdown(30);
  }, [fetchSnooker]);

  useEffect(() => {
    if (!groupId) return;
    refresh();
    const iv = setInterval(refresh, REFRESH_INTERVAL);
    return () => clearInterval(iv);
  }, [refresh, groupId]);

  useEffect(() => {
    const tick = setInterval(() => setCountdown(c => c <= 1 ? 30 : c - 1), 1000);
    return () => clearInterval(tick);
  }, [lastUpdated]);

  const snookerWithObj = snookerRows.map(r => ({ ...r, playerObj: allPlayers[r.player_id] ?? null }));

  return (
    <div style={{
      minHeight: "100vh",
      background: T.bg,
      backgroundImage: [
        "radial-gradient(ellipse 90% 40% at 50% -5%, rgba(0,229,160,0.06) 0%, transparent 65%)",
        "repeating-linear-gradient(0deg, transparent, transparent 59px, rgba(255,255,255,0.015) 60px)",
        "repeating-linear-gradient(90deg, transparent, transparent 59px, rgba(255,255,255,0.015) 60px)",
      ].join(", "),
      fontFamily: "'DM Sans', system-ui, sans-serif",
      color: T.text,
    }}>
      <style>{GLOBAL_CSS}</style>

      <div className="lb-page" style={{ maxWidth: 920, margin: "0 auto", padding: "32px 24px 90px" }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
            <h1 className="lb-title" style={{
              fontSize: 32, fontWeight: 900, letterSpacing: "-0.03em",
              lineHeight: 1, color: T.text, margin: 0,
              fontFamily: "'DM Sans', sans-serif",
            }}>
              Players
            </h1>
            {!snookerLoading && snookerRows.length > 0 && (
              <span style={{ fontSize: 13, color: T.textMuted, fontFamily: "'DM Mono', monospace" }}>
                {snookerRows.length}
              </span>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "4px 10px", borderRadius: 20,
              background: "rgba(0,229,160,0.07)",
              border: "1px solid rgba(0,229,160,0.18)",
              fontSize: 10, color: T.green, letterSpacing: "0.08em",
              textTransform: "uppercase", fontFamily: "'DM Mono', monospace",
            }}>
              <span style={{
                width: 5, height: 5, borderRadius: "50%",
                background: T.green, animation: "pulse 2s infinite",
              }} />
              Live
            </span>
            {lastUpdated && (
              <span style={{ fontSize: 11, color: T.textFaint, fontFamily: "'DM Mono', monospace" }}>
                Refreshes in {countdown}s
              </span>
            )}
          </div>
        </div>

        {/* ── Toggles row ── */}
        <div style={{ display: "flex", alignItems: "center", marginBottom: 4 }}>
          <BreakViewToggle value={breakView} onChange={setBreakView} />
        </div>

        {/* ── Leaderboard ── */}
        {snookerLoading ? <LoadingDots /> :
          snookerError ? (
            <EmptyState emoji="⚠" title="Couldn't load rankings" subtitle={snookerError} />
          ) :
          snookerWithObj.length === 0 ? (
            <EmptyState emoji="🔴" title="No snooker matches yet" subtitle="Record a snooker match to see rankings here." />
          ) : (
            <>
              <div className="lb-cards">
                {snookerWithObj.map((r, i) => (
                  <SnookerCard key={r.player_id} row={r} idx={i} view={breakView} onClick={setSelectedPlayer} />
                ))}
              </div>
              <div className="lb-table">
                <SnookerTable rows={snookerWithObj} view={breakView} onRowClick={setSelectedPlayer} />
              </div>
            </>
          )
        }
      </div>

      {selectedPlayer && (
        <PlayerProfile player={selectedPlayer} onClose={() => setSelectedPlayer(null)} />
      )}
    </div>
  );
}
