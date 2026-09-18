import { readdir, readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { ANNOTATIONS_FILE, ERROR_CODES, ORIGINAL_PDF_FILE, PROJECT_VERSION, RECOVERY_CHECKPOINT_LIMIT, RECOVERY_DIR } from '@shared/constants'
import { fingerprintFromFile, parseDocumentProject, serializeProject } from '@shared/serialize'
import type { DocumentProject } from '@shared/types'
import { nowIso } from '@shared/utils'
import { fileFingerprint } from '../export/pdfExport'
import { AppError } from './errors'
import { atomicWriteFile, ensureDir, readTextIfExists } from './atomic'

export function annotationsFile(projectDir: string): string {
  return path.join(projectDir, ANNOTATIONS_FILE)
}

export async function loadProjectFromDisk(
  projectDir: string,
  options: { touchOpened?: boolean } = {}
): Promise<DocumentProject> {
  const raw = await readTextIfExists(annotationsFile(projectDir))
  if (!raw) {
    throw new AppError('This schoolwork file could not be found.', ERROR_CODES.MISSING_SOURCE)
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new AppError('The saved notes file is damaged and cannot be opened.', ERROR_CODES.CORRUPT_PDF)
  }
  const project = parseDocumentProject(parsed)
  if (!project) {
    throw new AppError('The saved notes file is not a valid StudyPDF document.', ERROR_CODES.VALIDATION)
  }
  try {
    project.fingerprint = await fileFingerprint(annotationsFile(projectDir))
  } catch {
    project.fingerprint = fingerprintFromFile(Date.now(), raw.length)
  }
  project.projectDir = projectDir
  if (options.touchOpened !== false) {
    project.lastOpenedAt = nowIso()
  }
  return project
}

export async function writeCheckpoint(project: DocumentProject, limit = RECOVERY_CHECKPOINT_LIMIT): Promise<string> {
  const directory = path.join(project.projectDir, RECOVERY_DIR)
  await ensureDir(directory)
  const filePath = path.join(directory, `checkpoint-${Date.now()}.json`)
  await atomicWriteFile(filePath, serializeProject({ ...project, version: PROJECT_VERSION }))
  const entries = (await readdir(directory))
    .filter((name) => name.startsWith('checkpoint-'))
    .sort()
    .reverse()
  for (const extra of entries.slice(limit)) {
    await rm(path.join(directory, extra), { force: true })
  }
  return filePath
}

export async function loadLatestCheckpoint(projectDir: string): Promise<DocumentProject> {
  const directory = path.join(projectDir, RECOVERY_DIR)
  const entries = (await readdir(directory).catch(() => [] as string[]))
    .filter((name) => name.startsWith('checkpoint-') && name.endsWith('.json'))
    .sort()
    .reverse()
  if (entries.length === 0) {
    return loadProjectFromDisk(projectDir)
  }
  const raw = await readFile(path.join(directory, entries[0]), 'utf8')
  const parsed = parseDocumentProject(JSON.parse(raw))
  if (!parsed) return loadProjectFromDisk(projectDir)
  parsed.projectDir = projectDir
  parsed.sourcePdfPath = path.join(projectDir, ORIGINAL_PDF_FILE)
  return parsed
}
