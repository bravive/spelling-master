import { useState, useMemo } from 'react';
import { ALL_POKEMON, pkImg, pkShiny } from '../data/pokemon';
import POKEMON_STATS from '../data/pokemon-stats.json';
import POKEMON_EVOLUTIONS from '../data/pokemon-evolutions.json';
import { isPkCaught, pkCount, C, s } from '../shared';

const STAT_META = [
  { key: 'hp',  label: 'HP',              title: 'Hit Points — how much damage this Pokémon can take before fainting',        color: '#ef4444' },
  { key: 'atk', label: 'Attack',          title: 'Attack — strength of physical moves like Tackle or Earthquake',             color: '#f97316' },
  { key: 'def', label: 'Defense',         title: 'Defense — resistance to physical moves; higher = less damage taken',        color: '#eab308' },
  { key: 'spa', label: 'Sp. Attack',      title: 'Special Attack — strength of special moves like Flamethrower or Surf',      color: '#60a5fa' },
  { key: 'spd', label: 'Sp. Defense',     title: 'Special Defense — resistance to special moves; higher = less damage taken', color: '#10b981' },
  { key: 'spe', label: 'Speed',           title: 'Speed — determines who attacks first; higher = moves before the opponent',  color: '#c4b5fd' },
];

const slugToName = slug => slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, ' ');

