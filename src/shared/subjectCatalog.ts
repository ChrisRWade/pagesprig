import type { Student, Subject } from './types'

export interface SharedSubjectList {
  name: string
  subjects: Subject[]
}

export interface SharedSubjectCatalog {
  version: 1
  students: SharedSubjectList[]
}

const PATH_TOKEN = /^\{(student|subject|originalName|title|date|year|month|day)\}$/

export function emptySubjectCatalog(): SharedSubjectCatalog {
  return { version: 1, students: [] }
}

export function parseSubjectCatalog(value: unknown): SharedSubjectCatalog {
  if (!isRecord(value) || !Array.isArray(value.students)) return emptySubjectCatalog()
  const students: SharedSubjectList[] = []
  for (const entry of value.students) {
    if (!isRecord(entry) || typeof entry.name !== 'string' || !entry.name.trim()) continue
    const subjects = Array.isArray(entry.subjects) ? entry.subjects.map(parseSubject).filter((item) => item !== null) : []
    students.push({ name: entry.name.trim(), subjects })
  }
  return { version: 1, students }
}

/** Keep every child's list. This computer updates only the students it knows, and does not erase the others. */
export function mergeSubjectCatalog(
  existing: SharedSubjectCatalog,
  students: readonly Student[]
): SharedSubjectCatalog {
  const byName = new Map<string, SharedSubjectList>()
  for (const entry of existing.students) {
    const name = entry.name.trim()
    if (!name) continue
    byName.set(name.toLowerCase(), { name, subjects: entry.subjects.map(copySubject) })
  }
  for (const student of students) {
    const name = student.name.trim()
    if (!name) continue
    const key = name.toLowerCase()
    const current = byName.get(key) ?? { name, subjects: [] }
    const subjects = current.subjects.map(copySubject)
    for (const subject of student.subjects) {
      const id = subject.id.trim()
      const subjectName = subject.name.trim()
      if (!id || !subjectName) continue
      const next = { id, name: subjectName, color: subject.color || '#2A6F6F' }
      const index = subjects.findIndex((item) => item.id === id)
      if (index >= 0) subjects[index] = next
      else subjects.push(next)
    }
    byName.set(key, { name: current.name, subjects })
  }
  return {
    version: 1,
    students: [...byName.values()].sort((a, b) => a.name.localeCompare(b.name))
  }
}

export function catalogSubjectName(
  catalog: SharedSubjectCatalog,
  folderName: string | null,
  subjectId: string
): string | null {
  if (!folderName || !subjectId) return null
  const entry = catalog.students.find((student) => student.name.trim().toLowerCase() === folderName.trim().toLowerCase())
  return entry?.subjects.find((subject) => subject.id === subjectId)?.name ?? null
}

/**
 * The default schoolwork path is student/year/month/date/subject.
 * That subject folder is already in the shared drive, even when another computer does not know the subject id.
 */
export function subjectFromProjectPath(storageRoot: string, projectDir: string, folderTemplate: string): string | null {
  const segments = relativeSegments(storageRoot, projectDir)
  if (!segments) return null
  const tokens = folderTemplate.split('/').filter(Boolean)
  if (tokens.length === 0 || segments.length < tokens.length) return null
  let subject: string | null = null
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index].match(PATH_TOKEN)?.[1]
    const segment = segments[index]
    if (!token || !segment || !segmentMatches(token, segment)) return null
    if (token === 'subject') subject = segment
  }
  return subject
}

export function resolveSubjectName(input: {
  folderName: string | null
  subjectId: string
  recordedName?: string | null
  pathSubject?: string | null
  catalog: SharedSubjectCatalog
  localName?: string | null
}): string | null {
  const recorded = clean(input.recordedName)
  const fromCatalog = catalogSubjectName(input.catalog, input.folderName, input.subjectId)
  const fromPath = clean(input.pathSubject)
  const local = clean(input.localName)
  return fromCatalog || recorded || fromPath || local || null
}

function relativeSegments(storageRoot: string, projectDir: string): string[] | null {
  const split = (value: string) => value.replace(/\\/g, '/').replace(/\/+$/, '')
  const root = split(storageRoot)
  const dir = split(projectDir)
  if (!root || !dir.toLowerCase().startsWith(`${root.toLowerCase()}/`)) return null
  const rest = dir.slice(root.length).replace(/^\/+/, '')
  const segments = rest.split('/').filter(Boolean)
  return segments.length > 0 ? segments : null
}

function segmentMatches(token: string, segment: string): boolean {
  if (token === 'year') return /^\d{4}$/.test(segment)
  if (token === 'month' || token === 'day') return /^\d{2}$/.test(segment)
  if (token === 'date') return /^\d{4}-\d{2}-\d{2}$/.test(segment)
  return segment.trim().length > 0
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function copySubject(subject: Subject): Subject {
  return { id: subject.id, name: subject.name, color: subject.color }
}

function parseSubject(value: unknown): Subject | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.name !== 'string') return null
  const id = value.id.trim()
  const name = value.name.trim()
  if (!id || !name) return null
  return { id, name, color: typeof value.color === 'string' && value.color ? value.color : '#2A6F6F' }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
