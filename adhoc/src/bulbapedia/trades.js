import { cleanWikitext } from './wikitext.js'

// MSP/3, MSP/6, MSP/8c, MSP/9, MSP/PE, MSP/BDSP, MSP/ZA, etc. — the template
// is per-generation. The optional letter after the ndex tolerates
// form-suffixed dex numbers like 550B|Basculin, keeping the numeric part.
const MSP = /\{\{MSP\/[^|]+\|(\d+)[A-Za-z]?\|([^}|]+)(?:\|[^}]*)?\}\}/g
const MSP_ANY = /\{\{MSP\//
// Nicknames can be proper-case from gen III+ on, not just ALLCAPS; must
// contain a letter (excludes Trainer-ID/Level cells that are pure digits)
// and must not just be the species name repeated in a later cell.
const NICKNAME = /^[A-Za-zÀ-ÿ0-9 .'♀♂-]{2,12}$/

// Best-effort parse of the "List of in-game trades" page. One record per
// table row naming two pokemon via {{MSP/<gen>|ndex|Name}}: the first is
// what the player gives, the second what they receive. Rows that mention
// MSP/ but don't parse go to `unparsed` — never silently dropped.
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
      .map((cell) =>
        cell
          .replace(/^[|!]\s*/, '')
          .replace(/^(?:[\w-]+=(?:"[^"]*"|\S+)\s*)+\|\s*/, '')
          .trim(),
      )
    const rowText = cells.join(' | ')
    const msp = [...rowText.matchAll(MSP)]
    const firstMspCell = cells.findIndex((cell) => MSP_ANY.test(cell))
    if (firstMspCell > 0) {
      const before = cells.slice(0, firstMspCell).map(cleanWikitext).filter(Boolean)
      if (before.length) location = before.join(', ')
    }
    if (msp.length >= 2) {
      const gives = { ndex: parseInt(msp[0][1], 10), name: msp[0][2].trim() }
      const receives = { ndex: parseInt(msp[1][1], 10), name: msp[1][2].trim() }
      const nickname = cells
        .slice(firstMspCell)
        .map(cleanWikitext)
        .find(
          (cell) =>
            NICKNAME.test(cell) &&
            /[A-Za-zÀ-ÿ]/.test(cell) &&
            cell.toLowerCase() !== gives.name.toLowerCase() &&
            cell.toLowerCase() !== receives.name.toLowerCase(),
        )
      trades.push({
        heading,
        location,
        gives,
        receives,
        nickname: nickname ?? null,
      })
    } else if (MSP_ANY.test(rowText)) {
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
    if (/^\{\|/.test(line)) {
      flushRow()
      location = null
      continue
    }
    if (/^(\|-|\|\})/.test(line)) {
      flushRow()
      continue
    }
    if (/^[|!]/.test(line)) row.push(line)
    else if (row.length) row[row.length - 1] += ` ${line.trim()}`
  }
  flushRow()
  return { trades, unparsed }
}
