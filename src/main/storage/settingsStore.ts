import { app } from 'electron'
import path from 'node:path'
import { ANNOTATIONS_FILE, LEGACY_USER_DATA_NAMES } from '@shared/constants'
import { parseSettings, defaultSettings, shouldAdoptLegacySettings, shouldKeepExistingSettings } from '@shared/settingsSchema'
import type { AppSettings } from '@shared/types'
import { atomicWriteFile, readTextIfExists } from './atomic'

export function settingsPath(): string {
  return path.join(app.getPath('userData'), 'settings.json')
}

export function sessionPath(): string {
  return path.join(app.getPath('userData'), 'session.json')
}

function legacySettingsPaths(): string[] {
  const current = path.normalize(settingsPath())
  return LEGACY_USER_DATA_NAMES.map((name) =>
    path.normalize(path.join(app.getPath('appData'), name, 'settings.json'))
  ).filter((filePath, index, all) => filePath !== current && all.indexOf(filePath) === index)
}

async function readParsedSettings(filePath: string): Promise<AppSettings | null> {
  const raw = await readTextIfExists(filePath)
  if (!raw) return null
  try {
    return parseSettings(JSON.parse(raw))
  } catch {
    return null
  }
}

export async function loadSettings(): Promise<AppSettings> {
  const current = (await readParsedSettings(settingsPath())) ?? defaultSettings()
  for (const legacyPath of legacySettingsPaths()) {
    const legacy = await readParsedSettings(legacyPath)
    if (legacy && shouldAdoptLegacySettings(current, legacy)) {
      return saveSettings(legacy)
    }
  }
  return current
}

export async function saveSettings(settings: AppSettings): Promise<AppSettings> {
  const parsed = parseSettings(settings)
  const existing = await readParsedSettings(settingsPath())
  if (existing && shouldKeepExistingSettings(existing, parsed)) {
    return existing
  }
  await atomicWriteFile(settingsPath(), `${JSON.stringify(parsed, null, 2)}\n`)
  return parsed
}

export function annotationsPath(projectDir: string): string {
  return path.join(projectDir, ANNOTATIONS_FILE)
}
