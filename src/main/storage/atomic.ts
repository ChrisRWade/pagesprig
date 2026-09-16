import { open, rename, rm } from 'node:fs/promises'
import path from 'node:path'

export async function ensureDir(directory: string): Promise<void> {
  const { mkdir } = await import('node:fs/promises')
  await mkdir(directory, { recursive: true })
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

  try {
    await rename(tempPath, filePath)
  } catch {
    await rm(filePath, { force: true })
    await rename(tempPath, filePath)
  }
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
