import { extractTemplates, cleanWikitext } from './wikitext.js'

// One record per event/distribution entry template. Both page families use
// one template per entry whose name contains "event" and has pokemon=.
export const parseEventEntries = (wikitext) => {
  const entries = []
  for (const template of extractTemplates(wikitext)) {
    if (!/event/i.test(template.name) || !template.params.pokemon) continue
    entries.push({
      template: template.name,
      pokemon: cleanWikitext(template.params.pokemon),
      ndex: template.params.ndex ? parseInt(template.params.ndex, 10) : null,
      level: template.params.level ?? null,
      game: template.params.game ?? null,
      method: cleanWikitext(template.params.method ?? template.params.obtain ?? ''),
      met: cleanWikitext(template.params.met ?? ''),
      gift: template.params.gift === 'yes',
    })
  }
  return entries
}
