import {
  AUTOSAVE_DEBOUNCE_MS,
  DEFAULT_FILENAME_TEMPLATE,
  DEFAULT_FOLDER_TEMPLATE,
  RECOVERY_CHECKPOINT_LIMIT,
  SETTINGS_VERSION
} from './constants'
import type { AppSettings, Student, Subject } from './types'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseSubject(value: unknown): Subject | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.name !== 'string') return null
  return {
    id: value.id,
    name: value.name,
    color: typeof value.color === 'string' ? value.color : '#2A6F6F'
  }
}

function parseStudent(value: unknown): Student | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.name !== 'string') return null
  return {
    id: value.id,
    name: value.name,
    avatar: typeof value.avatar === 'string' ? value.avatar : '📘',
    accentColor: typeof value.accentColor === 'string' ? value.accentColor : '#2A6F6F',
    subjects: Array.isArray(value.subjects)
      ? value.subjects.map(parseSubject).filter((item): item is Subject => item !== null)
      : [],
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString()
  }
}

export function defaultSettings(): AppSettings {
  return {
    version: SETTINGS_VERSION,
    storageRoot: null,
    students: [],
    selectedStudentId: null,
    selectedSubjectId: null,
    folderTemplate: DEFAULT_FOLDER_TEMPLATE,
    filenameTemplate: DEFAULT_FILENAME_TEMPLATE,
    autosaveMs: AUTOSAVE_DEBOUNCE_MS,
    recoveryCheckpoints: RECOVERY_CHECKPOINT_LIMIT,
    confirmDrop: true,
    setupComplete: false
  }
}

export function parseSettings(value: unknown): AppSettings {
  const fallback = defaultSettings()
  if (!isRecord(value)) return fallback
  const version = typeof value.version === 'number' ? value.version : 1
  if (version > SETTINGS_VERSION) {
    return fallback
  }
  return {
    version: SETTINGS_VERSION,
    storageRoot: typeof value.storageRoot === 'string' ? value.storageRoot : null,
    students: Array.isArray(value.students)
      ? value.students.map(parseStudent).filter((item): item is Student => item !== null)
      : [],
    selectedStudentId: typeof value.selectedStudentId === 'string' ? value.selectedStudentId : null,
    selectedSubjectId: typeof value.selectedSubjectId === 'string' ? value.selectedSubjectId : null,
    folderTemplate:
      typeof value.folderTemplate === 'string' ? value.folderTemplate : DEFAULT_FOLDER_TEMPLATE,
    filenameTemplate:
      typeof value.filenameTemplate === 'string' ? value.filenameTemplate : DEFAULT_FILENAME_TEMPLATE,
    autosaveMs:
      typeof value.autosaveMs === 'number' && value.autosaveMs !== 350
        ? value.autosaveMs
        : AUTOSAVE_DEBOUNCE_MS,
    recoveryCheckpoints:
      typeof value.recoveryCheckpoints === 'number'
        ? value.recoveryCheckpoints
        : RECOVERY_CHECKPOINT_LIMIT,
    confirmDrop: typeof value.confirmDrop === 'boolean' ? value.confirmDrop : true,
    setupComplete: value.setupComplete === true
  }
}

export function settingsNeedSetup(settings: AppSettings): boolean {
  return !settings.setupComplete || !settings.storageRoot || settings.students.length === 0
}

export function isConfiguredSettings(settings: AppSettings): boolean {
  return (
    settings.setupComplete === true &&
    Boolean(settings.storageRoot) &&
    settings.students.some((student) => student.name.trim().length > 0)
  )
}

export function shouldAdoptLegacySettings(current: AppSettings, legacy: AppSettings): boolean {
  return !isConfiguredSettings(current) && isConfiguredSettings(legacy)
}

export function shouldKeepExistingSettings(existing: AppSettings, incoming: AppSettings): boolean {
  return (
    isConfiguredSettings(existing) &&
    !incoming.setupComplete &&
    incoming.students.length > 0 &&
    !incoming.students.some((student) => student.name.trim())
  )
}
