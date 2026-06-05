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

// 4-player ELO: run all 6 pairwise duels based on ranking order
function calcFourPlayerElo(r1, r2, r3, r4) {
  const d12 = calcElo(r1, r2, true);
  const d13 = calcElo(r1, r3, true);
  const d14 = calcElo(r1, r4, true);
  const d23 = calcElo(r2, r3, true);
  const d24 = calcElo(r2, r4, true);
  const d34 = calcElo(r3, r4, true);
  const net1 = d12.changeA + d13.changeA + d14.changeA;
  const net2 = d12.changeB + d23.changeA + d24.changeA;
  const net3 = d13.changeB + d23.changeB + d34.changeA;
  const net4 = d14.changeB + d24.changeB + d34.changeB;
  return {
    netChange: [net1, net2, net3, net4],
    finalElo:  [r1 + net1, r2 + net2, r3 + net3, r4 + net4],
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
  fourth:    "#7c8799",
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
  4: { label: "4️⃣ 4th",  color: T.fourth, glow: "rgba(124,135,153,0.04)" },
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
        .select("id, name")
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

// ─── ELO CHIP (removed) ────────────────────────────────────────────────────

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
          const hb       = i === 0 ? highBreak1 : highBreak2;
          return (
            <div key={p.id} style={{
              background: isWinner ? "rgba(0,229,160,0.05)" : T.surface,
              border: `1.5px solid ${isWinner ? "rgba(0,229,160,0.25)" : T.border}`,
              borderRadius: T.radius, padding: "14px 12px", textAlign: "center",
            }}>
              <div style={{
                fontSize: 13, color: isWinner ? T.green : T.textSec,
                marginBottom: hb !== "" && hb != null ? 8 : 0, fontWeight: 600,
                fontFamily: "'DM Sans', sans-serif",
              }}>
                {p.name}
              </div>
              {hb !== "" && hb != null && (
                <div style={{ fontSize: 11, color: T.gold, fontWeight: 600 }}>
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

// ─── RESULT CARD — multi-player (3 or 4) ─────────────────────────────────────
function ResultCardMulti({ result, onReset }) {
  const { ranked, playerCount } = result;
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
        <div style={{ marginTop: 5, color: T.textMuted, fontSize: 13 }}>
          Snooker · {playerCount} Players
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 22 }}>
        {ranked.map(({ player, breakScore, rank }) => {
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

// ─── TOGGLE BUTTON ───────────────────────────────────────────────────────────
function TogglePlayerBtn({ active, onToggle, addLabel, removeLabel }) {
  return (
    <button
      onClick={onToggle}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        width: "100%", background: "transparent",
        border: `1px dashed ${active ? "rgba(255,77,109,0.3)" : "rgba(0,229,160,0.25)"}`,
        borderRadius: T.radiusSm,
        color: active ? T.red : T.green,
        fontSize: 13, fontWeight: 600, padding: "10px 16px",
        cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
        transition: "all 0.18s",
      }}
      onMouseEnter={e => (e.currentTarget.style.background = active ? T.redGlow : T.greenGlow)}
      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
    >
      <span style={{ fontSize: 16, lineHeight: 1 }}>{active ? "−" : "+"}</span>
      {active ? removeLabel : addLabel}
    </button>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function RecordMatch() {
  const [player1,  setPlayer1]  = useState(null);
  const [player2,  setPlayer2]  = useState(null);
  const [player3,  setPlayer3]  = useState(null);
  const [player4,  setPlayer4]  = useState(null);
  const [show3rd,  setShow3rd]  = useState(false);
  const [show4th,  setShow4th]  = useState(false);
  const [break1,   setBreak1]   = useState("");
  const [break2,   setBreak2]   = useState("");
  const [break3,   setBreak3]   = useState("");
  const [break4,   setBreak4]   = useState("");
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState("");
  const [result,   setResult]   = useState(null);

  const isThree = show3rd && !show4th;
  const isFour  = show3rd && show4th;
  const { group } = useAuth();
  const groupId   = group?.id;

  const toggle3rd = () => {
    if (show3rd) {
      // removing 3rd also removes 4th
      setPlayer3(null); setBreak3("");
      setPlayer4(null); setBreak4("");
      setShow3rd(false); setShow4th(false);
    } else {
      setShow3rd(true);
    }
    setError("");
  };

  const toggle4th = () => {
    if (show4th) {
      setPlayer4(null); setBreak4("");
      setShow4th(false);
    } else {
      setShow4th(true);
    }
    setError("");
  };

  const reset = () => {
    setPlayer1(null); setPlayer2(null); setPlayer3(null); setPlayer4(null);
    setShow3rd(false); setShow4th(false);
    setBreak1(""); setBreak2(""); setBreak3(""); setBreak4("");
    setError(""); setResult(null);
  };

  const validate = () => {
    if (!player1 || !player2) return "Please select both players.";
    const ids = [player1.id, player2.id];
    if (show3rd) {
      if (!player3) return "Please select a 3rd player, or remove the 3rd slot.";
      ids.push(player3.id);
    }
    if (show4th) {
      if (!player4) return "Please select a 4th player, or remove the 4th slot.";
      ids.push(player4.id);
    }
    if (new Set(ids).size !== ids.length) return "Players must all be different.";

    if (!show3rd) {
      // 2-player
      if (break1 === "" && break2 === "") return "Please enter break scores to determine the winner.";
      if (break1 !== "" && break2 !== "" && Number(break1) === Number(break2)) return "Break scores are tied — enter different scores to determine the winner.";
    } else {
      // 3 or 4 player
      const allBreaks = show4th
        ? [break1, break2, break3, break4]
        : [break1, break2, break3];
      const scores = allBreaks.map(Number);
      if (scores.some(isNaN) || scores.some(s => s < 0)) return `Enter valid break scores for all ${show4th ? 4 : 3} players.`;
      if (new Set(scores).size !== scores.length) return "Break scores must all be different (used to rank players).";
    }
    return null;
  };

  // ─── SAVE — 2 player ────────────────────────────────────────────────────────
  const saveTwo = async () => {
    const p1Won = Number(break1) > Number(break2);
    const s1 = break1 !== "" ? parseInt(break1) : 0;
    const s2 = break2 !== "" ? parseInt(break2) : 0;
    const { data: match, error: mErr } = await supabase
      .from("matches")
      .insert({ game_type: "Snooker", format: "race_to", race_to: 1, played_at: new Date().toISOString(), is_deleted: false, group_id: groupId })
      .select().single();
    if (mErr) throw mErr;

    const mpRows = [
      { match_id: match.id, player_id: player1.id, score: s1, is_winner: p1Won,  group_id: groupId, ...(break1 !== "" ? { highest_break: parseInt(break1) } : {}) },
      { match_id: match.id, player_id: player2.id, score: s2, is_winner: !p1Won, group_id: groupId, ...(break2 !== "" ? { highest_break: parseInt(break2) } : {}) },
    ];
    const { error: mpErr } = await supabase.from("match_players").insert(mpRows);
    if (mpErr) throw mpErr;

    const updatePlayer = async (player, won) => {
      const { data: fresh } = await supabase.from("players").select("*").eq("id", player.id).single();
      const p = fresh || player;
      const streak   = won ? (p.snooker_streak >= 0 ? p.snooker_streak + 1 : 1) : (p.snooker_streak <= 0 ? p.snooker_streak - 1 : -1);
      const longestW = won  ? Math.max(p.snooker_longest_win_streak  || 0, streak)           : (p.snooker_longest_win_streak  || 0);
      const longestL = !won ? Math.max(p.snooker_longest_loss_streak || 0, Math.abs(streak)) : (p.snooker_longest_loss_streak || 0);
      await supabase.from("players").update({
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

    setResult({ kind: "two", p1: player1, p2: player2, winner: p1Won ? player1.name : player2.name, highBreak1: break1, highBreak2: break2 });
  };

  // ─── SAVE — 3 player ────────────────────────────────────────────────────────
  const saveThree = async () => {
    const players = [player1, player2, player3];
    const breaks  = [Number(break1), Number(break2), Number(break3)];
    const order   = [0, 1, 2].sort((a, b) => breaks[b] - breaks[a]);
    const ranked  = order.map((idx, pos) => ({ player: players[idx], breakScore: breaks[idx], rank: pos + 1 }));
    const { data: match, error: mErr } = await supabase
      .from("matches")
      .insert({ game_type: "Snooker", format: "race_to", race_to: 1, played_at: new Date().toISOString(), is_deleted: false, group_id: groupId })
      .select().single();
    if (mErr) throw mErr;

    const mpRows = ranked.map((row) => ({
      match_id: match.id, player_id: row.player.id, score: row.breakScore,
      is_winner: row.rank === 1, group_id: groupId,
      ...(row.breakScore > 0 ? { highest_break: row.breakScore } : {}),
    }));
    const { error: mpErr } = await supabase.from("match_players").insert(mpRows);
    if (mpErr) throw mpErr;

    // 3-player: 1st = 2W 0L (+2 matches), 2nd = 1W 1L (+2), 3rd = 0W 2L (+2)
    const THREE_WINS   = [2, 1, 0];
    const THREE_LOSSES = [0, 1, 2];

    await Promise.all(ranked.map(async (row, pos) => {
      const won = row.rank === 1;
      const { data: fresh } = await supabase.from("players").select("*").eq("id", row.player.id).single();
      const p = fresh || row.player;
      const streak   = won ? (p.snooker_streak >= 0 ? p.snooker_streak + 1 : 1) : (p.snooker_streak <= 0 ? p.snooker_streak - 1 : -1);
      const longestW = won  ? Math.max(p.snooker_longest_win_streak  || 0, streak)           : (p.snooker_longest_win_streak  || 0);
      const longestL = !won ? Math.max(p.snooker_longest_loss_streak || 0, Math.abs(streak)) : (p.snooker_longest_loss_streak || 0);
      await supabase.from("players").update({
        snooker_matches:             (p.snooker_matches || 0) + 2,
        snooker_wins:                (p.snooker_wins   || 0) + THREE_WINS[pos],
        snooker_losses:              (p.snooker_losses || 0) + THREE_LOSSES[pos],
        snooker_streak:              streak,
        snooker_longest_win_streak:  longestW,
        snooker_longest_loss_streak: longestL,
      }).eq("id", row.player.id);
    }));

    setResult({ kind: "multi", playerCount: 3, ranked });
  };

  // ─── SAVE — 4 player ────────────────────────────────────────────────────────
  const saveFour = async () => {
    const players = [player1, player2, player3, player4];
    const breaks  = [Number(break1), Number(break2), Number(break3), Number(break4)];
    const order   = [0, 1, 2, 3].sort((a, b) => breaks[b] - breaks[a]);
    const ranked  = order.map((idx, pos) => ({ player: players[idx], breakScore: breaks[idx], rank: pos + 1 }));
    const { data: match, error: mErr } = await supabase
      .from("matches")
      .insert({ game_type: "Snooker", format: "race_to", race_to: 1, played_at: new Date().toISOString(), is_deleted: false, group_id: groupId })
      .select().single();
    if (mErr) throw mErr;

    const mpRows = ranked.map((row) => ({
      match_id: match.id, player_id: row.player.id, score: row.breakScore,
      is_winner: row.rank === 1, group_id: groupId,
      ...(row.breakScore > 0 ? { highest_break: row.breakScore } : {}),
    }));
    const { error: mpErr } = await supabase.from("match_players").insert(mpRows);
    if (mpErr) throw mpErr;

    // 4-player: 1st = 3W 0L (+3 matches), 2nd = 2W 1L (+3), 3rd = 1W 2L (+3), 4th = 0W 3L (+3)
    const FOUR_WINS   = [3, 2, 1, 0];
    const FOUR_LOSSES = [0, 1, 2, 3];

    await Promise.all(ranked.map(async (row, pos) => {
      const won = row.rank === 1;
      const { data: fresh } = await supabase.from("players").select("*").eq("id", row.player.id).single();
      const p = fresh || row.player;
      const streak   = won ? (p.snooker_streak >= 0 ? p.snooker_streak + 1 : 1) : (p.snooker_streak <= 0 ? p.snooker_streak - 1 : -1);
      const longestW = won  ? Math.max(p.snooker_longest_win_streak  || 0, streak)           : (p.snooker_longest_win_streak  || 0);
      const longestL = !won ? Math.max(p.snooker_longest_loss_streak || 0, Math.abs(streak)) : (p.snooker_longest_loss_streak || 0);
      await supabase.from("players").update({
        snooker_matches:             (p.snooker_matches || 0) + 3,
        snooker_wins:                (p.snooker_wins   || 0) + FOUR_WINS[pos],
        snooker_losses:              (p.snooker_losses || 0) + FOUR_LOSSES[pos],
        snooker_streak:              streak,
        snooker_longest_win_streak:  longestW,
        snooker_longest_loss_streak: longestL,
      }).eq("id", row.player.id);
    }));

    setResult({ kind: "multi", playerCount: 4, ranked });
  };

  // ─── UNIFIED SAVE ────────────────────────────────────────────────────────────
  const saveMatch = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setError(""); setSaving(true);
    try {
      if (isFour)       await saveFour();
      else if (isThree) await saveThree();
      else              await saveTwo();
    } catch (e) {
      setError(e.message || "Failed to save match.");
    } finally {
      setSaving(false);
    }
  };

  const excludeFor = (...others) => others.filter(Boolean).map(p => p.id);
  const playerCount = isFour ? 4 : isThree ? 3 : 2;
  const isMulti = isThree || isFour;

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
            result.kind === "two"
              ? <ResultCard2 result={result} onReset={reset} />
              : <ResultCardMulti result={result} onReset={reset} />
          ) : (
            <>
              {/* Players row 1 */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <PlayerSearch label="Player 1" value={player1} onChange={setPlayer1} excludeIds={excludeFor(player2, player3, player4)} groupId={groupId} />
                <PlayerSearch label="Player 2" value={player2} onChange={setPlayer2} excludeIds={excludeFor(player1, player3, player4)} groupId={groupId} />
              </div>

              {/* Player 3 */}
              {show3rd && (
                <div style={{ marginBottom: 12 }}>
                  <PlayerSearch label="Player 3" value={player3} onChange={setPlayer3} excludeIds={excludeFor(player1, player2, player4)} groupId={groupId} />
                </div>
              )}

              {/* Player 4 — only shows if 3rd is shown */}
              {show3rd && show4th && (
                <div style={{ marginBottom: 12 }}>
                  <PlayerSearch label="Player 4" value={player4} onChange={setPlayer4} excludeIds={excludeFor(player1, player2, player3)} groupId={groupId} />
                </div>
              )}

              {/* Toggle buttons */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
                <TogglePlayerBtn
                  active={show3rd}
                  onToggle={toggle3rd}
                  addLabel="Add 3rd Player"
                  removeLabel="Remove 3rd Player"
                />
                {show3rd && (
                  <TogglePlayerBtn
                    active={show4th}
                    onToggle={toggle4th}
                    addLabel="Add 4th Player"
                    removeLabel="Remove 4th Player"
                  />
                )}
              </div>

              <Divider />

              {/* Break inputs */}
              <div style={{ marginBottom: 22 }}>
                <Label>{isMulti ? "Break Scores (determines ranking)" : "Highest Break"}</Label>
                {isMulti ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <BreakInput playerName={player1?.name ?? "Player 1"} value={break1} onChange={setBreak1} />
                    <BreakInput playerName={player2?.name ?? "Player 2"} value={break2} onChange={setBreak2} />
                    <BreakInput playerName={player3?.name ?? "Player 3"} value={break3} onChange={setBreak3} />
                    {isFour && (
                      <BreakInput playerName={player4?.name ?? "Player 4"} value={break4} onChange={setBreak4} />
                    )}
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 10, alignItems: "center" }}>
                    <BreakInput playerName={player1?.name ?? "Player 1"} value={break1} onChange={setBreak1} />
                    <div style={{ paddingTop: 22, color: T.textMuted, fontWeight: 700, textAlign: "center" }}>–</div>
                    <BreakInput playerName={player2?.name ?? "Player 2"} value={break2} onChange={setBreak2} />
                  </div>
                )}
                {isMulti && (
                  <div style={{
                    marginTop: 10, fontSize: 11, color: T.textMuted, lineHeight: 1.5,
                    padding: "8px 10px", borderRadius: 6,
                    background: "rgba(255,255,255,0.02)",
                    border: `1px solid ${T.border}`,
                    fontFamily: "'DM Mono', monospace",
                  }}>
                    {isFour
                      ? "Highest break → 1st. 1st=3W, 2nd=2W+1L, 3rd=1W+2L, 4th=3L"
                      : "Highest break → 1st. 1st=2W, 2nd=1W+1L, 3rd=2L"
                    }
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
