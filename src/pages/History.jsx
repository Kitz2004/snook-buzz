import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../supabase.js';
import { useAuth } from '../context/AuthContext';

// ─── THEME ────────────────────────────────────────────────────────────────────
const T = {
  bg:        "#090b0f",
  surface:   "#0f1218",
  card:      "#141820",
  border:    "rgba(255,255,255,0.06)",
  borderHi:  "rgba(255,255,255,0.11)",
  green:     "#00e5a0",
  greenGlow: "rgba(0,229,160,0.08)",
  red:       "#ff4d6d",
  redGlow:   "rgba(255,77,109,0.08)",
  gold:      "#ffc53d",
  text:      "#edf1f7",
  textSec:   "#7c8799",
  textMuted: "#4a5263",
  textFaint: "#2e3545",
  winText:   "#00e5a0",
  winBg:     "rgba(0,229,160,0.08)",
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const normalise = gt => (gt || '').toLowerCase();

function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  const d   = new Date(dateStr);
  const pad = n => String(n).padStart(2, '0');
  const day   = pad(d.getDate());
  const month = d.toLocaleString('default', { month: 'short' });
  const year  = d.getFullYear();
  const h     = d.getHours();
  const min   = pad(d.getMinutes());
  const ampm  = h >= 12 ? 'pm' : 'am';
  const hour  = h % 12 || 12;
  return `${day} ${month} ${year} · ${hour}:${min}${ampm}`;
}

// ─── GLOBAL CSS ───────────────────────────────────────────────────────────────
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&family=DM+Mono:wght@400;500;600&display=swap');

  @keyframes shimmer {
    from { background-position: 200% 0; }
    to   { background-position: -200% 0; }
  }
  @keyframes fadeSlide {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: none; }
  }
  @keyframes popIn {
    from { opacity: 0; transform: scale(0.93) translateY(8px); }
    to   { opacity: 1; transform: scale(1) translateY(0); }
  }

  .hist-card {
    transition: border-color 0.18s ease, box-shadow 0.18s ease;
  }
  .hist-card:hover {
    border-color: rgba(255,255,255,0.11) !important;
    box-shadow: 0 8px 32px rgba(0,0,0,0.5) !important;
  }
  .del-btn {
    transition: background 0.15s ease, transform 0.12s ease;
  }
  .del-btn:hover {
    background: rgba(255,77,109,0.18) !important;
    transform: scale(1.08);
  }
  .del-btn:active {
    transform: scale(0.94);
  }

  @media (max-width: 520px) {
    .hist-header { padding: 22px 14px 0 !important; }
    .hist-body   { padding: 16px 12px 0 !important; }
    .hist-title  { font-size: 22px !important; }
  }
