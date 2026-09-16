import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { IPC_CHANNELS } from '@shared/ipc'
import type {
  AddNotePageRequest,
  ExportRequest,
  ImportRequest,
  SaveProjectRequest,
  StudyApi
} from '@shared/ipc'
import type { AppSettings, DocumentProject, SessionState } from '@shared/types'

const api: StudyApi = {
  selectStorageDirectory: () => ipcRenderer.invoke(IPC_CHANNELS.selectStorageDirectory),
  getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.getSettings),
  saveSettings: (settings: AppSettings) => ipcRenderer.invoke(IPC_CHANNELS.saveSettings, settings),
  importPdfs: (request: ImportRequest) => ipcRenderer.invoke(IPC_CHANNELS.importPdfs, request),
  loadProject: (projectDir: string) => ipcRenderer.invoke(IPC_CHANNELS.loadProject, projectDir),
  saveProject: (request: SaveProjectRequest) => ipcRenderer.invoke(IPC_CHANNELS.saveProject, request),
  exportPdf: (request: ExportRequest) => ipcRenderer.invoke(IPC_CHANNELS.exportPdf, request),
  listDocuments: () => ipcRenderer.invoke(IPC_CHANNELS.listDocuments),
  readPdf: (filePath: string) => ipcRenderer.invoke(IPC_CHANNELS.readPdf, filePath),
  addNotePage: (request: AddNotePageRequest) => ipcRenderer.invoke(IPC_CHANNELS.addNotePage, request),
  writeCheckpoint: (project: DocumentProject) => ipcRenderer.invoke(IPC_CHANNELS.writeCheckpoint, project),
  loadCheckpoint: (projectDir: string) => ipcRenderer.invoke(IPC_CHANNELS.loadCheckpoint, projectDir),
  getSession: () => ipcRenderer.invoke(IPC_CHANNELS.getSession),
  heartbeat: (session: Pick<SessionState, 'openDocumentIds' | 'activeDocumentId'>) =>
    ipcRenderer.invoke(IPC_CHANNELS.heartbeat, session),
  markCleanExit: () => ipcRenderer.invoke(IPC_CHANNELS.markCleanExit),
  getRecovery: () => ipcRenderer.invoke(IPC_CHANNELS.getRecovery),
  openExternal: (filePath: string) => ipcRenderer.invoke(IPC_CHANNELS.openExternal, filePath),
  selectPdfFiles: () => ipcRenderer.invoke(IPC_CHANNELS.selectPdfFiles),
  getPathForFile: (file: File) => webUtils.getPathForFile(file),
  getVersion: () => ipcRenderer.invoke(IPC_CHANNELS.getVersion)
}

contextBridge.exposeInMainWorld('studyApi', api)
