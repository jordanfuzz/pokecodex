import { cleanWikitext } from './wikitext.js'

const MSP = /\{\{MSP\/3\|(\d+)\|([^}|]+)(?:\|[^}]*)?\}\}/g
// ALLCAPS-ish nicknames, max 12 chars in-game (accented caps included)
const NICKNAME = /^[A-Z0-9ÉÀ-Þ .'♀♂-]{2,12}$/

// Best-effort parse of the "List of in-game trades" page. One record per
// table row naming two pokemon via {{MSP/3|ndex|Name}}: the first is what
// the player gives, the second what they receive. Rows that mention MSP/3
// but don't parse go to `unparsed` — never silently dropped.
export const parseTrades = (wikitext) => {
  const trades = []
  const unparsed = []
  let heading = ''
  let location = null
  let row = []

  const flushRow = () => {
    if (row.length === 0) return
    const cells = row
      .flatMap((line) => line.split('||'))
      .map((cell) => cell.replace(/^[|!]\s*/, '').replace(/^[^|]*\|\s*(?=\{\{|\[\[)/, '').trim())
    const rowText = cells.join(' | ')
    const msp = [...rowText.matchAll(MSP)]
    const firstMspCell = cells.findIndex((cell) => /MSP\/3/.test(cell))
    if (firstMspCell > 0) {
      const before = cells.slice(0, firstMspCell).map(cleanWikitext).filter(Boolean)
      if (before.length) location = before.join(', ')
    }
    if (msp.length >= 2) {
      const nickname = cells
        .slice(firstMspCell)
        .map(cleanWikitext)
        .find((cell) => NICKNAME.test(cell))
      trades.push({
        heading,
        location,
        gives: { ndex: parseInt(msp[0][1], 10), name: msp[0][2].trim() },
        receives: { ndex: parseInt(msp[1][1], 10), name: msp[1][2].trim() },
        nickname: nickname ?? null,
      })
    } else if (/MSP\/3/.test(rowText)) {
      unparsed.push({ heading, rowText })
    }
    row = []
  }

  for (const line of wikitext.split('\n')) {
    const headingMatch = line.match(/^(=+)\s*(.*?)\s*\1$/)
    if (headingMatch) {
      flushRow()
      heading = headingMatch[2]
      location = null
      continue
    }
    if (/^(\|-|\|\}|\{\|)/.test(line)) {
      flushRow()
      continue
    }
    if (/^[|!]/.test(line)) row.push(line)
    else if (row.length) row[row.length - 1] += ` ${line.trim()}`
  }
  flushRow()
  return { trades, unparsed }
}