// ── ManageModal ──────────────────────────────────────────────────────────────
const ManageModal = ({ col, creditBank, jwt, apiFetch, getUser, updateUser, setTrophyData, trophyData, onClose }) => {
  const [tab, setTab] = useState('buy');
  const [confirm, setConfirm] = useState(null); // { type, ... }
  const [swapSources, setSwapSources] = useState([]); // array of pokemon ids
  const [swapTarget, setSwapTarget] = useState(null);
  const [swapBatchSeed, setSwapBatchSeed] = useState(0); // increment to reshuffle
  const [saving, setSaving] = useState(false);

  const caughtPokemon = useMemo(() =>
    ALL_POKEMON.filter(pk => isPkCaught(col[pk.id])),
  [col]);

  const evolveCandidates = useMemo(() =>
    caughtPokemon.filter(pk => {
      if (pkCount(col[pk.id]) < 3) return false;
      const chain = POKEMON_EVOLUTIONS[pk.slug];
      if (!chain || chain.length <= 1) return false;
      const idx = chain.indexOf(pk.slug);
      return idx >= 0 && idx < chain.length - 1; // has next evolution
    }),
  [col, caughtPokemon]);

  const uncaughtPokemon = useMemo(() =>
    ALL_POKEMON.filter(pk => !isPkCaught(col[pk.id])),
  [col]);

  const SWAP_BATCH_SIZE = 12;
  const swapBatch = useMemo(() => {
    if (uncaughtPokemon.length <= SWAP_BATCH_SIZE) return uncaughtPokemon;
    // Fisher-Yates shuffle a copy, take first 12
    const arr = [...uncaughtPokemon];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.slice(0, SWAP_BATCH_SIZE);
  }, [uncaughtPokemon, swapBatchSeed]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveChanges = async (newCol, newCreditBank) => {
    setSaving(true);
    try {
      const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` };
      // Save trophy data
      const newTrophy = { ...trophyData, collection: newCol };
      await apiFetch('/api/trophy', { method: 'PUT', headers, body: JSON.stringify(newTrophy) });
      setTrophyData(newTrophy);
      // Save user data if credits changed
      if (newCreditBank !== undefined) {
        const caught = Object.values(newCol).filter(c => isPkCaught(c)).length;
        updateUser(u => ({ ...u, creditBank: newCreditBank, caught, collection: newCol }));
        await apiFetch('/api/users/me', { method: 'PUT', headers, body: JSON.stringify({ creditBank: newCreditBank, caught }) });
      } else {
        const caught = Object.values(newCol).filter(c => isPkCaught(c)).length;
        updateUser(u => ({ ...u, caught, collection: newCol }));
      }
    } catch (e) {
      console.error('Save failed:', e);
    }
    setSaving(false);
  };

  const doDuplicate = async (pk) => {
    if (creditBank < 3) return;
    const newCol = { ...col, [pk.id]: { ...col[pk.id], count: pkCount(col[pk.id]) + 1 } };
    await saveChanges(newCol, creditBank - 3);
    setConfirm(null);
  };

  const doEvolve = async (pk) => {
    const chain = POKEMON_EVOLUTIONS[pk.slug];
    const idx = chain.indexOf(pk.slug);
    const nextSlug = chain[idx + 1];
    const nextPk = ALL_POKEMON.find(p => p.slug === nextSlug);
    if (!nextPk) return;
    const srcCount = pkCount(col[pk.id]) - 3;
    const tgtEntry = col[nextPk.id] || {};
    const newCol = {
      ...col,
      [pk.id]: { ...col[pk.id], count: srcCount },
      [nextPk.id]: { ...tgtEntry, count: pkCount(tgtEntry) + 1 },
    };
    await saveChanges(newCol);
    setConfirm(null);
  };

  const doSwap = async () => {
    if (swapSources.length !== 3 || !swapTarget) return;
    const newCol = { ...col };
    for (const srcId of swapSources) {
      const c = pkCount(newCol[srcId]) - 1;
      newCol[srcId] = { ...newCol[srcId], count: c };
    }
    const tgtEntry = newCol[swapTarget] || {};
    newCol[swapTarget] = { ...tgtEntry, count: pkCount(tgtEntry) + 1 };
    await saveChanges(newCol);
    setSwapSources([]);
    setSwapTarget(null);
    setConfirm(null);
  };

  const tabBtn = (key, label) => (
    <button
      key={key}
      onClick={() => { setTab(key); setConfirm(null); setSwapSources([]); setSwapTarget(null); }}
      style={{
        width: '100%', padding: '10px 6px', border: 'none', borderRadius: 10, cursor: 'pointer',
        background: tab === key ? C.purple : 'rgba(255,255,255,0.08)',
        color: tab === key ? '#1a1a2e' : C.muted,
        fontWeight: 700, fontSize: 12, transition: 'all 0.15s', textAlign: 'center',
      }}
    >
      {label}
    </button>
  );

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 600, padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#1e1b3a', borderRadius: 20, padding: 20, width: '100%', maxWidth: 480, maxHeight: '85vh', display: 'flex', flexDirection: 'column', animation: 'popIn 0.35s ease', border: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontWeight: 800, fontSize: 18 }}>Manage Trophies</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.muted, fontSize: 20, cursor: 'pointer', padding: 4 }}>✕</button>
        </div>

        <div style={{ display: 'flex', gap: 12, flex: 1, minHeight: 0 }}>
          {/* Side tabs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0, width: 64 }}>
            {tabBtn('buy', 'Buy')}
            {tabBtn('evolve', 'Evolve')}
            {tabBtn('swap', 'Swap')}
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {/* ── Buy tab ── */}
          {tab === 'buy' && (
            <div>
              <div style={{ color: C.muted, fontSize: 13, marginBottom: 12 }}>
                Spend <span style={{ color: C.yellow, fontWeight: 700 }}>3 credits</span> to buy a copy of a caught Pokemon.
                {creditBank < 3 && <span style={{ color: C.red }}> (Not enough credits: {creditBank}/3)</span>}
              </div>
              {confirm?.type === 'buy' ? (
                <div style={{ textAlign: 'center', padding: 16 }}>
                  <img src={pkImg(confirm.pk.slug)} alt={confirm.pk.name} style={{ width: 80, height: 80, objectFit: 'contain' }} />
                  <div style={{ fontWeight: 700, fontSize: 16, marginTop: 8 }}>Spend 3 credits for another {confirm.pk.name}?</div>
                  <div style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>Current count: x{pkCount(col[confirm.pk.id])}</div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'center' }}>
                    <button style={{ ...s.btn(C.yellow, 'sm') }} disabled={saving} onClick={() => doDuplicate(confirm.pk)}>
                      {saving ? 'Saving...' : 'Confirm (-3 credits)'}
                    </button>
                    <button style={{ ...s.btn('rgba(255,255,255,0.12)', 'sm'), color: C.muted }} onClick={() => setConfirm(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  {caughtPokemon.map(pk => {
                    const count = pkCount(col[pk.id]);
                    return (
                      <div
                        key={pk.id}
                        onClick={() => creditBank >= 3 && setConfirm({ type: 'buy', pk })}
                        style={{
                          background: C.card, borderRadius: 10, padding: 8, textAlign: 'center',
                          cursor: creditBank >= 3 ? 'pointer' : 'not-allowed',
                          opacity: creditBank >= 3 ? 1 : 0.5,
                          border: `1px solid ${C.border}`, position: 'relative',
                        }}
                      >
                        {count > 1 && (
                          <div style={{ position: 'absolute', top: 2, right: 4, fontSize: 10, fontWeight: 800, color: C.yellow }}>x{count}</div>
                        )}
                        <img src={pkImg(pk.slug)} alt={pk.name} style={{ width: 40, height: 40, objectFit: 'contain' }} />
                        <div style={{ fontSize: 10, color: '#fff', marginTop: 2 }}>{pk.name}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Evolve tab ── */}
          {tab === 'evolve' && (
            <div>
              <div style={{ color: C.muted, fontSize: 13, marginBottom: 12 }}>
                Trade <span style={{ color: C.yellow, fontWeight: 700 }}>3 of the same</span> Pokemon for its next evolution.
              </div>
              {confirm?.type === 'evolve' ? (() => {
                const chain = POKEMON_EVOLUTIONS[confirm.pk.slug];
                const idx = chain.indexOf(confirm.pk.slug);
                const nextSlug = chain[idx + 1];
                const nextPk = ALL_POKEMON.find(p => p.slug === nextSlug);
                return (
                  <div style={{ textAlign: 'center', padding: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                      <div>
                        <img src={pkImg(confirm.pk.slug)} alt="" style={{ width: 64, height: 64, objectFit: 'contain' }} />
                        <div style={{ fontSize: 12, fontWeight: 700 }}>3x {confirm.pk.name}</div>
                      </div>
                      <span style={{ fontSize: 24, color: C.muted }}>→</span>
                      <div>
                        <img src={pkImg(nextSlug)} alt="" style={{ width: 64, height: 64, objectFit: 'contain' }} />
                        <div style={{ fontSize: 12, fontWeight: 700 }}>1x {nextPk?.name || slugToName(nextSlug)}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'center' }}>
                      <button style={{ ...s.btn(C.green, 'sm') }} disabled={saving} onClick={() => doEvolve(confirm.pk)}>
                        {saving ? 'Saving...' : 'Evolve!'}
                      </button>
                      <button style={{ ...s.btn('rgba(255,255,255,0.12)', 'sm'), color: C.muted }} onClick={() => setConfirm(null)}>Cancel</button>
                    </div>
                  </div>
                );
              })() : evolveCandidates.length === 0 ? (
                <div style={{ color: C.muted, textAlign: 'center', padding: '24px 0' }}>
                  No Pokemon with 3+ copies that can evolve.
                  <br />Duplicate first to get enough copies!
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  {evolveCandidates.map(pk => {
                    const count = pkCount(col[pk.id]);
                    const chain = POKEMON_EVOLUTIONS[pk.slug];
                    const idx = chain.indexOf(pk.slug);
                    const nextSlug = chain[idx + 1];
                    return (
                      <div
                        key={pk.id}
                        onClick={() => setConfirm({ type: 'evolve', pk })}
                        style={{
                          background: C.card, borderRadius: 10, padding: 8, textAlign: 'center',
                          cursor: 'pointer', border: `1px solid ${C.green}`, position: 'relative',
                        }}
                      >
                        <div style={{ position: 'absolute', top: 2, right: 4, fontSize: 10, fontWeight: 800, color: C.yellow }}>x{count}</div>
                        <img src={pkImg(pk.slug)} alt={pk.name} style={{ width: 40, height: 40, objectFit: 'contain' }} />
                        <div style={{ fontSize: 10, color: '#fff', marginTop: 2 }}>{pk.name}</div>
                        <div style={{ fontSize: 9, color: C.green, marginTop: 1 }}>→ {slugToName(nextSlug)}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Swap tab ── */}
          {tab === 'swap' && (
            <div>
              <div style={{ color: C.muted, fontSize: 13, marginBottom: 12 }}>
                Give away <span style={{ color: C.yellow, fontWeight: 700 }}>3 different</span> caught Pokemon to pick any 1 uncaught Pokemon.
              </div>
              {confirm?.type === 'swap' ? (
                <div style={{ textAlign: 'center', padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12 }}>
                    {swapSources.map(id => {
                      const pk = ALL_POKEMON.find(p => p.id === id);
                      return (
                        <div key={id}>
                          <img src={pkImg(pk.slug)} alt="" style={{ width: 48, height: 48, objectFit: 'contain' }} />
                          <div style={{ fontSize: 10 }}>{pk.name}</div>
                        </div>
                      );
                    })}
                    <span style={{ fontSize: 24, color: C.muted }}>→</span>
                    {(() => {
                      const pk = ALL_POKEMON.find(p => p.id === swapTarget);
                      return (
                        <div>
                          <img src={pkImg(pk.slug)} alt="" style={{ width: 48, height: 48, objectFit: 'contain' }} />
                          <div style={{ fontSize: 10 }}>{pk.name}</div>
                        </div>
                      );
                    })()}
                  </div>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                    <button style={{ ...s.btn(C.blue, 'sm') }} disabled={saving} onClick={doSwap}>
                      {saving ? 'Saving...' : 'Swap!'}
                    </button>
                    <button style={{ ...s.btn('rgba(255,255,255,0.12)', 'sm'), color: C.muted }} onClick={() => { setConfirm(null); setSwapSources([]); setSwapTarget(null); }}>Cancel</button>
                  </div>
                </div>
              ) : swapTarget !== null ? (
                // Step 2: already have 3 sources, now picking target — should not reach here but just in case
                null
              ) : (
                <>
                  {/* Step 1 or 2 */}
                  {swapSources.length < 3 ? (
                    <>
                      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8, color: C.yellow }}>
                        Step 1: Select 3 Pokemon to give away ({swapSources.length}/3)
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                        {caughtPokemon.map(pk => {
                          const selected = swapSources.includes(pk.id);
                          return (
                            <div
                              key={pk.id}
                              onClick={() => {
                                if (selected) setSwapSources(swapSources.filter(id => id !== pk.id));
                                else if (swapSources.length < 3) setSwapSources([...swapSources, pk.id]);
                              }}
                              style={{
                                background: selected ? 'rgba(251,191,36,0.15)' : C.card,
                                borderRadius: 10, padding: 8, textAlign: 'center', cursor: 'pointer',
                                border: selected ? `2px solid ${C.yellow}` : `1px solid ${C.border}`,
                                position: 'relative',
                              }}
                            >
                              {pkCount(col[pk.id]) > 1 && (
                                <div style={{ position: 'absolute', top: 2, right: 4, fontSize: 10, fontWeight: 800, color: C.yellow }}>x{pkCount(col[pk.id])}</div>
                              )}
                              <img src={pkImg(pk.slug)} alt={pk.name} style={{ width: 40, height: 40, objectFit: 'contain' }} />
                              <div style={{ fontSize: 10, color: '#fff', marginTop: 2 }}>{pk.name}</div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8, color: C.blue }}>
                        Step 2: Pick 1 Pokemon to receive
                      </div>
                      <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 12, color: C.muted }}>Giving:</span>
                        {swapSources.map(id => {
                          const pk = ALL_POKEMON.find(p => p.id === id);
                          return <span key={id} style={{ fontSize: 12, color: C.yellow }}>{pk.name}</span>;
                        })}
                        <button onClick={() => setSwapSources([])} style={{ fontSize: 11, color: C.red, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Reset</button>
                      </div>
                      {uncaughtPokemon.length === 0 ? (
                        <div style={{ color: C.muted, textAlign: 'center', padding: '24px 0' }}>All Pokemon caught!</div>
                      ) : (
                        <>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                            {swapBatch.map(pk => (
                              <div
                                key={pk.id}
                                onClick={() => { setSwapTarget(pk.id); setConfirm({ type: 'swap' }); }}
                                style={{
                                  background: C.card, borderRadius: 10, padding: 8, textAlign: 'center',
                                  cursor: 'pointer', border: `1px solid ${C.border}`,
                                }}
                              >
                                <img src={pkImg(pk.slug)} alt={pk.name} style={{ width: 40, height: 40, objectFit: 'contain' }} />
                                <div style={{ fontSize: 10, color: '#fff', marginTop: 2 }}>{pk.name}</div>
                              </div>
                            ))}
                          </div>
                          {uncaughtPokemon.length > SWAP_BATCH_SIZE && (
                            <button
                              onClick={() => setSwapBatchSeed(s => s + 1)}
                              style={{ ...s.btn('rgba(255,255,255,0.12)', 'sm'), color: C.muted, width: '100%', marginTop: 10 }}
                            >
                              Next batch ({uncaughtPokemon.length - SWAP_BATCH_SIZE} more available)
                            </button>
                          )}
                        </>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ── TrophyScreen ─────────────────────────────────────────────────────────────
export const TrophyScreen = ({ trophyData, currentUser, setScreen, setGameScreen, jwt, getUser, updateUser, apiFetch, setTrophyData }) => {
  const isAdmin = currentUser === 'admin';
  const [selectedId, setSelectedId] = useState(null);
  const [layout, setLayout] = useState('all'); // 'all' | 'collected'
  const [showManage, setShowManage] = useState(false);

  const col = isAdmin ? {} : (trophyData?.collection || {});
  const regular = isAdmin ? ALL_POKEMON.length : Object.values(col).filter(c => isPkCaught(c)).length;
  const shiny   = isAdmin ? ALL_POKEMON.length : Object.values(col).filter(c => c.shiny).length;

  const selectedPk = selectedId != null ? ALL_POKEMON.find(p => p.id === selectedId) : null;

  const handleCardClick = (id) => setSelectedId(prev => prev === id ? null : id);
  const closeDetail = () => setSelectedId(null);

  const DetailOverlay = () => {
    if (!selectedPk) return null;
    const owned = col[selectedPk.id] || {};
    const isShiny   = isAdmin || owned.shiny;
    const isRegular = isAdmin || isPkCaught(owned);
    const unlocked  = isRegular || isShiny;
    const stats     = POKEMON_STATS[selectedPk.slug];
    const border    = isShiny ? '2px solid #a78bfa' : isRegular ? '2px solid #b45309' : `1px solid ${C.border}`;
    const chain     = POKEMON_EVOLUTIONS[selectedPk.slug] || [selectedPk.slug];

    return (
      <div
        onClick={closeDetail}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, padding: 16 }}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{ background: '#1e1b3a', borderRadius: 20, padding: 24, width: '100%', maxWidth: 320, border, animation: 'popIn 0.35s ease' }}
        >
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <img
              src={isShiny ? pkShiny(selectedPk.slug) : pkImg(selectedPk.slug)}
              alt={selectedPk.name}
              style={{ width: 96, height: 96, objectFit: 'contain', filter: !unlocked ? 'brightness(0) opacity(0.3)' : 'none', animation: 'float 3s ease-in-out infinite' }}
            />
            <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginTop: 8 }}>
              {unlocked ? selectedPk.name : '???'}
            </div>
            {isShiny && <div style={{ color: '#a78bfa', fontWeight: 700, fontSize: 14, marginTop: 2 }}>✨ Shiny</div>}
            {unlocked && pkCount(owned) > 1 && (
              <div style={{ color: C.yellow, fontSize: 13, marginTop: 2 }}>x{pkCount(owned)}</div>
            )}
          </div>

          {/* Evolution chain */}
          {unlocked && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: C.muted, fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Evolution</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, flexWrap: 'wrap' }}>
                {chain.map((slug, i) => {
                  const evoPk = ALL_POKEMON.find(p => p.slug === slug);
                  const evoOwned = evoPk ? (col[evoPk.id] || {}) : {};
                  const evoCaught = isAdmin || isPkCaught(evoOwned);
                  return (
                    <div key={slug} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {i > 0 && <span style={{ fontSize: 14, color: C.muted }}>→</span>}
                      <div style={{ textAlign: 'center', cursor: 'default', width: 52, flexShrink: 0 }} title={evoCaught ? slugToName(slug) : '???'}>
                        <img
                          src={pkImg(slug)}
                          alt={evoCaught ? slugToName(slug) : '???'}
                          style={{
                            width: 44, height: 44, objectFit: 'contain', display: 'block', margin: '0 auto',
                            filter: !evoCaught ? 'brightness(0) opacity(0.3)' : 'none',
                            outline: slug === selectedPk.slug ? '2px solid #fbbf24' : 'none',
                            borderRadius: 4,
                          }}
                        />
                        <div style={{ fontSize: 10, color: slug === selectedPk.slug ? C.yellow : C.muted, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {evoCaught ? slugToName(slug) : '???'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ height: 1, background: 'rgba(255,255,255,0.1)', marginBottom: 16 }} />

          {/* Stats */}
          {unlocked && stats ? (
            <div>
              <div style={{ fontSize: 12, color: C.muted, fontWeight: 600, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>Base Stats</div>
              {STAT_META.map(({ key, label, title, color }) => {
                const val = stats[key] ?? 0;
                return (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <div title={title} style={{ fontSize: 13, color: C.muted, width: 72, textAlign: 'right', flexShrink: 0, cursor: 'help' }}>{label}</div>
                    <div style={{ flex: 1, background: 'rgba(255,255,255,0.1)', borderRadius: 6, height: 10, overflow: 'hidden' }}>
                      <div style={{ width: `${(val / 255) * 100}%`, height: '100%', background: color, borderRadius: 6, transition: 'width 0.4s ease' }} />
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', width: 28, textAlign: 'right', flexShrink: 0 }}>{val}</div>
                  </div>
                );
              })}
            </div>
          ) : unlocked ? (
            <div style={{ color: C.muted, textAlign: 'center', fontSize: 14 }}>No stats available</div>
          ) : (
            <div style={{ color: C.muted, textAlign: 'center', fontSize: 14, padding: '16px 0' }}>Catch this Pokémon to reveal its stats!</div>
          )}

          <button
            style={{ ...s.btn('rgba(255,255,255,0.12)', 'sm'), color: C.muted, width: '100%', marginTop: 20 }}
            onClick={closeDetail}
          >
            Close
          </button>
        </div>
      </div>
    );
  };

  return (
    <div style={{ width: '100%', maxWidth: 600 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <button style={{ ...s.backBtn }} onClick={() => isAdmin ? setScreen('parentMenu') : setGameScreen('home')}>←</button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 18 }}>🏆 Trophies</div>
          <div style={{ color: C.muted, fontSize: 13 }}>{regular} / {ALL_POKEMON.length} caught · {shiny} ✨ shiny</div>
          {isAdmin && <div style={{ color: C.yellow, fontSize: 11, fontWeight: 700, marginTop: 2 }}>👑 Admin preview — all unlocked</div>}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {!isAdmin && (
            <button
              onClick={() => setShowManage(true)}
              style={{ ...s.btn(C.purple, 'sm'), fontSize: 12, padding: '6px 10px' }}
            >
              Manage
            </button>
          )}
          <select
            value={layout}
            onChange={e => { setLayout(e.target.value); setSelectedId(null); }}
            style={{ background: 'rgba(255,255,255,0.12)', color: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 10px', fontSize: 13, fontWeight: 600, cursor: 'pointer', outline: 'none' }}
          >
            <option value="all" style={{ background: '#1e1b3a' }}>All</option>
            <option value="collected" style={{ background: '#1e1b3a' }}>Collected</option>
          </select>
        </div>
      </div>

      <DetailOverlay />

      {showManage && !isAdmin && (
        <ManageModal
          col={col}
          creditBank={getUser()?.creditBank || 0}
          jwt={jwt}
          apiFetch={apiFetch}
          getUser={getUser}
          updateUser={updateUser}
          setTrophyData={setTrophyData}
          trophyData={trophyData}
          onClose={() => setShowManage(false)}
        />
      )}

      {(() => {
        const cols     = layout === 'all' ? 5 : 3;
        const imgSize  = layout === 'all' ? 48 : 72;
        const fontSize = layout === 'all' ? 10 : 13;
        const visiblePokemon = layout === 'collected'
          ? ALL_POKEMON.filter(pk => { const o = col[pk.id] || {}; return isAdmin || isPkCaught(o); })
          : ALL_POKEMON;

        if (layout === 'collected' && visiblePokemon.length === 0) {
          return <div style={{ color: C.muted, textAlign: 'center', padding: '40px 0' }}>No Pokémon caught yet — complete a round to earn credits!</div>;
        }

        return (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 8 }}>
            {visiblePokemon.map(pk => {
              const owned = col[pk.id] || {};
              const isShiny    = isAdmin || owned.shiny;
              const isRegular  = isAdmin || isPkCaught(owned);
              const unlocked   = isRegular || isShiny;
              const isSelected = selectedId === pk.id;
              const border     = isShiny ? '2px solid #a78bfa' : isRegular ? '2px solid #b45309' : `1px solid ${C.border}`;
              const count      = pkCount(owned);

              return (
                <div
                  className="trophy-card"
                  key={pk.id}
                  onClick={() => handleCardClick(pk.id)}
                  style={{
                    background: C.card, borderRadius: 12, padding: layout === 'all' ? 8 : 12,
                    textAlign: 'center', position: 'relative', cursor: 'pointer', border,
                    animation: isShiny ? 'shimmer 2s ease infinite' : 'none',
                    transform: isSelected ? 'scale(1.05)' : 'scale(1)',
                    transition: 'transform 0.15s',
                    outline: isSelected ? `2px solid ${C.yellow}` : 'none',
                  }}
                >
                  {isShiny && <div style={{ position: 'absolute', top: 4, right: 6, fontSize: layout === 'all' ? 11 : 14 }}>✨</div>}
                  {count > 1 && !isAdmin && (
                    <div style={{ position: 'absolute', top: 4, left: 6, fontSize: layout === 'all' ? 9 : 11, fontWeight: 800, color: C.yellow }}>x{count}</div>
                  )}
                  <img
                    src={isShiny ? pkShiny(pk.slug) : pkImg(pk.slug)}
                    alt={pk.name}
                    style={{ width: imgSize, height: imgSize, objectFit: 'contain', filter: !unlocked ? 'brightness(0) opacity(0.3)' : 'none' }}
                  />
                  <div style={{ fontSize, color: isShiny ? '#a78bfa' : unlocked ? '#fff' : C.muted, marginTop: 4, lineHeight: 1.3, fontWeight: isShiny ? 700 : layout === 'all' ? 400 : 600 }}>
                    {unlocked ? (isShiny ? `✨ ${pk.name}` : pk.name) : '???'}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}
    </div>
  );
};
