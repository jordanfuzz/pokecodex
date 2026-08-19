import { extractTemplates, cleanWikitext } from './wikitext.js'
import { resolveGame, ROMAN } from './games.js'

// Pull one wiki section: from its heading to the next heading of the same or
// higher level. Title is matched case-insensitively as a whole heading.
export const extractSection = (wikitext, title) => {
  const heading = wikitext.match(new RegExp(`^(=+)\\s*${title}\\s*\\1\\s*$`, 'mi'))
  if (!heading) return null
  const level = heading[1].length
  const rest = wikitext.slice(heading.index + heading[0].length)
  const next = rest.match(new RegExp(`^={2,${level}}[^=]`, 'm'))
  return next ? rest.slice(0, next.index) : rest
}

const ENTRY = /^Availability\/Entry(\d)(\/None)?$/

export const parseGameLocations = (wikitext) => {
  const section = extractSection(wikitext, 'Game locations')
  if (!section) return { entries: [], warnings: ['no Game locations section'] }

  const entries = []
  const warnings = []
  let gen = null
  let subsection = 'core'

  for (const chunk of section.split(/^(====[^=].*?====)\s*$/m)) {
    const heading = chunk.match(/^====\s*(.*?)\s*====$/)
    if (heading) {
      subsection = heading[1].toLowerCase()
      gen = null
      continue
    }
    for (const template of extractTemplates(chunk.replace(/<!--[\s\S]*?-->/g, ''))) {
      if (template.name === 'Availability/Gen') {
        gen = ROMAN[template.params.gen] ?? null
        if (gen === null) warnings.push(`unknown gen numeral: ${template.params.gen}`)
        continue
      }
      const entryMatch = template.name.match(ENTRY)
      if (!entryMatch) continue
      const none = !!entryMatch[2]
      const versions = ['v', 'v2', 'v3', 'v4', 'v5']
        .map((key) => template.params[key])
        .filter(Boolean)
      if (versions.length === 0) {
        warnings.push(`entry with no versions in ${subsection}`)
        continue
      }
      const rawArea = template.params.area ?? ''
      for (const version of versions) {
        entries.push({
          game: version,
          gameInfo: resolveGame(version),
          gen,
          subsection,
          none,
          rawArea,
          area: cleanWikitext(rawArea),
        })
      }
    }
  }
  return { entries, warnings }
}
