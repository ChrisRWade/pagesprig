import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { dialog } from 'electron'
import {
  ANNOTATIONS_FILE,
  ERROR_CODES,
  INDEX_FILE,
  PROJECT_VERSION
} from '@shared/constants'
import { applyTemplate, templateContext, uniqueName } from '@shared/pathTemplate'
import { emptyPageAnnotations, serializeProject } from '@shared/serialize'
import type { AppSettings, DocumentProject, DocumentSummary, PageSource, Student } from '@shared/types'
import { createId, nowIso } from '@shared/utils'
import { copyOriginalPdf, exportAnnotatedPdf, fileFingerprint, inspectPdf } from '../export/pdfExport'
import { AppError, isInsideRoot } from './errors'
import { atomicWriteFile, ensureDir, readTextIfExists } from './atomic'
import { annotationsPath, loadSettings } from './settingsStore'

export { loadLatestCheckpoint, loadProjectFromDisk, writeCheckpoint } from './projectIo'

export function indexPath(storageRoot: string): string {
  return path.join(storageRoot, INDEX_FILE)
}

export async function selectStorageDirectory(): Promise<string | null> {
  const result = await dialog.showOpenDialog({
    title: 'Choose a schoolwork folder',
    properties: ['openDirectory', 'createDirectory']
  })
  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths[0]
}

async function readIndex(storageRoot: string): Promise<DocumentSummary[]> {
  const raw = await readTextIfExists(indexPath(storageRoot))
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as { documents?: DocumentSummary[] }
    return Array.isArray(parsed.documents) ? parsed.documents : []
  } catch {
    return []
  }
}

async function writeIndex(storageRoot: string, documents: DocumentSummary[]): Promise<void> {
  await atomicWriteFile(
    indexPath(storageRoot),
    `${JSON.stringify({ version: 1, documents }, null, 2)}\n`
  )
}

export function toSummary(project: DocumentProject): DocumentSummary {
  return {
    id: project.id,
    studentId: project.studentId,
    subjectId: project.subjectId,
    date: project.date,
    title: project.title,
    status: project.status,
    projectDir: project.projectDir,
    exportPdfPath: project.exportPdfPath,
    sourcePdfPath: project.sourcePdfPath,
    originalFilename: project.originalFilename,
    updatedAt: project.updatedAt,
    lastOpenedAt: project.lastOpenedAt,
    pageCount: project.pages.length
  }
}

async function upsertIndex(storageRoot: string, project: DocumentProject): Promise<void> {
  const documents = await readIndex(storageRoot)
  const next = [toSummary(project), ...documents.filter((item) => item.id !== project.id)]
  await writeIndex(storageRoot, next)
}

export async function listDocuments(settings: AppSettings): Promise<DocumentSummary[]> {
  if (!settings.storageRoot) return []
  const indexed = await readIndex(settings.storageRoot)
  const existing: DocumentSummary[] = []
  for (const item of indexed) {
    try {
      await stat(path.join(item.projectDir, ANNOTATIONS_FILE))
      existing.push(item)
    } catch {
      // Drop entries whose project folder disappeared.
    }
  }
  if (existing.length !== indexed.length) {
    await writeIndex(settings.storageRoot, existing)
  }
  return existing
}

export async function saveProjectToDisk(
  project: DocumentProject,
  options: { expectedFingerprint?: string; exportPdf?: boolean } = {}
): Promise<DocumentProject> {
  const settings = await loadSettings()
  if (!settings.storageRoot) {
    throw new AppError('Choose a schoolwork folder in Settings first.', ERROR_CODES.STORAGE_UNAVAILABLE)
  }
  if (!isInsideRoot(settings.storageRoot, project.projectDir)) {
    throw new AppError('That document is outside the schoolwork folder.', ERROR_CODES.INVALID_PATH)
  }

  const target = annotationsPath(project.projectDir)
  const currentRaw = await readTextIfExists(target)
  if (currentRaw && options.expectedFingerprint) {
    const currentFingerprint = await fileFingerprint(target)
    if (currentFingerprint !== options.expectedFingerprint) {
      throw new AppError(
        'This worksheet was changed in another program or on another computer. Open it again before saving.',
        ERROR_CODES.EXTERNAL_CHANGE
      )
    }
  }

  const next: DocumentProject = {
    ...project,
    version: PROJECT_VERSION,
    updatedAt: nowIso()
  }
  await atomicWriteFile(target, serializeProject(next))
  next.fingerprint = await fileFingerprint(target)

  if (options.exportPdf) {
    await exportAnnotatedPdf(next)
  }

  await upsertIndex(settings.storageRoot, next)
  return next
}