`;

// ─── TRASH ICON SVG ───────────────────────────────────────────────────────────
function TrashIcon() {
  return (
    <svg width="13" height="14" viewBox="0 0 13 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M1 3.5H12M4.5 3.5V2.5C4.5 2 4.9 1.5 5.5 1.5H7.5C8.1 1.5 8.5 2 8.5 2.5V3.5M5.5 6.5V10.5M7.5 6.5V10.5M2 3.5L2.5 11.5C2.5 12.1 3 12.5 3.5 12.5H9.5C10 12.5 10.5 12.1 10.5 11.5L11 3.5H2Z"
        stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ─── CONFIRM DIALOG ───────────────────────────────────────────────────────────
function ConfirmDialog({ onConfirm, onCancel, deleting }) {
  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.72)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '0 20px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#141820',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 16,
          padding: '24px 24px 20px',
          width: '100%', maxWidth: 320,
          boxShadow: '0 24px 64px rgba(0,0,0,0.8)',
          animation: 'popIn 0.18s cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: 'rgba(255,77,109,0.1)',
          border: '1px solid rgba(255,77,109,0.22)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 16, color: T.red, fontSize: 18,
        }}>
          🗑️
        </div>

        <div style={{
          fontSize: 16, fontWeight: 800, color: T.text, marginBottom: 6,
          fontFamily: "'DM Sans', sans-serif", letterSpacing: '-0.01em',
        }}>
          Delete this match?
        </div>
        <div style={{
          fontSize: 13, color: T.textSec, lineHeight: 1.5, marginBottom: 22,
          fontFamily: "'DM Sans', sans-serif",
        }}>
          This action cannot be undone. The match and all associated data will be permanently removed.
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onCancel}
            disabled={deleting}
            style={{
              flex: 1, padding: '11px 0', borderRadius: 10,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: T.textSec, fontSize: 13, fontWeight: 700,
              cursor: deleting ? 'not-allowed' : 'pointer',
              fontFamily: "'DM Sans', sans-serif",
              transition: 'all 0.15s',
              opacity: deleting ? 0.5 : 1,
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            style={{
              flex: 1, padding: '11px 0', borderRadius: 10,
              background: deleting ? 'rgba(255,77,109,0.3)' : T.red,
              border: 'none',
              color: '#fff', fontSize: 13, fontWeight: 800,
              cursor: deleting ? 'not-allowed' : 'pointer',
              fontFamily: "'DM Sans', sans-serif",
              transition: 'all 0.15s',
              boxShadow: deleting ? 'none' : '0 0 20px rgba(255,77,109,0.25)',
            }}
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SKELETON LOADING ─────────────────────────────────────────────────────────
function SkeletonCards() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
      {[110, 110, 100].map((h, i) => (
        <div key={i} style={{
          height: h, borderRadius: 14,
          background: 'linear-gradient(90deg, rgba(20,24,32,0.9) 0%, rgba(30,36,48,0.5) 50%, rgba(20,24,32,0.9) 100%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 1.5s infinite',
          border: `1px solid ${T.border}`,
        }} />
      ))}
    </div>
  );
}

// ─── EMPTY STATE ──────────────────────────────────────────────────────────────
function EmptyState({ filter }) {
  const isFiltered = filter !== 'All';
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '80px 24px', gap: 16, textAlign: 'center',
    }}>
      <div style={{
        width: 72, height: 72, borderRadius: 20,
        background: 'rgba(255,255,255,0.03)',
        border: `1px solid ${T.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 32,
      }}>
        {filter === 'Snooker' ? '🔴' : '🎱'}
      </div>
      <div>
        <div style={{
          color: T.text, fontWeight: 700, fontSize: 16, marginBottom: 6,
          fontFamily: "'DM Sans', sans-serif",
        }}>
          {isFiltered ? `No ${filter} matches yet` : 'No matches yet'}
        </div>
        <div style={{ color: T.textMuted, fontSize: 13, lineHeight: 1.6, maxWidth: 260 }}>
          {isFiltered
            ? `Switch to "All" or record a ${filter} match to see results.`
            : 'Start playing and your match history will appear here.'}
        </div>
      </div>
    </div>
  );
}

// ─── PLAYER SIDE ──────────────────────────────────────────────────────────────
function PlayerSide({ mp, isSnooker, align }) {
  if (!mp) return <div style={{ flex: 1 }} />;
  const isWinner = !!mp.is_winner;
  const name     = mp.players?.name ?? `Player ${mp.player_id}`;

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: align === 'left' ? 'flex-start' : 'flex-end',
      gap: 4, minWidth: 0,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 5,
        flexDirection: align === 'left' ? 'row' : 'row-reverse',
      }}>
        {isWinner && <span style={{ fontSize: 12, flexShrink: 0 }}>🏆</span>}
        <span style={{
          fontSize: 14, fontWeight: isWinner ? 700 : 500,
          color: isWinner ? T.text : T.textSec,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          fontFamily: "'DM Sans', sans-serif",
        }}>
          {name}
        </span>
      </div>

      {isSnooker && mp.highest_break != null && (
        <span style={{
          fontSize: 11, color: T.gold, fontWeight: 600,
          fontFamily: "'DM Mono', monospace",
        }}>
          🎱 {mp.highest_break}
        </span>
      )}
    </div>
  );
}

