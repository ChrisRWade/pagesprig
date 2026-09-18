import { readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { dialog } from 'electron'
import { ERROR_CODES, PROJECT_VERSION } from '@shared/constants'
import { applyTemplate, templateContext, uniqueName } from '@shared/pathTemplate'
import { emptyPageAnnotations, serializeProject } from '@shared/serialize'
import type { AppSettings, DocumentProject, DocumentSummary, PageSource, Student } from '@shared/types'
import { createId, localIsoDate, nowIso } from '@shared/utils'
import { copyOriginalPdf, exportAnnotatedPdf, fileFingerprint, inspectPdf } from '../export/pdfExport'
import { AppError, isInsideRoot } from './errors'
import { atomicWriteFile, ensureDir, readTextIfExists } from './atomic'
import { rebuildDocumentIndex, upsertIndex } from './documentIndex'
import { annotationsPath, loadSettings } from './settingsStore'

export { loadLatestCheckpoint, loadProjectFromDisk, writeCheckpoint } from './projectIo'
export { indexPath } from './documentIndex'

export async function selectStorageDirectory(): Promise<string | null> {
  const result = await dialog.showOpenDialog({
    title: 'Choose a schoolwork folder',
    properties: ['openDirectory', 'createDirectory']
  })
  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths[0]
}

export async function listDocuments(settings: AppSettings): Promise<DocumentSummary[]> {
  if (!settings.storageRoot) return []
  return rebuildDocumentIndex(settings.storageRoot)
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
    updatedAt: project.updatedAt || nowIso()
  }
  await atomicWriteFile(target, serializeProject(next))
  next.fingerprint = await fileFingerprint(target)

  if (options.exportPdf) {
    await exportAnnotatedPdf(next)
    next.lastExportedAt = nowIso()
    await atomicWriteFile(target, serializeProject(next))
    next.fingerprint = await fileFingerprint(target)
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
  date = localIsoDate()
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
    try {
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
        lastExportedAt: null,
        fingerprint: '0'
      }
      const saved = await saveProjectToDisk(project)
      created.push(saved)
    } catch (error) {
      await rm(projectDir, { recursive: true, force: true }).catch(() => undefined)
      throw error
    }
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

export async function exportProjectPdf(project: DocumentProject): Promise<DocumentProject> {
  await exportAnnotatedPdf(project)
  return saveProjectToDisk(
    { ...project, lastExportedAt: nowIso() },
    { expectedFingerprint: project.fingerprint }
  )
}

export async function readPdfBytes(filePath: string, storageRoot: string | null): Promise<Uint8Array> {
  if (!storageRoot || !isInsideRoot(storageRoot, filePath)) {
    throw new AppError('That file is outside the schoolwork folder.', ERROR_CODES.INVALID_PATH)
  }
  const bytes = await readFile(filePath)
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return copy
}

export async function deleteProject(projectDir: string): Promise<void> {
  const settings = await loadSettings()
  if (!settings.storageRoot) {
    throw new AppError('Choose a schoolwork folder in Settings first.', ERROR_CODES.STORAGE_UNAVAILABLE)
  }
  if (!isInsideRoot(settings.storageRoot, projectDir)) {
    throw new AppError('That document is outside the schoolwork folder.', ERROR_CODES.INVALID_PATH)
  }
  await rm(projectDir, { recursive: true, force: true })
  await listDocuments(settings)
}
