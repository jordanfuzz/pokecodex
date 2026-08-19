// Map differ output to staged_sources-shaped rows. Pure: the staging script
// owns fs/DB, this owns the mapping, so tests run without cache or DB.
import { createHash } from 'node:crypto'

export const PARSER_VERSION = '2026-08-18.1'

// Source types that cannot appear in Bulbapedia availability data (the
// pokewalker rows were hand-gathered from Serebii). Their unmatched rows
// are expected, not errors — the review page hides them by default.
const EXPECTED_ABSENT_TYPES = ['pokewalker']

// The game is deliberately excluded: per-version duplicates (a Ruby and a
// Sapphire row of one gift) share a key and collapse into one staged row.
// Nickname is included: the differ branches on candidate.nickname before
// scoring, so two candidates sharing (origin, pokemonId, gen, area) but with
// different nicknames (e.g. two distinct in-game trades) must not collapse.
export const candidateKey = (candidate) =>
  createHash('sha1')
    .update(['candidate', candidate.origin, candidate.pokemonId, candidate.gen, candidate.area, candidate.nickname ?? ''].join(' '))
    .digest('hex')

// First match wins; keep npc-trade above gift (trade entries often carry
// gift-ish language) and event pages above their method text.
const TYPE_GUESSES = [
  ['npc-trade', (c) => c.origin === 'trades' || c.reasons.includes('npc trade') || c.reasons.includes('trade language')],
  ['starter', (c) => c.reasons.includes('starter')],
  ['fossil', (c) => c.reasons.includes('fossil')],
  ['honey-tree', (c) => c.reasons.includes('honey tree')],
  ['event', (c) => c.origin === 'event-list' || c.origin === 'distribution' || c.reasons.includes('links to event list')],
  ['prize', (c) => c.reasons.includes('prize')],
  ['side-game', (c) => c.origin === 'side-games' || c.reasons.includes('shadow snag') || c.reasons.includes('side-game completion prize')],
  ['gift', (c) => c.reasons.includes('gift language')],
]
export const guessSourceType = (candidate) =>
  TYPE_GUESSES.find(([, test]) => test(candidate))?.[0] ?? 'special'

const NAME_LABELS = {
  'npc-trade': 'in-game trade', 'honey-tree': 'honey tree', 'side-game': 'side game',
  'static-default': 'static', gift: 'gift', starter: 'starter', fossil: 'fossil',
  event: 'event', prize: 'prize', special: 'special',
}

const MEDIUM_CONFIDENCE_ORIGINS = ['trades', 'event-list', 'distribution']
const confidenceFor = (candidate, matchKind = null) => {
  if (matchKind === 'nickname') return 'high'
  return MEDIUM_CONFIDENCE_ORIGINS.includes(candidate.origin) ? 'medium' : 'low'
}

export const buildStagedRows = ({ matched, missing, suggestions, unmatchedExisting }, { pokemonNames }) => {
  const rows = []
  const warnings = []

  // Group candidate-bearing entries by natural key. A key can't appear in
  // both matched and missing: identical (origin, pokemonId, gen, area,
  // nickname) candidates see the same pool and scores, so they diff
  // identically — nickname is part of the key precisely because the differ
  // branches on it before scoring.
  const groups = new Map()
  const groupFor = (candidate) => {
    const key = candidateKey(candidate)
    if (!groups.has(key)) groups.set(key, { key, candidates: [], matches: [] })
    const group = groups.get(key)
    group.candidates.push(candidate)
    return group
  }
  for (const entry of matched) groupFor(entry.candidate).matches.push(entry)
  for (const candidate of missing) groupFor(candidate)

  const suggestionByKey = new Map()
  for (const suggestion of suggestions) {
    const key = candidateKey(suggestion.candidate)
    const current = suggestionByKey.get(key)
    if (!current || suggestion.score > current.score) suggestionByKey.set(key, suggestion)
  }

  for (const group of groups.values()) {
    const [candidate] = group.candidates
    const games = [...new Set(group.candidates.map((c) => c.game || c.origin))]
    const sourceType = guessSourceType(candidate)
    const pokemonName = pokemonNames.get(candidate.pokemonId) ?? `#${candidate.pokemonId}`
    const bestMatch = group.matches.toSorted((a, b) => b.score - a.score)[0] ?? null
    if (bestMatch && new Set(group.matches.map((m) => m.source.id)).size > 1) {
      warnings.push(`group ${group.key} (${pokemonName} gen ${candidate.gen}) matched multiple sources; kept best`)
    }
    const suggestion = bestMatch ? null : suggestionByKey.get(group.key) ?? null
    rows.push({
      naturalKey: group.key,
      rowKind: bestMatch ? 'audit' : 'new',
      pokemonId: candidate.pokemonId,
      name: candidate.nickname ?? `${pokemonName} — ${games.join('/')} ${NAME_LABELS[sourceType] ?? sourceType}`,
      description: candidate.area,
      image: null,
      gen: candidate.gen,
      source: sourceType,
      replaceDefault: false,
      confidence: confidenceFor(candidate, bestMatch?.matchKind ?? null),
      matchedSourceId: bestMatch?.source.id ?? null,
      suggestedSourceId: suggestion?.source.id ?? null,
      suggestionReason: suggestion?.reason ?? null,
      expectedAbsent: false,
      pageTitle: candidate.pageTitle ?? null,
      revid: candidate.revid ?? null,
      rawSnippet: candidate.rawArea ?? candidate.area,
      origin: candidate.origin,
      games,
      parserVersion: PARSER_VERSION,
    })
  }

  for (const source of unmatchedExisting) {
    rows.push({
      naturalKey: `existing:${source.id}`,
      rowKind: 'existing-unmatched',
      pokemonId: source.pokemonId,
      name: null, description: null, image: null,
      gen: source.gen,
      source: null, replaceDefault: null, confidence: null,
      matchedSourceId: source.id,
      suggestedSourceId: null, suggestionReason: null,
      expectedAbsent: EXPECTED_ABSENT_TYPES.includes(source.source),
      pageTitle: null, revid: null,
      // Snapshot so the audit trail survives a guarded delete, which nulls
      // matched_source_id before removing the sources row.
      rawSnippet: JSON.stringify(source),
      origin: null, games: null,
      parserVersion: PARSER_VERSION,
    })
  }

  return { rows, warnings }
}
