import type { TemplateContext } from './types'

const TOKEN_PATTERN = /\{(student|subject|originalName|title|date|year|month|day)\}/g

export function sanitizePathSegment(value: string, fallback = 'Untitled'): string {
  const cleaned = [...value]
    .map((ch) => {
      const code = ch.charCodeAt(0)
      if (code < 32 || '<>:"/\\|?*'.includes(ch)) return ' '
      return ch
    })
    .join('')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/g, '')
    .trim()
  return cleaned.length > 0 ? cleaned : fallback
}

export function applyTemplate(template: string, context: TemplateContext): string {
  return template.replace(TOKEN_PATTERN, (_, token: keyof TemplateContext) => {
    return sanitizePathSegment(context[token] ?? '')
  })
}

export function makeDateParts(isoDate = new Date().toISOString().slice(0, 10)): {
  date: string
  year: string
  month: string
  day: string
} {
  const [year, month, day] = isoDate.split('-')
  return { date: isoDate, year, month, day }
}

export function templateContext(input: {
  student: string
  subject: string
  originalName: string
  title?: string
  date?: string
}): TemplateContext {
  const parts = makeDateParts(input.date)
  const originalName = stripPdfExtension(input.originalName)
  return {
    student: sanitizePathSegment(input.student, 'Student'),
    subject: sanitizePathSegment(input.subject, 'Subject'),
    originalName: sanitizePathSegment(originalName, 'Worksheet'),
    title: sanitizePathSegment(input.title ?? originalName, 'Worksheet'),
    ...parts
  }
}

export function stripPdfExtension(filename: string): string {
  return filename.replace(/\.pdf$/i, '')
}

export function uniqueName(existing: Set<string>, desired: string): string {
  if (!existing.has(desired.toLowerCase())) return desired
  let index = 2
  while (existing.has(`${desired} (${index})`.toLowerCase())) {
    index += 1
  }
  return `${desired} (${index})`
}