function findStudent(settings: AppSettings, studentId: string): Student {
  const student = settings.students.find((item) => item.id === studentId)
  if (!student) {
    throw new AppError('That student profile is missing. Open Settings and add it again.', ERROR_CODES.VALIDATION)
  }
  return student
}

export async function importPdfFiles(
  filePaths: string[],
  studentId: string,
  subjectId: string,
  date = new Date().toISOString().slice(0, 10)
): Promise<DocumentProject[]> {
  const settings = await loadSettings()
  if (!settings.storageRoot) {
    throw new AppError('Choose a schoolwork folder in Settings first.', ERROR_CODES.STORAGE_UNAVAILABLE)
  }
  const student = findStudent(settings, studentId)
  const subject = student.subjects.find((item) => item.id === subjectId)
  if (!subject) {
    throw new AppError('That subject is missing. Add it in Settings.', ERROR_CODES.VALIDATION)
  }

  const created: DocumentProject[] = []
  const siblingNames = new Set<string>()

  for (const filePath of filePaths) {
    if (!filePath.toLowerCase().endsWith('.pdf')) {
      throw new AppError('Only PDF worksheets can be added.', ERROR_CODES.INVALID_PDF)
    }
    const info = await inspectPdf(filePath)
    const originalName = path.parse(filePath).name
    const context = templateContext({
      student: student.name,
      subject: subject.name,
      originalName,
      date
    })
    const folderRel = applyTemplate(settings.folderTemplate, context)
    const baseName = uniqueName(siblingNames, applyTemplate(settings.filenameTemplate, context))
    siblingNames.add(baseName.toLowerCase())
    const projectDir = path.join(settings.storageRoot, folderRel, baseName)
    await ensureDir(projectDir)
    const sourcePdfPath = await copyOriginalPdf(filePath, projectDir)
    const createdAt = nowIso()
    const project: DocumentProject = {
      version: PROJECT_VERSION,
      id: createId(),
      studentId,
      subjectId,
      date,
      title: originalName,
      originalFilename: path.basename(filePath),
      sourcePdfPath,
      projectDir,
      exportPdfPath: path.join(projectDir, `${baseName}.pdf`),
      pages: info.pages.map((size, index) => ({
        page: index + 1,
        source: 'original',
        originalPage: index + 1,
        width: size.width,
        height: size.height
      })),
      annotations: emptyPageAnnotations(info.pageCount),
      status: 'not_started',
      createdAt,
      updatedAt: createdAt,
      lastOpenedAt: createdAt,
      fingerprint: '0'
    }
    const saved = await saveProjectToDisk(project)
    created.push(saved)
  }

  return created
}

export async function addNotePage(project: DocumentProject, source: PageSource): Promise<DocumentProject> {
  const last = project.pages[project.pages.length - 1]
  const width = last?.width ?? 612
  const height = last?.height ?? 792
  const page = project.pages.length + 1
  const next: DocumentProject = {
    ...project,
    pages: [...project.pages, { page, source, width, height }],
    annotations: [...project.annotations, { page, annotations: [] }],
    status: project.status === 'not_started' ? 'in_progress' : project.status,
    updatedAt: nowIso()
  }
  return saveProjectToDisk(next, { expectedFingerprint: project.fingerprint })
}

export async function readPdfBytes(filePath: string, storageRoot: string | null): Promise<ArrayBuffer> {
  if (!storageRoot || !isInsideRoot(storageRoot, filePath)) {
    throw new AppError('That file is outside the schoolwork folder.', ERROR_CODES.INVALID_PATH)
  }
  const bytes = await readFile(filePath)
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
}
