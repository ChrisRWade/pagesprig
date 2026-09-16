import { app } from 'electron'
import path from 'node:path'
import { ANNOTATIONS_FILE } from '@shared/constants'
import { parseSettings, defaultSettings } from '@shared/settingsSchema'
import type { AppSettings } from '@shared/types'
import { atomicWriteFile, readTextIfExists } from './atomic'

export function settingsPath(): string {
  return path.join(app.getPath('userData'), 'settings.json')
}

export function sessionPath(): string {
  return path.join(app.getPath('userData'), 'session.json')
}

export async function loadSettings(): Promise<AppSettings> {
  const raw = await readTextIfExists(settingsPath())
  if (!raw) return defaultSettings()
  try {
    return parseSettings(JSON.parse(raw))
  } catch {
    return defaultSettings()
  }
}

export async function saveSettings(settings: AppSettings): Promise<AppSettings> {
  const parsed = parseSettings(settings)
  await atomicWriteFile(settingsPath(), `${JSON.stringify(parsed, null, 2)}\n`)
  return parsed
}

export function annotationsPath(projectDir: string): string {
  return path.join(projectDir, ANNOTATIONS_FILE)
}
