import { copyFile, open, rename, rm } from 'node:fs/promises'
import path from 'node:path'

export async function ensureDir(directory: string): Promise<void> {
  const { mkdir } = await import('node:fs/promises')
  await mkdir(directory, { recursive: true })
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isBusy(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException).code
  return code === 'EBUSY' || code === 'EPERM' || code === 'EACCES' || code === 'EAGAIN'
}

async function replaceWithRetry(tempPath: string, filePath: string): Promise<void> {
  let lastError: unknown
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      if (process.platform === 'win32') {
        await copyFile(tempPath, filePath)
        await rm(tempPath, { force: true })
      } else {
        await rename(tempPath, filePath)
      }
      return
    } catch (error) {
      lastError = error
      if (process.platform !== 'win32') {
        try {
          await copyFile(tempPath, filePath)
          await rm(tempPath, { force: true })
          return
        } catch (copyError) {
          lastError = copyError
        }
      }
      if (!isBusy(lastError) && attempt > 1) break
      await sleep(100 * 2 ** attempt)
    }
  }
  await rm(tempPath, { force: true }).catch(() => undefined)
  throw lastError
}

export async function atomicWriteFile(filePath: string, contents: string | Uint8Array): Promise<void> {
  const directory = path.dirname(filePath)
  await ensureDir(directory)
  const tempPath = path.join(
    directory,
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`
  )
  const handle = await open(tempPath, 'w')
  try {
    await handle.writeFile(contents)
    await handle.sync()
  } finally {
    await handle.close()
  }
  await replaceWithRetry(tempPath, filePath)
}

export async function readTextIfExists(filePath: string): Promise<string | null> {
  const { readFile } = await import('node:fs/promises')
  try {
    return await readFile(filePath, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}