// ─── CENTRE WIDGET ────────────────────────────────────────────────────────────
function CentreWidget({ match, isSnooker, p1, p2 }) {
  const winner     = [p1, p2].find(p => p?.is_winner);
  const winnerName = winner?.players?.name ?? '—';

  if (isSnooker) {
    return (
      <div style={{
        flexShrink: 0, display: 'flex', alignItems: 'center',
        gap: 4, margin: '0 10px',
        background: 'rgba(0,0,0,0.25)',
        border: `1px solid ${T.border}`,
        borderRadius: 10, padding: '6px 10px',
      }}>
        <span style={{
          fontSize: 20, fontWeight: 800,
          color: p1?.is_winner ? T.text : T.textFaint,
          fontFamily: "'DM Mono', monospace",
          fontVariantNumeric: 'tabular-nums',
          width: 22, textAlign: 'center', lineHeight: 1,
        }}>
          {p1?.score ?? '?'}
        </span>
        <span style={{ color: T.textFaint, fontSize: 14, fontWeight: 300 }}>–</span>
        <span style={{
          fontSize: 20, fontWeight: 800,
          color: p2?.is_winner ? T.text : T.textFaint,
          fontFamily: "'DM Mono', monospace",
          fontVariantNumeric: 'tabular-nums',
          width: 22, textAlign: 'center', lineHeight: 1,
        }}>
          {p2?.score ?? '?'}
        </span>
      </div>
    );
  }

  return (
    <div style={{
      flexShrink: 0, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 3, margin: '0 10px',
      background: T.winBg,
      border: `1px solid rgba(0,229,160,0.18)`,
      borderRadius: 10, padding: '7px 12px',
    }}>
      <span style={{
        fontSize: 9, fontWeight: 700, letterSpacing: '0.12em',
        textTransform: 'uppercase', color: T.winText,
        fontFamily: "'DM Mono', monospace",
      }}>
        Winner
      </span>
      <span style={{
        fontSize: 13, fontWeight: 700, color: T.winText,
        whiteSpace: 'nowrap', fontFamily: "'DM Sans', sans-serif",
      }}>
        {winnerName}
      </span>
    </div>
  );
}

