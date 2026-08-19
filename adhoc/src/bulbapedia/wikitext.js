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
