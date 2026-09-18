export interface Point {
  x: number
  y: number
  /** Optional stylus pressure 0-1, stored for a future pressure-sensitive pencil. */
  p?: number
}

export interface Size {
  width: number
  height: number
}

export type ToolId =
  | 'select'
  | 'pencil'
  | 'highlighter'
  | 'text'
  | 'line'
  | 'rect'
  | 'ellipse'
  | 'arrow'
  | 'checkmark'
  | 'xmark'
  | 'eraser'

export type AnnotationType =
  | 'stroke'
  | 'highlight'
  | 'text'
  | 'line'
  | 'arrow'
  | 'rect'
  | 'ellipse'
  | 'checkmark'
  | 'xmark'

export interface AnnotationStyle {
  color: string
  /** Stroke or text size in PDF points. */
  width: number
  opacity: number
}

export interface BaseAnnotation {
  id: string
  type: AnnotationType
  page: number
  createdAt: string
  updatedAt: string
  style: AnnotationStyle
}

export interface StrokeAnnotation extends BaseAnnotation {
  type: 'stroke' | 'highlight'
  points: Point[]
}

export interface TextAnnotation extends BaseAnnotation {
  type: 'text'
  x: number
  y: number
  width: number
  height: number
  text: string
  fontSize: number
}

export interface LineAnnotation extends BaseAnnotation {
  type: 'line' | 'arrow'
  x1: number
  y1: number
  x2: number
  y2: number
}

export interface ShapeAnnotation extends BaseAnnotation {
  type: 'rect' | 'ellipse'
  x: number
  y: number
  width: number
  height: number
}

export interface MarkAnnotation extends BaseAnnotation {
  type: 'checkmark' | 'xmark'
  x: number
  y: number
  size: number
}

export type Annotation =
  | StrokeAnnotation
  | TextAnnotation
  | LineAnnotation
  | ShapeAnnotation
  | MarkAnnotation

export type PageSource = 'original' | 'blank' | 'lined' | 'graph' | 'dot'

export interface PageSpec {
  page: number
  source: PageSource
  originalPage?: number
  width: number
  height: number
}

export interface PageAnnotations {
  page: number
  annotations: Annotation[]
}

export type DocumentStatus = 'not_started' | 'in_progress' | 'completed'

export interface DocumentProject {
  version: number
  id: string
  studentId: string
  subjectId: string
  date: string
  title: string
  originalFilename: string
  sourcePdfPath: string
  projectDir: string
  exportPdfPath: string
  pages: PageSpec[]
  annotations: PageAnnotations[]
  status: DocumentStatus
  createdAt: string
  updatedAt: string
  lastOpenedAt: string
  lastExportedAt?: string | null
  fingerprint: string
}

export interface DocumentSummary {
  id: string
  studentId: string
  subjectId: string
  date: string
  title: string
  status: DocumentStatus
  projectDir: string
  exportPdfPath: string
  sourcePdfPath: string
  originalFilename: string
  updatedAt: string
  lastOpenedAt: string
  lastExportedAt?: string | null
  pageCount: number
}

export interface Subject {
  id: string
  name: string
  color: string
}

export interface Student {
  id: string
  name: string
  avatar: string
  accentColor: string
  subjects: Subject[]
  createdAt: string
}

export interface AppSettings {
  version: number
  storageRoot: string | null
  students: Student[]
  selectedStudentId: string | null
  selectedSubjectId: string | null
  folderTemplate: string
  filenameTemplate: string
  autosaveMs: number
  recoveryCheckpoints: number
  confirmDrop: boolean
  setupComplete: boolean
}

export interface SessionState {
  version: number
  dirty: boolean
  openDocumentIds: string[]
  activeDocumentId: string | null
  updatedAt: string
}

export interface RecoveryInfo {
  documentId: string
  title: string
  studentName: string
  subjectName: string
  lastSavedAt: string
  projectDir: string
  hasCheckpoint: boolean
}

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export type ExportStatus = 'idle' | 'exporting' | 'error'

export interface TemplateContext {
  student: string
  subject: string
  originalName: string
  title: string
  date: string
  year: string
  month: string
  day: string
}

export const DEFAULT_SUBJECTS: Subject[] = [
  { id: 'math', name: 'Math', color: '#2A6F6F' },
  { id: 'language-arts', name: 'Language Arts', color: '#8B4B2A' },
  { id: 'science', name: 'Science', color: '#3B6B2F' },
  { id: 'history', name: 'History', color: '#6B3A4A' }
]

export const AVATARS = ['📘', '📗', '📙', '📕', '📒', '✏️', '⭐', '🦊', '🐻', '🦉'] as const

export const ACCENT_COLORS = [
  '#2A6F6F',
  '#8B4B2A',
  '#3B6B2F',
  '#6B3A4A',
  '#1F4E79',
  '#7A4E1D',
  '#4A3B73'
] as const
