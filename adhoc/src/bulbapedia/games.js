// Bulbapedia Availability `v=` names -> game_versions rows.
// Ids verified against the game_versions table (2026-08 prod dump).
const GAMES = {
  Red: { id: 1, gen: 1 },
  Blue: { id: 2, gen: 1 },
  Yellow: { id: 3, gen: 1 },
  Gold: { id: 4, gen: 2 },
  Silver: { id: 5, gen: 2 },
  Crystal: { id: 6, gen: 2 },
  Ruby: { id: 7, gen: 3 },
  Sapphire: { id: 8, gen: 3 },
  Emerald: { id: 9, gen: 3 },
  Colosseum: { id: 10, gen: 3 },
  XD: { id: 11, gen: 3 },
  FireRed: { id: 12, gen: 3 },
  LeafGreen: { id: 13, gen: 3 },
  Diamond: { id: 14, gen: 4 },
  Pearl: { id: 15, gen: 4 },
  Platinum: { id: 16, gen: 4 },
  HeartGold: { id: 17, gen: 4 },
  SoulSilver: { id: 18, gen: 4 },
  Black: { id: 19, gen: 5 },
  White: { id: 20, gen: 5 },
  'Black 2': { id: 21, gen: 5 },
  'White 2': { id: 22, gen: 5 },
  X: { id: 23, gen: 6 },
  Y: { id: 24, gen: 6 },
  'Omega Ruby': { id: 25, gen: 6 },
  'Alpha Sapphire': { id: 26, gen: 6 },
  Sun: { id: 27, gen: 7 },
  Moon: { id: 28, gen: 7 },
  'Ultra Sun': { id: 29, gen: 7 },
  'Ultra Moon': { id: 30, gen: 7 },
  "Let's Go Pikachu": { id: 31, gen: 7 },
  "Let's Go Eevee": { id: 32, gen: 7 },
  Sword: { id: 33, gen: 8 },
  Shield: { id: 34, gen: 8 },
  'Brilliant Diamond': { id: 35, gen: 8 },
  'Shining Pearl': { id: 36, gen: 8 },
  'Legends Arceus': { id: 37, gen: 8 },
  'Legends: Arceus': { id: 37, gen: 8 },
  Scarlet: { id: 47, gen: 9 },
  Violet: { id: 48, gen: 9 },
  // tracked spinoffs (appear in the "In side games" section)
  Stadium: { id: 38, gen: 1 },
  'Stadium 2': { id: 39, gen: 2 },
  Channel: { id: 40, gen: 3 },
  Box: { id: 41, gen: 3 },
  Ranch: { id: 42, gen: 4 },
  Ranger: { id: 43, gen: 4 },
  'Ranger: SoA': { id: 44, gen: 4 },
  'Ranger: GS': { id: 45, gen: 4 },
  'Battle Revolution': { id: 46, gen: 4 },
}

// Untracked games/rows we expect to see; anything else untracked is warned
// about in the recon report so the map can be extended deliberately.
const KNOWN_UNTRACKED = [
  /^MD /, /^Trozei/, /^Pinball/, /^Snap/, /^New Snap/, /^Dash/, /^PokéPark/,
  /^Rumble/, /^Shuffle/, /^Picross/, /^Conquest/, /^Duel/, /^Quest/, /^Sleep/,
  /^Masters/, /^Café/, /^UNITE/, /^Magikarp Jump/, /^GO$/, /^HOME$/, /^Bank$/,
  /^Dream World$/, /^Dream Radar$/, /^Pal Park$/, /^Pokéwalker$/,
  /^Mystery Dungeon/, /^Legends Z-A$/, /^Z-A$/, /^Smile$/, /^Playhouse/,
]

export const ROMAN = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9 }

export const resolveGame = (v) => {
  const game = GAMES[v]
  if (game) return { name: v, tracked: true, ...game }
  return { name: v, tracked: false, expected: KNOWN_UNTRACKED.some((rx) => rx.test(v)) }
}
