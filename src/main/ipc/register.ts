import { dialog, ipcMain, shell } from 'electron'
import { APP_VERSION, ERROR_CODES } from '@shared/constants'
import { IPC_CHANNELS } from '@shared/ipc'
import type { AddNotePageRequest, ExportRequest, ImportRequest, SaveProjectRequest } from '@shared/ipc'
import type { AppSettings, DocumentProject, SessionState } from '@shared/types'
import { exportAnnotatedPdf } from '../export/pdfExport'
import { AppError, err, fromFilesystemError, ok } from '../storage/errors'
import {
  addNotePage,
  importPdfFiles,
  listDocuments,
  loadLatestCheckpoint,
  loadProjectFromDisk,
  readPdfBytes,
  saveProjectToDisk,
  selectStorageDirectory,
  writeCheckpoint
} from '../storage/projects'
import { loadSettings, saveSettings } from '../storage/settingsStore'
import { collectRecovery, heartbeat, loadSession, markCleanExit } from '../recovery/session'

function wrap<T>(work: () => Promise<T>) {
  return async () => {
    try {
      return ok(await work())
    } catch (error) {
      if (error instanceof AppError) return err(error.message, error.code)
      return fromFilesystemError(error)
    }
  }
}

export function registerIpc(): void {
  ipcMain.handle(IPC_CHANNELS.selectStorageDirectory, async () => {
    try {
      const selected = await selectStorageDirectory()
      if (!selected) return err('No folder was selected.', ERROR_CODES.VALIDATION)
      const settings = await loadSettings()
      const saved = await saveSettings({ ...settings, storageRoot: selected })
      return ok(saved.storageRoot as string)
    } catch (error) {
      return fromFilesystemError(error, 'Could not remember that folder.')
    }
  })

  ipcMain.handle(IPC_CHANNELS.getSettings, wrap(loadSettings))

  ipcMain.handle(IPC_CHANNELS.saveSettings, async (_event, settings: AppSettings) => {
    try {
      if (!settings || typeof settings !== 'object') {
        return err('Settings were not valid.', ERROR_CODES.VALIDATION)
      }
      return ok(await saveSettings(settings))
    } catch (error) {
      return fromFilesystemError(error, 'Could not save settings.')
    }
  })

  ipcMain.handle(IPC_CHANNELS.importPdfs, async (_event, request: ImportRequest) => {
    try {
      if (!request?.studentId || !request?.subjectId || !Array.isArray(request.filePaths)) {
        return err('Choose a student and subject before adding a worksheet.', ERROR_CODES.VALIDATION)
      }
      const files = request.filePaths.filter((item) => typeof item === 'string' && item.length > 0)
      if (files.length === 0) return err('Drop a PDF worksheet to get started.', ERROR_CODES.VALIDATION)
      return ok(await importPdfFiles(files, request.studentId, request.subjectId, request.date))
    } catch (error) {
      if (error instanceof AppError) return err(error.message, error.code)
      return fromFilesystemError(error, 'Could not add that worksheet.')
    }
  })

  ipcMain.handle(IPC_CHANNELS.loadProject, async (_event, projectDir: string) => {
    try {
      if (typeof projectDir !== 'string' || projectDir.length === 0) {
        return err('Missing document folder.', ERROR_CODES.VALIDATION)
      }
      return ok(await loadProjectFromDisk(projectDir))
    } catch (error) {
      if (error instanceof AppError) return err(error.message, error.code)
      return fromFilesystemError(error, 'Could not open that worksheet.')
    }
  })

  ipcMain.handle(IPC_CHANNELS.saveProject, async (_event, request: SaveProjectRequest) => {
    try {
      if (!request?.project?.id || !request.project.projectDir) {
        return err('Nothing to save.', ERROR_CODES.VALIDATION)
      }
      return ok(
        await saveProjectToDisk(request.project, {
          expectedFingerprint: request.expectedFingerprint,
          exportPdf: request.exportPdf
        })
      )
    } catch (error) {
      if (error instanceof AppError) return err(error.message, error.code)
      return fromFilesystemError(error, 'Could not save schoolwork.')
    }
  })

  ipcMain.handle(IPC_CHANNELS.exportPdf, async (_event, request: ExportRequest) => {
    try {
      if (!request?.project) return err('Nothing to export.', ERROR_CODES.VALIDATION)
      const saved = await saveProjectToDisk(request.project, { exportPdf: true })
      return ok(await exportAnnotatedPdf(saved))
    } catch (error) {
      if (error instanceof AppError) return err(error.message, error.code)
      return fromFilesystemError(error, 'Could not create the finished PDF.')
    }
  })

  ipcMain.handle(
    IPC_CHANNELS.listDocuments,
    wrap(async () => {
      const settings = await loadSettings()
      return listDocuments(settings)
    })
  )

  ipcMain.handle(IPC_CHANNELS.readPdf, async (_event, filePath: string) => {
    try {
      if (typeof filePath !== 'string') return err('Missing PDF path.', ERROR_CODES.VALIDATION)
      const settings = await loadSettings()
      return ok(await readPdfBytes(filePath, settings.storageRoot))
    } catch (error) {
      if (error instanceof AppError) return err(error.message, error.code)
      return fromFilesystemError(error, 'Could not read the worksheet.')
    }
  })

  ipcMain.handle(IPC_CHANNELS.addNotePage, async (_event, request: AddNotePageRequest) => {
    try {
      if (!request?.project || !request.source) return err('Could not add a notes page.', ERROR_CODES.VALIDATION)
      return ok(await addNotePage(request.project, request.source))
    } catch (error) {
      if (error instanceof AppError) return err(error.message, error.code)
      return fromFilesystemError(error, 'Could not add a notes page.')
    }
  })

  ipcMain.handle(IPC_CHANNELS.writeCheckpoint, async (_event, project: DocumentProject) => {
    try {
      if (!project?.projectDir) return err('Nothing to checkpoint.', ERROR_CODES.VALIDATION)
      return ok(await writeCheckpoint(project))
    } catch (error) {
      return fromFilesystemError(error, 'Could not write a recovery copy.')
    }
  })

  ipcMain.handle(IPC_CHANNELS.loadCheckpoint, async (_event, projectDir: string) => {
    try {
      if (typeof projectDir !== 'string') return err('Missing document folder.', ERROR_CODES.VALIDATION)
      return ok(await loadLatestCheckpoint(projectDir))
    } catch (error) {
      if (error instanceof AppError) return err(error.message, error.code)
      return fromFilesystemError(error, 'Could not load the recovery copy.')
    }
  })

  ipcMain.handle(IPC_CHANNELS.getSession, wrap(loadSession))

  ipcMain.handle(
    IPC_CHANNELS.heartbeat,
    async (_event, session: Pick<SessionState, 'openDocumentIds' | 'activeDocumentId'>) => {
      try {
        const ids = Array.isArray(session?.openDocumentIds)
          ? session.openDocumentIds.filter((id) => typeof id === 'string')
          : []
        await heartbeat(ids, typeof session?.activeDocumentId === 'string' ? session.activeDocumentId : null)
        return ok(undefined)
      } catch (error) {
        return fromFilesystemError(error, 'Could not update the session.')
      }
    }
  )

  ipcMain.handle(IPC_CHANNELS.markCleanExit, wrap(markCleanExit))
  ipcMain.handle(IPC_CHANNELS.getRecovery, wrap(collectRecovery))

  ipcMain.handle(IPC_CHANNELS.openExternal, async (_event, filePath: string) => {
    try {
      if (typeof filePath !== 'string') return err('Missing file path.', ERROR_CODES.VALIDATION)
      const result = await shell.openPath(filePath)
      if (result) return err(result, ERROR_CODES.UNKNOWN)
      return ok(undefined)
    } catch (error) {
      return fromFilesystemError(error, 'Could not open that file.')
    }
  })

  ipcMain.handle(IPC_CHANNELS.selectPdfFiles, async () => {
    try {
      const result = await dialog.showOpenDialog({
        title: 'Choose a worksheet',
        filters: [{ name: 'PDF worksheets', extensions: ['pdf'] }],
        properties: ['openFile', 'multiSelections']
      })
      if (result.canceled) return ok([] as string[])
      return ok(result.filePaths)
    } catch (error) {
      return fromFilesystemError(error, 'Could not open the file picker.')
    }
  })

  ipcMain.handle(IPC_CHANNELS.getVersion, () => APP_VERSION)
}