// ─── MULTI-PLAYER LAYOUT (3 or 4 players) ────────────────────────────────────
function MultiPlayerMatch({ players }) {
  const sorted = [...players].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const ranks  = ['🥇', '🥈', '🥉', '4️⃣'];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {sorted.map((mp, i) => {
        const name = mp.players?.name ?? `Player ${mp.player_id}`;
        return (
          <div key={mp.id} style={{
            display: 'grid', gridTemplateColumns: '24px 1fr auto',
            alignItems: 'center', gap: 10,
            background: i === 0 ? 'rgba(255,197,61,0.04)' : 'transparent',
            borderRadius: 8, padding: '6px 4px',
          }}>
            <span style={{ fontSize: 15, lineHeight: 1, textAlign: 'center' }}>{ranks[i]}</span>
            <span style={{
              fontSize: 13, fontWeight: i === 0 ? 700 : 500,
              color: i === 0 ? T.text : T.textSec,
              fontFamily: "'DM Sans', sans-serif",
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {name}
            </span>
            {mp.highest_break != null && (
              <span style={{
                fontSize: 11, color: T.gold, fontWeight: 600,
                fontFamily: "'DM Mono', monospace",
              }}>
                🎱 {mp.highest_break}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── MATCH CARD ───────────────────────────────────────────────────────────────
function MatchCard({ match, index, onDelete }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting,   setDeleting]   = useState(false);

  const isSnooker  = normalise(match.game_type) === 'snooker';
  const players    = match.match_players || [];
  const isMulti    = players.length > 2;
  const sorted     = [...players].sort((a, b) => (b.is_winner ? 1 : 0) - (a.is_winner ? 1 : 0));
  const p1 = sorted[0];
  const p2 = sorted[1];

  const handleConfirmDelete = async () => {
    setDeleting(true);
    try {
      const matchPlayers    = match.match_players || [];
      const playerCount     = matchPlayers.length; // 2, 3, or 4

      // matches added per player: 2p→1, 3p→2, 4p→3
      const matchesPerPlayer = playerCount === 4 ? 3 : playerCount === 3 ? 2 : 1;

      // ── Derive rank from saved scores so we know correct wins/losses ──────
      // (score = break score = ranking key, higher is better)
      const sortedByScore = [...matchPlayers].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
      const rankMap = {};
      sortedByScore.forEach((mp, i) => {
        rankMap[mp.player_id] = {
          wins:   playerCount === 4 ? 3 - i : playerCount === 3 ? 2 - i : (i === 0 ? 1 : 0),
          losses: playerCount === 4 ? i     : playerCount === 3 ? i     : (i === 0 ? 0 : 1),
        };
      });

      // ── Revert each player's stats ────────────────────────────────────────
      await Promise.all(matchPlayers.map(async (mp) => {
        const { data: fresh } = await supabase
          .from('players').select('*').eq('id', mp.player_id).single();
        if (!fresh) return;

        const winsToRemove    = rankMap[mp.player_id].wins;
        const lossesToRemove  = rankMap[mp.player_id].losses;
        const matchesToRemove = matchesPerPlayer;

        const newMatches = Math.max(0, (fresh.snooker_matches || 0) - matchesToRemove);
        const newWins    = Math.max(0, (fresh.snooker_wins    || 0) - winsToRemove);
        const newLosses  = Math.max(0, (fresh.snooker_losses  || 0) - lossesToRemove);

        if (newMatches === 0) {
          await supabase.from('players').update({
            snooker_matches: 0,
            snooker_wins:    0,
            snooker_losses:  0,
          }).eq('id', mp.player_id);
          return;
        }

        await supabase.from('players').update({
          snooker_matches: newMatches,
          snooker_wins:    newWins,
          snooker_losses:  newLosses,
        }).eq('id', mp.player_id);
      }));

      // ── Delete match_players then match ───────────────────────────────────
      const { error: mpErr } = await supabase
        .from('match_players').delete().eq('match_id', match.id);
      if (mpErr) throw mpErr;

      const { error: mErr } = await supabase
        .from('matches').delete().eq('id', match.id);
      if (mErr) throw mErr;

      // ── Recalculate highest break from remaining matches ──────────────────
      await Promise.all(matchPlayers.map(async (mp) => {
        const { data: remaining } = await supabase
          .from('match_players')
          .select('highest_break')
          .eq('player_id', mp.player_id)
          .not('highest_break', 'is', null);

        const newHighestBreak = remaining?.length
          ? Math.max(...remaining.map(r => r.highest_break))
          : 0;

        await supabase.from('players')
          .update({ snooker_highest_break: newHighestBreak })
          .eq('id', mp.player_id);
      }));

      setConfirming(false);
      onDelete(match.id);
    } catch (err) {
      console.error('Delete failed:', err);
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="hist-card" style={{
        background: T.card,
        border: `1px solid ${T.border}`,
        borderRadius: 14, overflow: 'hidden',
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        animation: 'fadeSlide 0.25s ease both',
        animationDelay: `${Math.min(index * 30, 200)}ms`,
        position: 'relative',
      }}>
        {/* Top accent bar */}
        <div style={{
          height: 2,
          background: 'linear-gradient(90deg, #ff4d6d, #c2185b)',
        }} />

        {/* Delete button */}
        <button
          className="del-btn"
          onClick={() => setConfirming(true)}
          title="Delete match"
          style={{
            position: 'absolute', top: 10, right: 10,
            width: 28, height: 28, borderRadius: 7,
            background: 'rgba(255,77,109,0.08)',
            border: '1px solid rgba(255,77,109,0.18)',
            color: T.red, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 2, padding: 0,
          }}
        >
          <TrashIcon />
        </button>

        <div style={{ padding: '13px 15px 15px' }}>
          {/* Meta row */}
          <div style={{
            display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', marginBottom: 12,
            paddingRight: 34,
          }}>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.12em',
              textTransform: 'uppercase', padding: '3px 9px', borderRadius: 20,
              background: T.redGlow,
              color: T.red,
              border: `1px solid rgba(255,77,109,0.22)`,
              fontFamily: "'DM Mono', monospace",
            }}>
              🔴 Snooker{isMulti ? ` · ${players.length}P` : ''}
            </span>
            <span style={{
              fontSize: 11, color: T.textMuted,
              fontFamily: "'DM Mono', monospace",
            }}>
              {formatDateTime(match.played_at)}
            </span>
          </div>

          {/* Players section */}
          {isMulti ? (
            <MultiPlayerMatch players={players} />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <PlayerSide mp={p1} isSnooker={isSnooker} align="left" />
              <CentreWidget match={match} isSnooker={isSnooker} p1={p1} p2={p2} />
              <PlayerSide mp={p2} isSnooker={isSnooker} align="right" />
            </div>
          )}
        </div>
      </div>

      {confirming && (
        <ConfirmDialog
          onConfirm={handleConfirmDelete}
          onCancel={() => { if (!deleting) setConfirming(false); }}
          deleting={deleting}
        />
      )}
    </>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function History() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const { group } = useAuth();
  const groupId   = group?.id;

  const fetchMatches = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { data, error: sbError } = await supabase
        .from('matches')
        .select(`
          id, game_type, played_at, is_deleted,
          match_players (
            id, player_id, score, is_winner,
            highest_break,
            players ( id, name )
          )
        `)
        .eq('group_id', groupId)
        .eq('is_deleted', false)
        .eq('game_type', 'Snooker')
        .order('played_at', { ascending: false });

      if (sbError) throw sbError;
      setMatches(data || []);
    } catch (err) {
      setError(err.message || 'Failed to load matches.');
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    if (groupId) fetchMatches();
  }, [groupId, fetchMatches]);

  const handleDelete = useCallback((matchId) => {
    setMatches(prev => prev.filter(m => m.id !== matchId));
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      background: T.bg,
      backgroundImage: [
        'radial-gradient(ellipse 80% 35% at 50% 0%, rgba(0,229,160,0.04) 0%, transparent 60%)',
        'repeating-linear-gradient(0deg, transparent, transparent 59px, rgba(255,255,255,0.012) 60px)',
        'repeating-linear-gradient(90deg, transparent, transparent 59px, rgba(255,255,255,0.012) 60px)',
      ].join(', '),
      fontFamily: "'DM Sans', system-ui, sans-serif",
      color: T.text,
      paddingBottom: 80,
    }}>
      <style>{GLOBAL_CSS}</style>

      {/* ── Sticky header ── */}
      <div className="hist-header" style={{
        padding: '26px 22px 0',
        borderBottom: `1px solid ${T.border}`,
        background: 'rgba(9,11,15,0.92)',
        backdropFilter: 'blur(16px)',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <div style={{
            display: 'flex', alignItems: 'baseline',
            gap: 10, marginBottom: 14, flexWrap: 'wrap',
          }}>
            <h1 className="hist-title" style={{
              fontSize: 28, fontWeight: 900, letterSpacing: '-0.03em',
              color: T.text, margin: 0, lineHeight: 1,
              fontFamily: "'DM Sans', sans-serif",
            }}>
              History
            </h1>
            {!loading && !error && (
              <span style={{
                fontSize: 12, color: T.textMuted,
                fontFamily: "'DM Mono', monospace",
              }}>
                {matches.length} match{matches.length !== 1 ? 'es' : ''}
              </span>
            )}
          </div>
          <div style={{ paddingBottom: 14 }} />
        </div>
      </div>

      {/* ── Body ── */}
      <div className="hist-body" style={{ padding: '18px 20px 0', maxWidth: 720, margin: '0 auto' }}>
        {loading && <SkeletonCards />}

        {error && (
          <div style={{
            margin: '32px auto', maxWidth: 400,
            background: 'rgba(255,77,109,0.07)',
            border: '1px solid rgba(255,77,109,0.2)',
            borderRadius: 12, padding: '16px 20px',
            color: T.red, fontSize: 13, textAlign: 'center',
            display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center',
          }}>
            <span>⚠</span> {error}
          </div>
        )}

        {!loading && !error && matches.length === 0 && (
          <EmptyState filter={'Snooker'} />
        )}

        {!loading && !error && matches.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {matches.map((match, i) => (
              <MatchCard
                key={match.id}
                match={match}
                index={i}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
