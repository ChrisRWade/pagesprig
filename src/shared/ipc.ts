import type { ErrorCode } from './constants'
import type {
  AppSettings,
  DocumentProject,
  DocumentSummary,
  PageSource,
  RecoveryInfo,
  SessionState
} from './types'

export interface IpcOk<T> {
  ok: true
  data: T
}

export interface IpcErr {
  ok: false
  error: string
  code: ErrorCode
}

export type IpcResult<T> = IpcOk<T> | IpcErr

export interface ImportRequest {
  filePaths: string[]
  studentId: string
  subjectId: string
  date?: string
}

export interface SaveProjectRequest {
  project: DocumentProject
  expectedFingerprint?: string
  exportPdf?: boolean
}

export interface ExportRequest {
  project: DocumentProject
}

export interface AddNotePageRequest {
  project: DocumentProject
  source: PageSource
}

export interface StudyApi {
  selectStorageDirectory: () => Promise<IpcResult<string>>
  getSettings: () => Promise<IpcResult<AppSettings>>
  saveSettings: (settings: AppSettings) => Promise<IpcResult<AppSettings>>
  importPdfs: (request: ImportRequest) => Promise<IpcResult<DocumentProject[]>>
  loadProject: (projectDir: string) => Promise<IpcResult<DocumentProject>>
  saveProject: (request: SaveProjectRequest) => Promise<IpcResult<DocumentProject>>
  exportPdf: (request: ExportRequest) => Promise<IpcResult<DocumentProject>>
  listDocuments: () => Promise<IpcResult<DocumentSummary[]>>
  readPdf: (filePath: string) => Promise<IpcResult<Uint8Array>>
  addNotePage: (request: AddNotePageRequest) => Promise<IpcResult<DocumentProject>>
  writeCheckpoint: (project: DocumentProject) => Promise<IpcResult<string>>
  loadCheckpoint: (projectDir: string) => Promise<IpcResult<DocumentProject>>
  getSession: () => Promise<IpcResult<SessionState>>
  heartbeat: (session: Pick<SessionState, 'openDocumentIds' | 'activeDocumentId'>) => Promise<IpcResult<void>>
  markCleanExit: () => Promise<IpcResult<void>>
  getRecovery: () => Promise<IpcResult<RecoveryInfo[]>>
  openExternal: (filePath: string) => Promise<IpcResult<void>>
  selectPdfFiles: () => Promise<IpcResult<string[]>>
  deleteDocument: (projectDir: string) => Promise<IpcResult<void>>
  getPathForFile: (file: File) => string
  getVersion: () => Promise<string>
}

export const IPC_CHANNELS = {
  selectStorageDirectory: 'storage:selectDirectory',
  getSettings: 'settings:get',
  saveSettings: 'settings:save',
  importPdfs: 'docs:import',
  loadProject: 'docs:load',
  saveProject: 'docs:save',
  exportPdf: 'docs:export',
  listDocuments: 'docs:list',
  readPdf: 'docs:readPdf',
  addNotePage: 'docs:addNotePage',
  writeCheckpoint: 'recovery:write',
  loadCheckpoint: 'recovery:load',
  getSession: 'session:get',
  heartbeat: 'session:heartbeat',
  markCleanExit: 'session:cleanExit',
  getRecovery: 'session:recovery',
  openExternal: 'shell:openExternal',
  selectPdfFiles: 'docs:selectPdfs',
  deleteDocument: 'docs:delete',
  getVersion: 'app:version'
} as const
