// Wikitext template parsing. Pure functions, no I/O.

// Split on top-level pipes, ignoring pipes nested inside {{ }} or [[ ]].
const splitTopLevel = (body) => {
  const parts = []
  let depth = 0
  let current = ''
  for (let i = 0; i < body.length; i++) {
    const pair = body.slice(i, i + 2)
    if (pair === '{{' || pair === '[[') {
      depth++
      current += pair
      i++
    } else if ((pair === '}}' || pair === ']]') && depth > 0) {
      depth--
      current += pair
      i++
    } else if (body[i] === '|' && depth === 0) {
      parts.push(current)
      current = ''
    } else {
      current += body[i]
    }
  }
  parts.push(current)
  return parts
}

// Parse the inside of one {{...}}. Named params land on params[key];
// positional ones on params[1], params[2], ...
export const parseTemplate = (body) => {
  const parts = splitTopLevel(body)
  const params = {}
  let position = 0
  for (const part of parts.slice(1)) {
    const eq = part.indexOf('=')
    const nesting = part.search(/\{\{|\[\[/)
    if (eq !== -1 && (nesting === -1 || eq < nesting)) {
      params[part.slice(0, eq).trim()] = part.slice(eq + 1).trim()
    } else {
      params[++position] = part.trim()
    }
  }
  return { name: parts[0].trim(), params }
}

// Every top-level {{...}} template in `text`, in document order.
export const extractTemplates = (text) => {
  const templates = []
  let depth = 0
  let start = -1
  for (let i = 0; i < text.length; i++) {
    if (text.startsWith('{{', i)) {
      if (depth === 0) start = i
      depth++
      i++
    } else if (text.startsWith('}}', i) && depth > 0) {
      depth--
      i++
      if (depth === 0) templates.push(parseTemplate(text.slice(start + 2, i - 1)))
    }
  }
  return templates
}

// Inline template handlers. Anything absent falls back to its last
// positional param, which covers {{p|X}}, {{pkmn|a|label}}, {{OBP|..|label}},
// {{ga|Red}}, etc. Handlers exist only where the last positional param is
// NOT the desired label (gdis/rt end in a gen numeral or region) or a fixed
// word fits better.
const INLINE_TEMPLATES = {
  rt: (p) => `Route ${p[1]}`,
  gdis: (p) => p[1],
  dl: (p) => p[3] ?? p[2],
  color2: (p) => p[3] ?? p[2],
  safari: () => 'Safari Zone',
  player: () => 'the player',
  j: () => '',
  sup: () => '',
  tt: (p) => p[1] ?? '',
  tm: (p) => (p[2] ? `TM${p[1]} (${p[2]})` : `TM${p[1]}`),
}

const lastPositional = (name, params) => {
  const keys = Object.keys(params).filter((key) => /^\d+$/.test(key))
  return keys.length ? params[keys[keys.length - 1]] : name
}

export const cleanWikitext = (raw) => {
  let text = raw.replace(/<!--[\s\S]*?-->/g, '')
  const innermost = /\{\{([^{}]*)\}\}/
  for (let match; (match = text.match(innermost)); ) {
    const { name, params } = parseTemplate(match[1])
    const handler = INLINE_TEMPLATES[name.toLowerCase()]
    const replacement = handler ? handler(params) ?? '' : lastPositional(name, params)
    text = text.slice(0, match.index) + replacement + text.slice(match.index + match[0].length)
  }
  return text
    .replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, '$1')
    .replace(/\[\[([^\]]*)\]\]/g, '$1')
    .replace(/'''?/g, '')
    .replace(/<br\s*\/?>/gi, '; ')
    .replace(/<\/?[a-z][^>]*>/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}
