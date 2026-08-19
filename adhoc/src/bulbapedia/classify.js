// Classify an availability entry as a unique-source candidate or generic
// availability. Recall over precision: the recon report (and later the
// review gate) is where false positives get culled, so patterns err broad.
export const UNIQUE_PATTERNS = [
  { rx: /list of in-game event pokémon/i, reason: 'links to event list', on: 'raw' },
  { rx: /first partner|starter/i, reason: 'starter' },
  { rx: /received|gift|given|reward/i, reason: 'gift language' },
  { rx: /in-game trade|trade with|traded (?:for|from)/i, reason: 'npc trade' },
  { rx: /\btrade\b/i, reason: 'trade language' },
  { rx: /\(shadow\)|snag/i, reason: 'shadow snag' },
  { rx: /game corner|prize|lottery/i, reason: 'prize' },
  { rx: /fossil/i, reason: 'fossil' },
  { rx: /honey tree/i, reason: 'honey tree' },
  { rx: /only one|one per (?:save|game)/i, reason: 'explicit only-one' },
  { rx: /beat(?:ing)? the|defeat(?:ing)?.*(?:round|castle|cup|mode)|collect(?:ing)? all|for the first time/i, reason: 'side-game completion prize' },
]

export const classifyEntry = (entry) => {
  if (entry.none) return { kind: 'unavailable', reasons: [] }
  if (!entry.gameInfo.tracked) return { kind: 'untracked-game', reasons: [] }
  const reasons = UNIQUE_PATTERNS.filter(({ rx, on }) =>
    rx.test(on === 'raw' ? entry.rawArea : entry.area)
  ).map(({ reason }) => reason)
  return reasons.length ? { kind: 'unique-candidate', reasons } : { kind: 'generic', reasons: [] }
}
