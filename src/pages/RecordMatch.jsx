import { useState, useEffect, useRef } from "react";
import { supabase } from "../supabase.js";
import { useAuth } from "../context/AuthContext";

// ─── ELO ─────────────────────────────────────────────────────────────────────
function calcElo(ratingA, ratingB, aWon, K = 32) {
  const expectedA = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
  const expectedB = 1 - expectedA;
  const actualA   = aWon ? 1 : 0;
  const actualB   = aWon ? 0 : 1;
  return {
    newA:    Math.round(ratingA + K * (actualA - expectedA)),
    newB:    Math.round(ratingB + K * (actualB - expectedB)),
    changeA: Math.round(K * (actualA - expectedA)),
    changeB: Math.round(K * (actualB - expectedB)),
  };
}

function calcThreePlayerElo(r1, r2, r3) {
  const d12 = calcElo(r1, r2, true);
  const d13 = calcElo(r1, r3, true);
  const d23 = calcElo(r2, r3, true);
  const net1 = d12.changeA + d13.changeA;
  const net2 = d12.changeB + d23.changeA;
  const net3 = d13.changeB + d23.changeB;
  return {
    netChange: [net1, net2, net3],
    finalElo:  [r1 + net1, r2 + net2, r3 + net3],
  };
}

// ─── THEME ───────────────────────────────────────────────────────────────────
const T = {
  bg:        "#090b0f",
  surface:   "#0f1218",
  card:      "#141820",
  border:    "rgba(255,255,255,0.07)",
  borderHi:  "rgba(255,255,255,0.12)",
  green:     "#00e5a0",
  greenDim:  "#00b87e",
  greenGlow: "rgba(0,229,160,0.1)",
  red:       "#ff4d6d",
  redGlow:   "rgba(255,77,109,0.1)",
  gold:      "#ffc53d",
  silver:    "#b4bcc8",
  bronze:    "#cd7f4e",
  textPrim:  "#edf1f7",
  textSec:   "#7c8799",
  textMuted: "#4a5263",
  radius:    "12px",
  radiusSm:  "8px",
};

const RANK_STYLE = {
  1: { label: "🥇 1st", color: T.gold,   glow: "rgba(255,197,61,0.08)"  },
  2: { label: "🥈 2nd", color: T.silver, glow: "rgba(180,188,200,0.06)" },
  3: { label: "🥉 3rd", color: T.bronze, glow: "rgba(205,127,78,0.06)"  },
};

// ─── GLOBAL CSS ───────────────────────────────────────────────────────────────
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&family=DM+Mono:wght@400;500;600&display=swap');

  * { box-sizing: border-box; }
  input[type=number]::-webkit-inner-spin-button,
  input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
  input[type=number] { -moz-appearance: textfield; }
  input::placeholder { color: rgba(255,255,255,0.12); }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }

  .rm-save-btn:hover  { opacity: 0.88; transform: translateY(-1px); }
  .rm-save-btn:active { transform: translateY(0); }
