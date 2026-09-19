import { TEXT_LINE_HEIGHT } from './constants'

export { TEXT_LINE_HEIGHT }

/** Horizontal padding as a fraction of font size — 4px at the default 16px type. */
export function textPadX(fontSizePx: number): number {
  return Math.max(2, fontSizePx * 0.25)
}

/** Vertical padding as a fraction of font size — 2px at the default 16px type. */
export function textPadY(fontSizePx: number): number {
  return Math.max(1, fontSizePx * 0.125)
}

export function textLineHeight(fontSizePx: number): number {
  return fontSizePx * TEXT_LINE_HEIGHT
}

/**
 * Wrap like CSS `white-space: pre-wrap` plus `overflow-wrap: break-word`:
 * keep newlines, wrap on whitespace, and split a token that cannot fit.
 */
export function wrapTextLines(
  text: string,
  maxWidth: number,
  measure: (value: string) => number
): string[] {
  const paragraphs = text.split('\n')
  const lines: string[] = []
  for (const paragraph of paragraphs) {
    if (paragraph === '') {
      lines.push('')
      continue
    }
    if (maxWidth <= 0) {
      lines.push(paragraph)
      continue
    }
    const tokens = paragraph.match(/\s+|\S+/g) ?? [paragraph]
    let line = ''
    for (const token of tokens) {
      const candidate = line + token
      if (line !== '' && measure(candidate) > maxWidth) {
        lines.push(line.trimEnd())
        if (/^\s+$/.test(token)) {
          line = ''
          continue
        }
        line = ''
      }
      if (line === '' && measure(token) > maxWidth && /\S/.test(token)) {
        const chunks = splitToWidth(token, maxWidth, measure)
        lines.push(...chunks.slice(0, -1))
        line = chunks[chunks.length - 1] ?? ''
        continue
      }
      line += token
    }
    lines.push(line.trimEnd())
  }
  return lines
}

function splitToWidth(
  token: string,
  maxWidth: number,
  measure: (value: string) => number
): string[] {
  const chunks: string[] = []
  let start = 0
  while (start < token.length) {
    let lo = 1
    let hi = token.length - start
    let fit = 1
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      if (mid === 1 || measure(token.slice(start, start + mid)) <= maxWidth) {
        fit = mid
        lo = mid + 1
      } else {
        hi = mid - 1
      }
    }
    chunks.push(token.slice(start, start + fit))
    start += fit
  }
  return chunks.length > 0 ? chunks : [token]
}
