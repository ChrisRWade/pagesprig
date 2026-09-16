import path from 'node:path'
import { ERROR_CODES, type ErrorCode } from '@shared/constants'
import type { IpcErr, IpcOk } from '@shared/ipc'

export function ok<T>(data: T): IpcOk<T> {
  return { ok: true, data }
}

export function err(error: string, code: ErrorCode = ERROR_CODES.UNKNOWN): IpcErr {
  return { ok: false, error, code }
}

export function fromFilesystemError(error: unknown, fallback = 'Could not save schoolwork.'): IpcErr {
  const code = (error as NodeJS.ErrnoException).code
  const message = error instanceof Error ? error.message : String(error)
  if (code === 'ENOSPC') {
    return err('The disk is full. Free up space and try again.', ERROR_CODES.DISK_FULL)
  }
  if (code === 'EBUSY' || code === 'EPERM' || code === 'EACCES') {
    return err(
      'The file is in use or the folder is not writable. Close other programs and check Google Drive or OneDrive.',
      ERROR_CODES.FILE_LOCKED
    )
  }
  if (code === 'ENOENT') {
    return err(
      'The schoolwork folder is missing. Check that the drive or sync folder is available.',
      ERROR_CODES.STORAGE_UNAVAILABLE
    )
  }
  return err(`${fallback} ${message}`, ERROR_CODES.SAVE_FAILED)
}

export function isInsideRoot(root: string, target: string): boolean {
  const resolvedRoot = path.resolve(root)
  const resolvedTarget = path.resolve(target)
  const relative = path.relative(resolvedRoot, resolvedTarget)
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

export class AppError extends Error {
  code: ErrorCode

  constructor(message: string, code: ErrorCode = ERROR_CODES.UNKNOWN) {
    super(message)
    this.code = code
  }
}