`;

// ─── SMALL COMPONENTS ────────────────────────────────────────────────────────
const Label = ({ children, style }) => (
  <div style={{
    fontSize: 10, fontWeight: 700, letterSpacing: "0.14em",
    textTransform: "uppercase", color: T.textMuted,
    marginBottom: 7, fontFamily: "'DM Mono', monospace",
    ...style,
  }}>
    {children}
  </div>
);

const Input = ({ style, ...props }) => (
  <input
    style={{
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderRadius: T.radiusSm,
      color: T.textPrim, padding: "11px 14px",
      fontSize: 14, width: "100%",
      outline: "none", boxSizing: "border-box",
      fontFamily: "'DM Sans', sans-serif",
      transition: "border-color 0.2s, box-shadow 0.2s",
      ...style,
    }}
    onFocus={e => {
      e.target.style.borderColor = T.green;
      e.target.style.boxShadow   = `0 0 0 3px rgba(0,229,160,0.08)`;
    }}
    onBlur={e => {
      e.target.style.borderColor = T.border;
      e.target.style.boxShadow   = "none";
    }}
    {...props}
  />
);

const Divider = () => (
  <div style={{ height: 1, background: T.border, margin: "22px 0" }} />
);

// ─── PLAYER SEARCH ───────────────────────────────────────────────────────────
function PlayerSearch({ label, value, onChange, excludeIds = [], groupId }) {
  const [query,   setQuery]   = useState("");
  const [results, setResults] = useState([]);
  const [open,    setOpen]    = useState(false);
  const [loading, setLoading] = useState(false);
  const ref           = useRef();
  const committingRef = useRef(false);

  useEffect(() => {
    const handler = e => {
      if (ref.current && !ref.current.contains(e.target)) {
        committingRef.current = false;
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, []);

  useEffect(() => {
    if (!query.trim()) { setResults([]); setOpen(false); return; }
    setOpen(true);
    const t = setTimeout(async () => {
      setLoading(true);
      const { data } = await supabase
        .from("players")
        .select("id, name, snooker_elo")
        .ilike("name", `%${query}%`)
        .limit(8);
      setResults(data || []);
      setLoading(false);
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  const select = player => {
    committingRef.current = false;
    onChange(player);
    setQuery(player.name);
    setOpen(false);
  };

  const addNew = async () => {
    const name = query.trim();
    if (!name) return;
    const { data, error } = await supabase
      .from("players")
      .insert({
        name,
        elo_rating: 1200, snooker_elo: 1200,
        total_matches: 0, total_wins: 0, total_losses: 0,
        current_streak: 0, longest_win_streak: 0, longest_loss_streak: 0,
        snooker_matches: 0, snooker_wins: 0, snooker_losses: 0,
        snooker_streak: 0, snooker_longest_win_streak: 0, snooker_longest_loss_streak: 0,
        group_id: groupId,
      })
      .select()
      .single();
    if (!error && data) select(data);
  };

  const filtered   = results.filter(r => !excludeIds.includes(r.id));
  const exactMatch = filtered.some(r => r.name.toLowerCase() === query.trim().toLowerCase());
  const showAdd    = open && !value && !loading && query.trim() && !exactMatch;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <Label>{label}</Label>
      <div style={{ position: "relative" }}>
        <Input
          placeholder="Search or add player…"
          value={value ? value.name : query}
          onChange={e => { setQuery(e.target.value); if (value) onChange(null); }}
          onFocus={() => { if (query.trim()) setOpen(true); }}
          onBlur={() => { if (!committingRef.current) setOpen(false); }}
          style={value ? {
            borderColor: "rgba(0,229,160,0.3)",
            background: "rgba(0,229,160,0.04)",
          } : {}}
        />
        {value && (
          <button
            onPointerDown={() => { onChange(null); setQuery(""); }}
            style={{
              position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
              background: "rgba(255,255,255,0.07)", border: "none",
              color: T.textMuted, cursor: "pointer",
              fontSize: 14, lineHeight: 1, padding: 0,
              width: 22, height: 22, borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            ×
          </button>
        )}
      </div>

      {open && !value && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0,
          background: T.card, border: `1px solid ${T.borderHi}`,
          borderRadius: T.radiusSm, zIndex: 100, overflow: "hidden",
          boxShadow: "0 12px 40px rgba(0,0,0,0.7)",
          animation: "fadeIn 0.12s ease",
        }}>
          {loading && (
            <div style={{ padding: "12px 14px", color: T.textMuted, fontSize: 13, fontFamily: "'DM Mono', monospace" }}>
              Searching…
            </div>
          )}
          {!loading && filtered.map(p => (
            <div
              key={p.id}
              onPointerDown={() => { committingRef.current = true; }}
              onClick={() => select(p)}
              style={{
                padding: "11px 14px", cursor: "pointer",
                borderBottom: `1px solid ${T.border}`,
                display: "flex", justifyContent: "space-between", alignItems: "center",
                transition: "background 0.12s",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = T.surface)}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <span style={{ color: T.textPrim, fontSize: 14, fontFamily: "'DM Sans', sans-serif" }}>
                {p.name}
              </span>
              <span style={{ color: T.textMuted, fontSize: 11, fontFamily: "'DM Mono', monospace" }}>
                {p.snooker_elo ?? 1200}
              </span>
            </div>
          ))}
          {!loading && filtered.length === 0 && !showAdd && (
            <div style={{ padding: "12px 14px", color: T.textMuted, fontSize: 13 }}>
              No players found
            </div>
          )}
          {showAdd && (
            <div
              onPointerDown={() => { committingRef.current = true; }}
              onClick={addNew}
              style={{
                padding: "12px 14px", cursor: "pointer", color: T.green,
                fontSize: 13, fontWeight: 600,
                display: "flex", alignItems: "center", gap: 8,
                borderTop: filtered.length > 0 ? `1px solid ${T.border}` : "none",
                transition: "background 0.12s",
                fontFamily: "'DM Sans', sans-serif",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = T.greenGlow)}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <span style={{
                width: 20, height: 20, borderRadius: "50%",
                background: "rgba(0,229,160,0.15)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 14, flexShrink: 0,
              }}>
                +
              </span>
              Add "{query.trim()}" as new player
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── ELO CHIP ────────────────────────────────────────────────────────────────
const EloChip = ({ change, label = "ELO" }) => (
  <span style={{
    display: "inline-block",
    padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700,
    background: change >= 0 ? "rgba(0,229,160,0.1)" : "rgba(255,77,109,0.1)",
    color: change >= 0 ? T.green : T.red,
    border: `1px solid ${change >= 0 ? "rgba(0,229,160,0.2)" : "rgba(255,77,109,0.2)"}`,
    fontFamily: "'DM Mono', monospace",
    whiteSpace: "nowrap",
  }}>
    {change >= 0 ? "+" : ""}{change} {label}
  </span>
);

// ─── RESULT CARD — 2-player ───────────────────────────────────────────────────
function ResultCard2({ result, onReset }) {
  const { p1, p2, winner, highBreak1, highBreak2 } = result;

  return (
    <div style={{ animation: "fadeUp 0.35s cubic-bezier(0.16,1,0.3,1)" }}>
      <div style={{
        textAlign: "center", marginBottom: 24,
        padding: "20px 0 22px", borderBottom: `1px solid ${T.border}`,
      }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "4px 12px", borderRadius: 20,
          background: "rgba(0,229,160,0.08)",
          border: "1px solid rgba(0,229,160,0.2)",
          fontSize: 10, color: T.green,
          fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase",
          marginBottom: 14, fontFamily: "'DM Mono', monospace",
        }}>
          ✓ Match Saved
        </div>
        <div style={{
          fontSize: 26, fontWeight: 900, color: T.textPrim,
          letterSpacing: "-0.03em", lineHeight: 1.1,
          fontFamily: "'DM Sans', sans-serif",
        }}>
          {winner} wins
        </div>
        <div style={{ marginTop: 5, color: T.textMuted, fontSize: 13 }}>Snooker</div>
      </div>

      <div style={{
        display: "grid", gridTemplateColumns: "1fr auto 1fr",
        gap: 10, alignItems: "center", marginBottom: 20,
      }}>
        {[p1, p2].map((p, i) => {
          const isWinner = p.name === winner;
          const change   = i === 0 ? result.eloChange1 : result.eloChange2;
          const hb       = i === 0 ? highBreak1 : highBreak2;
          return (
            <div key={p.id} style={{
              background: isWinner ? "rgba(0,229,160,0.05)" : T.surface,
              border: `1.5px solid ${isWinner ? "rgba(0,229,160,0.25)" : T.border}`,
              borderRadius: T.radius, padding: "14px 12px", textAlign: "center",
            }}>
              <div style={{
                fontSize: 13, color: isWinner ? T.green : T.textSec,
                marginBottom: 8, fontWeight: 600,
                fontFamily: "'DM Sans', sans-serif",
              }}>
                {p.name}
              </div>
              <EloChip change={change} label="Snooker ELO" />
              {hb !== "" && hb != null && (
                <div style={{ marginTop: 8, fontSize: 11, color: T.gold, fontWeight: 600 }}>
                  🎱 Break {hb}
                </div>
              )}
            </div>
          );
        })}
        <div style={{ textAlign: "center", color: T.textMuted, fontWeight: 800, fontSize: 14 }}>
          VS
        </div>
      </div>

      <div style={{
        background: T.surface, border: `1px solid ${T.border}`,
        borderRadius: T.radiusSm, overflow: "hidden", marginBottom: 22,
      }}>
        <div style={{
          display: "flex", justifyContent: "space-between",
          padding: "9px 14px", borderBottom: `1px solid ${T.border}`,
          background: "rgba(255,255,255,0.02)",
        }}>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: T.textMuted, fontFamily: "'DM Mono', monospace" }}>Player</span>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: T.textMuted, fontFamily: "'DM Mono', monospace" }}>Snooker ELO</span>
        </div>
        {[p1, p2].map((p, i) => (
          <div key={p.id} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "11px 14px",
            borderBottom: i === 0 ? `1px solid ${T.border}` : "none",
          }}>
            <span style={{ color: T.textSec, fontSize: 13, fontFamily: "'DM Sans', sans-serif" }}>{p.name}</span>
            <span style={{ fontFamily: "'DM Mono', monospace", fontVariantNumeric: "tabular-nums", fontSize: 13 }}>
              <span style={{ color: T.textMuted }}>{i === 0 ? result.elo1Before : result.elo2Before}</span>
              <span style={{ color: T.textMuted, margin: "0 5px" }}>→</span>
              <span style={{ color: T.textPrim, fontWeight: 600 }}>{i === 0 ? result.elo1After : result.elo2After}</span>
            </span>
          </div>
        ))}
      </div>

      <button onClick={onReset} className="rm-save-btn" style={{
        width: "100%", padding: "14px", borderRadius: T.radius,
        background: T.green, border: "none", color: "#071a13",
        fontWeight: 800, fontSize: 14, letterSpacing: "0.03em",
        cursor: "pointer", fontFamily: "'DM Sans', sans-serif", transition: "all 0.2s",
      }}>
        Record Another Match
      </button>
    </div>
  );
}

// ─── RESULT CARD — 3-player snooker ──────────────────────────────────────────
function ResultCard3({ result, onReset }) {
  const { ranked } = result;
  return (
    <div style={{ animation: "fadeUp 0.35s cubic-bezier(0.16,1,0.3,1)" }}>
      <div style={{
        textAlign: "center", marginBottom: 24,
        padding: "20px 0 22px", borderBottom: `1px solid ${T.border}`,
      }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "4px 12px", borderRadius: 20,
          background: "rgba(255,77,109,0.07)",
          border: "1px solid rgba(255,77,109,0.18)",
          fontSize: 10, color: T.red,
          fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase",
          marginBottom: 14, fontFamily: "'DM Mono', monospace",
        }}>
          ✓ Match Saved
        </div>
        <div style={{
          fontSize: 26, fontWeight: 900, color: T.textPrim,
          letterSpacing: "-0.03em", lineHeight: 1.1,
          fontFamily: "'DM Sans', sans-serif",
        }}>
          {ranked[0].player.name} wins
        </div>
        <div style={{ marginTop: 5, color: T.textMuted, fontSize: 13 }}>Snooker · 3 Players</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 22 }}>
        {ranked.map(({ player, breakScore, eloChange, eloBefore, eloAfter, rank }) => {
          const rs = RANK_STYLE[rank];
          return (
            <div key={player.id} style={{
              display: "grid", gridTemplateColumns: "auto 1fr auto",
              alignItems: "center", gap: 14,
              background: rank === 1 ? "rgba(255,197,61,0.05)" : T.surface,
              border: `1.5px solid ${rank === 1 ? "rgba(255,197,61,0.25)" : T.border}`,
              borderRadius: T.radius, padding: "13px 15px",
            }}>
              <div style={{ fontSize: 20, lineHeight: 1, width: 36, textAlign: "center", flexShrink: 0 }}>
                {rs.label}
              </div>
              <div>
                <div style={{
                  fontSize: 14, fontWeight: rank === 1 ? 800 : 600,
                  color: rs.color, marginBottom: 4,
                  fontFamily: "'DM Sans', sans-serif",
                }}>
                  {player.name}
                </div>
                {breakScore !== "" && breakScore != null && (
                  <div style={{ fontSize: 11, color: T.gold, fontWeight: 600 }}>🎱 Break {breakScore}</div>
                )}
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <EloChip change={eloChange} label="Snooker ELO" />
                <div style={{
                  fontSize: 10, color: T.textMuted, marginTop: 5,
                  fontFamily: "'DM Mono', monospace", fontVariantNumeric: "tabular-nums",
                }}>
                  {eloBefore} → {eloAfter}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <button onClick={onReset} className="rm-save-btn" style={{
        width: "100%", padding: "14px", borderRadius: T.radius,
        background: T.green, border: "none", color: "#071a13",
        fontWeight: 800, fontSize: 14, letterSpacing: "0.03em",
        cursor: "pointer", fontFamily: "'DM Sans', sans-serif", transition: "all 0.2s",
      }}>
        Record Another Match
      </button>
    </div>
  );
}

// ─── BREAK INPUT ─────────────────────────────────────────────────────────────
function BreakInput({ playerName, value, onChange }) {
  return (
    <div>
      <div style={{
        fontSize: 11, color: T.textMuted, marginBottom: 5,
        fontWeight: 600, whiteSpace: "nowrap",
        overflow: "hidden", textOverflow: "ellipsis",
        fontFamily: "'DM Sans', sans-serif",
      }}>
        {playerName || "—"}
      </div>
      <Input
        type="number" min="0" max="147" placeholder="0"
        value={value} onChange={e => onChange(e.target.value)}
        style={{ textAlign: "center", padding: "10px 8px" }}
      />
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function RecordMatch() {
  const [player1,  setPlayer1]  = useState(null);
  const [player2,  setPlayer2]  = useState(null);
  const [player3,  setPlayer3]  = useState(null);
  const [show3rd,  setShow3rd]  = useState(false);
  const [break1,   setBreak1]   = useState("");
  const [break2,   setBreak2]   = useState("");
  const [break3,   setBreak3]   = useState("");
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState("");
  const [result,   setResult]   = useState(null);

  const isThree = show3rd;
  const { group } = useAuth();
  const groupId   = group?.id;

  const toggle3rd = () => {
    if (show3rd) { setPlayer3(null); setBreak3(""); }
    setShow3rd(v => !v); setError("");
  };

  const reset = () => {
    setPlayer1(null); setPlayer2(null); setPlayer3(null);
    setShow3rd(false);
    setBreak1(""); setBreak2(""); setBreak3("");
    setError(""); setResult(null);
  };

  const validate = () => {
    if (!player1 || !player2) return "Please select both players.";
    const ids = [player1.id, player2.id];
    if (isThree) {
      if (!player3) return "Please select a 3rd player, or remove the 3rd slot.";
      ids.push(player3.id);
    }
    if (new Set(ids).size !== ids.length) return "Players must all be different.";
    if (!isThree && break1 === "" && break2 === "") return "Please enter break scores to determine the winner.";
    if (!isThree && break1 !== "" && break2 !== "" && Number(break1) === Number(break2)) return "Break scores are tied — enter different scores to determine the winner.";
    if (isThree) {
      const scores = [break1, break2, break3].map(Number);
      if (scores.some(isNaN) || scores.some(s => s < 0)) return "Enter valid break scores for all 3 players.";
      if (new Set(scores).size !== 3) return "Break scores must all be different (used to rank players).";
    }
    return null;
  };

  // ─── SAVE — 2 player ────────────────────────────────────────────────────────
  const saveTwo = async () => {
    const p1Won = Number(break1) > Number(break2);
    const s1 = break1 !== "" ? parseInt(break1) : 0;
    const s2 = break2 !== "" ? parseInt(break2) : 0;
    const r1 = player1.snooker_elo ?? 1200;
    const r2 = player2.snooker_elo ?? 1200;
    const elo = calcElo(r1, r2, p1Won);

    const { data: match, error: mErr } = await supabase
      .from("matches")
      .insert({ game_type: "Snooker", format: "race_to", race_to: 1, played_at: new Date().toISOString(), is_deleted: false, group_id: groupId })
      .select().single();
    if (mErr) throw mErr;

    const mpRows = [
      { match_id: match.id, player_id: player1.id, score: s1, is_winner: p1Won,  elo_before: r1, elo_after: elo.newA, elo_change: elo.changeA, group_id: groupId, ...(break1 !== "" ? { highest_break: parseInt(break1) } : {}) },
      { match_id: match.id, player_id: player2.id, score: s2, is_winner: !p1Won, elo_before: r2, elo_after: elo.newB, elo_change: elo.changeB, group_id: groupId, ...(break2 !== "" ? { highest_break: parseInt(break2) } : {}) },
    ];
    const { error: mpErr } = await supabase.from("match_players").insert(mpRows);
    if (mpErr) throw mpErr;

    const updatePlayer = async (player, won) => {
      const newElo = won ? elo.newA : elo.newB;
      const { data: fresh } = await supabase.from("players").select("*").eq("id", player.id).single();
      const p = fresh || player;

      const streak   = won ? (p.snooker_streak >= 0 ? p.snooker_streak + 1 : 1) : (p.snooker_streak <= 0 ? p.snooker_streak - 1 : -1);
      const longestW = won  ? Math.max(p.snooker_longest_win_streak  || 0, streak)           : (p.snooker_longest_win_streak  || 0);
      const longestL = !won ? Math.max(p.snooker_longest_loss_streak || 0, Math.abs(streak)) : (p.snooker_longest_loss_streak || 0);
      await supabase.from("players").update({
        snooker_elo:                 newElo,
        snooker_matches:             (p.snooker_matches || 0) + 1,
        snooker_wins:                (p.snooker_wins   || 0) + (won ? 1 : 0),
        snooker_losses:              (p.snooker_losses || 0) + (won ? 0 : 1),
        snooker_streak:              streak,
        snooker_longest_win_streak:  longestW,
        snooker_longest_loss_streak: longestL,
      }).eq("id", player.id);
    };

    await updatePlayer(player1, p1Won);
    await updatePlayer(player2, !p1Won);

    setResult({ kind: "two", p1: player1, p2: player2, winner: p1Won ? player1.name : player2.name, highBreak1: break1, highBreak2: break2, eloChange1: elo.changeA, eloChange2: elo.changeB, elo1Before: r1, elo1After: elo.newA, elo2Before: r2, elo2After: elo.newB });
  };

  // ─── SAVE — 3 player snooker ─────────────────────────────────────────────────
  const saveThree = async () => {
    const players = [player1, player2, player3];
    const breaks  = [Number(break1), Number(break2), Number(break3)];
    const order   = [0, 1, 2].sort((a, b) => breaks[b] - breaks[a]);
    const ranked  = order.map((idx, pos) => ({ player: players[idx], breakScore: breaks[idx], rank: pos + 1 }));
    const r = ranked.map(row => row.player.snooker_elo ?? 1200);
    const { netChange, finalElo } = calcThreePlayerElo(r[0], r[1], r[2]);

    const { data: match, error: mErr } = await supabase
      .from("matches")
      .insert({ game_type: "Snooker", format: "race_to", race_to: 1, played_at: new Date().toISOString(), is_deleted: false, group_id: groupId })
      .select().single();
    if (mErr) throw mErr;

    const mpRows = ranked.map((row, pos) => ({
      match_id: match.id, player_id: row.player.id, score: row.breakScore,
      is_winner: row.rank === 1, elo_before: r[pos], elo_after: finalElo[pos],
      elo_change: netChange[pos], group_id: groupId,
      ...(row.breakScore > 0 ? { highest_break: row.breakScore } : {}),
    }));
    const { error: mpErr } = await supabase.from("match_players").insert(mpRows);
    if (mpErr) throw mpErr;

    await Promise.all(ranked.map(async (row, pos) => {
      const won = row.rank === 1;
      const { data: fresh } = await supabase.from("players").select("*").eq("id", row.player.id).single();
      const p = fresh || row.player;
      const streak   = won ? (p.snooker_streak >= 0 ? p.snooker_streak + 1 : 1) : (p.snooker_streak <= 0 ? p.snooker_streak - 1 : -1);
      const longestW = won  ? Math.max(p.snooker_longest_win_streak  || 0, streak)           : (p.snooker_longest_win_streak  || 0);
      const longestL = !won ? Math.max(p.snooker_longest_loss_streak || 0, Math.abs(streak)) : (p.snooker_longest_loss_streak || 0);
      await supabase.from("players").update({
        snooker_elo:                 finalElo[pos],
        snooker_matches:             (p.snooker_matches || 0) + 1,
        snooker_wins:                (p.snooker_wins   || 0) + (won ? 1 : 0),
        snooker_losses:              (p.snooker_losses || 0) + (won ? 0 : 1),
        snooker_streak:              streak,
        snooker_longest_win_streak:  longestW,
        snooker_longest_loss_streak: longestL,
      }).eq("id", row.player.id);
    }));

    setResult({ kind: "three", ranked: ranked.map((row, pos) => ({ ...row, eloBefore: r[pos], eloAfter: finalElo[pos], eloChange: netChange[pos] })) });
  };

  // ─── UNIFIED SAVE ────────────────────────────────────────────────────────────
  const saveMatch = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setError(""); setSaving(true);
    try {
      if (isThree) await saveThree();
      else         await saveTwo();
    } catch (e) {
      setError(e.message || "Failed to save match.");
    } finally {
      setSaving(false);
    }
  };

  const excludeFor = (...others) => others.filter(Boolean).map(p => p.id);

  // ─── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: "100vh",
      background: T.bg,
      backgroundImage: "radial-gradient(ellipse 80% 40% at 50% 0%, rgba(255,77,109,0.05) 0%, transparent 60%)",
      display: "flex", alignItems: "flex-start", justifyContent: "center",
      padding: "40px 16px 100px",
      fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
      color: T.textPrim,
    }}>
      <style>{GLOBAL_CSS}</style>

      <div style={{ width: "100%", maxWidth: 480 }}>

        {/* Header */}
        <div style={{ marginBottom: 26, textAlign: "center" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 9,
            background: T.card, borderRadius: 999, padding: "7px 16px",
            border: `1px solid ${T.border}`, marginBottom: 18,
            boxShadow: "0 0 0 1px rgba(255,77,109,0.08)",
          }}>
            <span style={{ fontSize: 17 }}>🔴</span>
            <span style={{
              fontWeight: 800, letterSpacing: "0.14em", fontSize: 11,
              color: T.green, textTransform: "uppercase",
              fontFamily: "'DM Mono', monospace",
            }}>
              Snook Buzz
            </span>
          </div>
          <h1 style={{
            margin: 0, fontSize: 28, fontWeight: 900,
            letterSpacing: "-0.03em", color: T.textPrim,
            fontFamily: "'DM Sans', sans-serif",
          }}>
            Record Match
          </h1>
        </div>

        {/* Card */}
        <div style={{
          background: T.card, border: `1px solid ${T.border}`,
          borderRadius: 16, padding: "22px 22px",
          boxShadow: "0 8px 48px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.04) inset",
        }}>
          {result ? (
            result.kind === "three"
              ? <ResultCard3 result={result} onReset={reset} />
              : <ResultCard2 result={result} onReset={reset} />
          ) : (
            <>
              {/* Players */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: isThree ? 12 : 20 }}>
                <PlayerSearch label="Player 1" value={player1} onChange={setPlayer1} excludeIds={excludeFor(player2, player3)} groupId={groupId} />
                <PlayerSearch label="Player 2" value={player2} onChange={setPlayer2} excludeIds={excludeFor(player1, player3)} groupId={groupId} />
              </div>

              {isThree && (
                <div style={{ marginBottom: 20 }}>
                  <PlayerSearch label="Player 3" value={player3} onChange={setPlayer3} excludeIds={excludeFor(player1, player2)} groupId={groupId} />
                </div>
              )}

              <div style={{ marginBottom: 20 }}>
                <button
                  onClick={toggle3rd}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    width: "100%", background: "transparent",
                    border: `1px dashed ${show3rd ? "rgba(255,77,109,0.3)" : "rgba(0,229,160,0.25)"}`,
                    borderRadius: T.radiusSm,
                    color: show3rd ? T.red : T.green,
                    fontSize: 13, fontWeight: 600, padding: "10px 16px",
                    cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                    transition: "all 0.18s",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = show3rd ? T.redGlow : T.greenGlow)}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <span style={{ fontSize: 16, lineHeight: 1 }}>{show3rd ? "−" : "+"}</span>
                  {show3rd ? "Remove 3rd Player" : "Add 3rd Player"}
                </button>
              </div>

              <Divider />

              {/* Break inputs */}
              <div style={{ marginBottom: 22 }}>
                <Label>{isThree ? "Break Scores (determines ranking)" : "Highest Break"}</Label>
                {isThree ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <BreakInput playerName={player1?.name ?? "Player 1"} value={break1} onChange={setBreak1} />
                    <BreakInput playerName={player2?.name ?? "Player 2"} value={break2} onChange={setBreak2} />
                    <BreakInput playerName={player3?.name ?? "Player 3"} value={break3} onChange={setBreak3} />
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 10, alignItems: "center" }}>
                    <BreakInput playerName={player1?.name ?? "Player 1"} value={break1} onChange={setBreak1} />
                    <div style={{ paddingTop: 22, color: T.textMuted, fontWeight: 700, textAlign: "center" }}>–</div>
                    <BreakInput playerName={player2?.name ?? "Player 2"} value={break2} onChange={setBreak2} />
                  </div>
                )}
                {isThree && (
                  <div style={{
                    marginTop: 10, fontSize: 11, color: T.textMuted, lineHeight: 1.5,
                    padding: "8px 10px", borderRadius: 6,
                    background: "rgba(255,255,255,0.02)",
                    border: `1px solid ${T.border}`,
                    fontFamily: "'DM Mono', monospace",
                  }}>
                    Highest break → 1st place. ELO via three 1v1 duels.
                  </div>
                )}
              </div>

              {/* Error */}
              {error && (
                <div style={{
                  background: "rgba(255,77,109,0.07)",
                  border: `1px solid rgba(255,77,109,0.25)`,
                  borderRadius: T.radiusSm, padding: "11px 14px",
                  color: T.red, fontSize: 13, marginBottom: 16,
                  fontWeight: 500, lineHeight: 1.5,
                  display: "flex", gap: 8, alignItems: "flex-start",
                }}>
                  <span style={{ flexShrink: 0, marginTop: 1 }}>⚠</span>
                  {error}
                </div>
              )}

              {/* Save */}
              <button
                onClick={saveMatch}
                disabled={saving}
                className={saving ? "" : "rm-save-btn"}
                style={{
                  width: "100%", padding: "14px", borderRadius: T.radius,
                  background: saving ? T.surface : T.green,
                  border: saving ? `1px solid ${T.border}` : "none",
                  color: saving ? T.textMuted : "#071a13",
                  fontWeight: 800, fontSize: 14, letterSpacing: "0.04em",
                  cursor: saving ? "not-allowed" : "pointer",
                  fontFamily: "'DM Sans', sans-serif", transition: "all 0.2s",
                  boxShadow: saving ? "none" : `0 0 28px rgba(0,229,160,0.18)`,
                }}
              >
                {saving ? "Saving…" : "Save Match"}
              </button>
            </>
          )}
        </div>

        <div style={{
          textAlign: "center", marginTop: 14,
          color: T.textMuted, fontSize: 11,
          fontFamily: "'DM Mono', monospace",
          letterSpacing: "0.08em",
        }}>
          Snook Buzz · Match Tracker
        </div>
      </div>
    </div>
  );
}
