import { useState } from 'react';
import { ALL_POKEMON, pkImg, pkShiny } from '../data/pokemon';
import POKEMON_STATS from '../data/pokemon-stats.json';
import POKEMON_EVOLUTIONS from '../data/pokemon-evolutions.json';
import { C, s } from '../shared';

const STAT_META = [
  { key: 'hp',  label: 'HP',              title: 'Hit Points — how much damage this Pokémon can take before fainting',        color: '#ef4444' },
  { key: 'atk', label: 'Attack',          title: 'Attack — strength of physical moves like Tackle or Earthquake',             color: '#f97316' },
  { key: 'def', label: 'Defense',         title: 'Defense — resistance to physical moves; higher = less damage taken',        color: '#eab308' },
  { key: 'spa', label: 'Sp. Attack',      title: 'Special Attack — strength of special moves like Flamethrower or Surf',      color: '#60a5fa' },
  { key: 'spd', label: 'Sp. Defense',     title: 'Special Defense — resistance to special moves; higher = less damage taken', color: '#10b981' },
  { key: 'spe', label: 'Speed',           title: 'Speed — determines who attacks first; higher = moves before the opponent',  color: '#c4b5fd' },
];

export const CollectionScreen = ({ getUser, currentUser, setScreen, setGameScreen }) => {
  const user = getUser();
  const isAdmin = currentUser === 'test';
  const col = user?.collection || {};
  const regular = isAdmin ? ALL_POKEMON.length : Object.values(col).filter(c => c.regular).length;
  const shiny   = isAdmin ? ALL_POKEMON.length : Object.values(col).filter(c => c.shiny).length;
  const [selectedId, setSelectedId] = useState(null);
  const [layout, setLayout] = useState('all'); // 'all' | 'collected'

  const selectedPk = selectedId != null ? ALL_POKEMON.find(p => p.id === selectedId) : null;

  const handleCardClick = (id) => setSelectedId(prev => prev === id ? null : id);
  const closeDetail = () => setSelectedId(null);

  const DetailOverlay = () => {
    if (!selectedPk) return null;
    const owned = col[selectedPk.id] || {};
    const isShiny   = isAdmin || owned.shiny;
    const isRegular = isAdmin || owned.regular;
    const unlocked  = isRegular || isShiny;
    const stats     = POKEMON_STATS[selectedPk.slug];
    const border    = isShiny ? '2px solid #a78bfa' : isRegular ? '2px solid #b45309' : `1px solid ${C.border}`;
    const chain     = POKEMON_EVOLUTIONS[selectedPk.slug] || [selectedPk.slug];
    const slugToName = slug => slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, ' ');

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
          </div>

          {/* Evolution chain */}
          {unlocked && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: C.muted, fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Evolution</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, flexWrap: 'wrap' }}>
                {chain.map((slug, i) => (
                  <div key={slug} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {i > 0 && <span style={{ fontSize: 14, color: C.muted }}>→</span>}
                    <div style={{ textAlign: 'center', cursor: 'default' }} title={slugToName(slug)}>
                      <img
                        src={pkImg(slug)}
                        alt={slugToName(slug)}
                        style={{
                          width: 44, height: 44, objectFit: 'contain', display: 'block',
                          outline: slug === selectedPk.slug ? '2px solid #fbbf24' : 'none',
                          borderRadius: 4,
                        }}
                      />
                      <div style={{ fontSize: 10, color: slug === selectedPk.slug ? C.yellow : C.muted, marginTop: 2, maxWidth: 44, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {slugToName(slug)}
                      </div>
                    </div>
                  </div>
                ))}
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
        <button style={{ ...s.btn('rgba(255,255,255,0.1)', 'sm'), color: C.muted }} onClick={() => isAdmin ? setScreen('parentMenu') : setGameScreen('home')}>← Back</button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 18 }}>🏆 Collection</div>
          <div style={{ color: C.muted, fontSize: 13 }}>{regular} / {ALL_POKEMON.length} caught · {shiny} ✨ shiny</div>
          {isAdmin && <div style={{ color: C.yellow, fontSize: 11, fontWeight: 700, marginTop: 2 }}>👑 Admin preview — all unlocked</div>}
        </div>
        <select
          value={layout}
          onChange={e => { setLayout(e.target.value); setSelectedId(null); }}
          style={{ background: 'rgba(255,255,255,0.12)', color: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 10px', fontSize: 13, fontWeight: 600, cursor: 'pointer', outline: 'none' }}
        >
          <option value="all" style={{ background: '#1e1b3a' }}>All</option>
          <option value="collected" style={{ background: '#1e1b3a' }}>Collected</option>
        </select>
      </div>
      {user?.shinyEligible && (
        <div style={{ color: '#a78bfa', textAlign: 'center', animation: 'pulse 1.5s ease infinite', marginBottom: 12, fontWeight: 700 }}>✨ Shiny chance active!</div>
      )}

      <DetailOverlay />

      {(() => {
        const cols     = layout === 'all' ? 5 : 3;
        const imgSize  = layout === 'all' ? 48 : 72;
        const fontSize = layout === 'all' ? 10 : 13;
        const visiblePokemon = layout === 'collected'
          ? ALL_POKEMON.filter(pk => { const o = col[pk.id] || {}; return isAdmin || o.regular || o.shiny; })
          : ALL_POKEMON;

        if (layout === 'collected' && visiblePokemon.length === 0) {
          return <div style={{ color: C.muted, textAlign: 'center', padding: '40px 0' }}>No Pokémon caught yet — complete a round to earn credits!</div>;
        }

        return (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 8 }}>
            {visiblePokemon.map(pk => {
              const owned = col[pk.id] || {};
              const isShiny    = isAdmin || owned.shiny;
              const isRegular  = isAdmin || owned.regular;
              const unlocked   = isRegular || isShiny;
              const isSelected = selectedId === pk.id;
              const border     = isShiny ? '2px solid #a78bfa' : isRegular ? '2px solid #b45309' : `1px solid ${C.border}`;

              return (
                <div
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
                  <img
                    src={isShiny ? pkShiny(pk.slug) : pkImg(pk.slug)}
                    alt={pk.name}
                    style={{ width: imgSize, height: imgSize, objectFit: 'contain', filter: !unlocked ? 'brightness(0) opacity(0.3)' : 'none' }}
                  />
                  <div style={{ fontSize, color: unlocked ? '#fff' : C.muted, marginTop: 4, lineHeight: 1.3, fontWeight: layout === 'all' ? 400 : 600 }}>
                    {unlocked ? pk.name : '???'}
                  </div>
                  {isShiny && <div style={{ fontSize: layout === 'all' ? 9 : 11, fontWeight: 700, color: '#a78bfa', marginTop: 2 }}>✨ SHINY</div>}
                </div>
              );
            })}
          </div>
        );
      })()}
    </div>
  );
};
