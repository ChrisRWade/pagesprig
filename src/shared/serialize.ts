import { PROJECT_VERSION } from './constants'
import type { Annotation, DocumentProject, PageAnnotations, PageSpec } from './types'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function parseStyle(value: unknown): Annotation['style'] | null {
  if (!isRecord(value)) return null
  if (!isString(value.color) || !isNumber(value.width) || !isNumber(value.opacity)) return null
  return {
    color: value.color,
    width: value.width,
    opacity: value.opacity
  }
}

function parsePoints(value: unknown): Annotation extends { points: infer P } ? P : never {
  if (!Array.isArray(value)) return [] as never
  return value
    .filter((point) => isRecord(point) && isNumber(point.x) && isNumber(point.y))
    .map((point) => {
      const item = point as { x: number; y: number; p?: unknown }
      return item.p === undefined || !isNumber(item.p)
        ? { x: item.x, y: item.y }
        : { x: item.x, y: item.y, p: item.p }
    }) as never
}

export function parseAnnotation(value: unknown): Annotation | null {
  if (!isRecord(value) || !isString(value.id) || !isString(value.type) || !isNumber(value.page)) {
    return null
  }
  const style = parseStyle(value.style)
  if (!style) return null
  const base = {
    id: value.id,
    page: value.page,
    createdAt: isString(value.createdAt) ? value.createdAt : new Date().toISOString(),
    updatedAt: isString(value.updatedAt) ? value.updatedAt : new Date().toISOString(),
    style
  }

  switch (value.type) {
    case 'stroke':
    case 'highlight':
      return { ...base, type: value.type, points: parsePoints(value.points) }
    case 'text':
      if (!isNumber(value.x) || !isNumber(value.y) || !isNumber(value.width) || !isNumber(value.height)) {
        return null
      }
      return {
        ...base,
        type: 'text',
        x: value.x,
        y: value.y,
        width: value.width,
        height: value.height,
        text: isString(value.text) ? value.text : '',
        fontSize: isNumber(value.fontSize) ? value.fontSize : style.width
      }
    case 'line':
    case 'arrow':
      if (![value.x1, value.y1, value.x2, value.y2].every(isNumber)) return null
      return {
        ...base,
        type: value.type,
        x1: value.x1 as number,
        y1: value.y1 as number,
        x2: value.x2 as number,
        y2: value.y2 as number
      }
    case 'rect':
    case 'ellipse':
      if (![value.x, value.y, value.width, value.height].every(isNumber)) return null
      return {
        ...base,
        type: value.type,
        x: value.x as number,
        y: value.y as number,
        width: value.width as number,
        height: value.height as number
      }
    case 'checkmark':
    case 'xmark':
      if (!isNumber(value.x) || !isNumber(value.y) || !isNumber(value.size)) return null
      return {
        ...base,
        type: value.type,
        x: value.x as number,
        y: value.y as number,
        size: value.size as number
      }
    default:
      return null
  }
}

function parsePageSpec(value: unknown): PageSpec | null {
  if (!isRecord(value) || !isNumber(value.page) || !isString(value.source)) return null
  if (!isNumber(value.width) || !isNumber(value.height)) return null
  const source = value.source as PageSpec['source']
  if (!['original', 'blank', 'lined', 'graph', 'dot'].includes(source)) return null
  return {
    page: value.page,
    source,
    originalPage: isNumber(value.originalPage) ? value.originalPage : undefined,
    width: value.width,
    height: value.height
  }
}

function parsePageAnnotations(value: unknown): PageAnnotations | null {
  if (!isRecord(value) || !isNumber(value.page) || !Array.isArray(value.annotations)) return null
  return {
    page: value.page,
    annotations: value.annotations.map(parseAnnotation).filter((item): item is Annotation => item !== null)
  }
}

export function parseDocumentProject(value: unknown): DocumentProject | null {
  if (!isRecord(value)) return null
  if (!isNumber(value.version) || value.version > PROJECT_VERSION) return null
  const requiredStrings = [
    'id',
    'studentId',
    'subjectId',
    'date',
    'title',
    'originalFilename',
    'sourcePdfPath',
    'projectDir',
    'exportPdfPath',
    'createdAt',
    'updatedAt',
    'lastOpenedAt',
    'fingerprint'
  ] as const
  for (const key of requiredStrings) {
    if (!isString(value[key])) return null
  }
  if (!Array.isArray(value.pages) || !Array.isArray(value.annotations)) return null
  const status = value.status === 'completed' || value.status === 'in_progress' ? value.status : 'not_started'
  return {
    version: PROJECT_VERSION,
    id: value.id as string,
    studentId: value.studentId as string,
    subjectId: value.subjectId as string,
    date: value.date as string,
    title: value.title as string,
    originalFilename: value.originalFilename as string,
    sourcePdfPath: value.sourcePdfPath as string,
    projectDir: value.projectDir as string,
    exportPdfPath: value.exportPdfPath as string,
    pages: value.pages.map(parsePageSpec).filter((item): item is PageSpec => item !== null),
    annotations: value.annotations
      .map(parsePageAnnotations)
      .filter((item): item is PageAnnotations => item !== null),
    status,
    createdAt: value.createdAt as string,
    updatedAt: value.updatedAt as string,
    lastOpenedAt: value.lastOpenedAt as string,
    fingerprint: value.fingerprint as string
  }
}

export function serializeProject(project: DocumentProject): string {
  return `${JSON.stringify(project, null, 2)}\n`
}

export function fingerprintFromFile(mtimeMs: number, size: number): string {
  return `${mtimeMs}:${size}`
}

export function emptyPageAnnotations(pageCount: number): PageAnnotations[] {
  return Array.from({ length: pageCount }, (_, i) => ({ page: i + 1, annotations: [] }))
}

export function allAnnotations(project: DocumentProject): Annotation[] {
  return project.annotations.flatMap((page) => page.annotations)
}

export function annotationsForPage(project: DocumentProject, page: number): Annotation[] {
  return project.annotations.find((item) => item.page === page)?.annotations ?? []
}

export function upsertPageAnnotations(
  project: DocumentProject,
  page: number,
  annotations: Annotation[]
): DocumentProject {
  const existing = project.annotations.find((item) => item.page === page)
  const nextPages = existing
    ? project.annotations.map((item) => (item.page === page ? { ...item, annotations } : item))
    : [...project.annotations, { page, annotations }]
  return { ...project, annotations: nextPages, updatedAt: new Date().toISOString() }
}

export function replaceAnnotation(project: DocumentProject, annotation: Annotation): DocumentProject {
  const current = annotationsForPage(project, annotation.page)
  const next = current.map((item) => (item.id === annotation.id ? annotation : item))
  return upsertPageAnnotations(project, annotation.page, next)
}

export function addAnnotation(project: DocumentProject, annotation: Annotation): DocumentProject {
  const current = annotationsForPage(project, annotation.page)
  return upsertPageAnnotations(project, annotation.page, [...current, annotation])
}

export function removeAnnotation(project: DocumentProject, annotationId: string): DocumentProject {
  return {
    ...project,
    updatedAt: new Date().toISOString(),
    annotations: project.annotations.map((page) => ({
      ...page,
      annotations: page.annotations.filter((item) => item.id !== annotationId)
    }))
  }
}

export function findAnnotation(project: DocumentProject, annotationId: string): Annotation | undefined {
  return allAnnotations(project).find((item) => item.id === annotationId)
}
