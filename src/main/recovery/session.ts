import type { RecoveryInfo, SessionState } from '@shared/types'
import { nowIso } from '@shared/utils'
import { atomicWriteFile, readTextIfExists } from '../storage/atomic'
import { loadSettings, sessionPath } from '../storage/settingsStore'
import { listDocuments, loadProjectFromDisk } from '../storage/projects'

import { emptySession, SESSION_VERSION, shouldOfferRecovery } from './sessionState'

export { emptySession, shouldOfferRecovery } from './sessionState'

export async function loadSession(): Promise<SessionState> {
  const raw = await readTextIfExists(sessionPath())
  if (!raw) return emptySession()
  try {
    const parsed = JSON.parse(raw) as SessionState
    return {
      version: SESSION_VERSION,
      dirty: parsed.dirty === true,
      openDocumentIds: Array.isArray(parsed.openDocumentIds)
        ? parsed.openDocumentIds.filter((id) => typeof id === 'string')
        : [],
      activeDocumentId: typeof parsed.activeDocumentId === 'string' ? parsed.activeDocumentId : null,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : nowIso()
    }
  } catch {
    return emptySession()
  }
}

export async function saveSession(session: SessionState): Promise<void> {
  await atomicWriteFile(sessionPath(), `${JSON.stringify(session, null, 2)}\n`)
}

export async function heartbeat(openDocumentIds: string[], activeDocumentId: string | null): Promise<void> {
  await saveSession({
    version: SESSION_VERSION,
    dirty: true,
    openDocumentIds,
    activeDocumentId,
    updatedAt: nowIso()
  })
}

export async function markCleanExit(): Promise<void> {
  const current = await loadSession()
  await saveSession({
    ...current,
    dirty: false,
    updatedAt: nowIso()
  })
}

export async function collectRecovery(): Promise<RecoveryInfo[]> {
  const session = await loadSession()
  if (!shouldOfferRecovery(session)) return []
  const settings = await loadSettings()
  const infos: RecoveryInfo[] = []
  for (const documentId of session.openDocumentIds) {
    const documents = await listDocuments(settings)
    const summary = documents.find((item) => item.id === documentId)
    if (!summary) continue
    try {
      const project = await loadProjectFromDisk(summary.projectDir)
      const student = settings.students.find((item) => item.id === project.studentId)
      const subject = student?.subjects.find((item) => item.id === project.subjectId)
      infos.push({
        documentId: project.id,
        title: project.title,
        studentName: student?.name ?? 'Student',
        subjectName: subject?.name ?? 'Subject',
        lastSavedAt: project.updatedAt,
        projectDir: project.projectDir,
        hasCheckpoint: true
      })
    } catch {
      // Skip documents that can no longer be opened.
    }
  }
  return infos
}
