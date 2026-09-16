import { describe, expect, it } from 'vitest'
import { defaultSettings, parseSettings, settingsNeedSetup } from './settingsSchema'

describe('settings schema', () => {
  it('returns defaults for empty input', () => {
    const settings = parseSettings(null)
    expect(settings.version).toBe(1)
    expect(settings.students).toEqual([])
    expect(settingsNeedSetup(settings)).toBe(true)
  })

  it('preserves student subjects and migrates missing fields', () => {
    const settings = parseSettings({
      version: 1,
      storageRoot: 'D:/School',
      students: [
        {
          id: 's1',
          name: 'Alex',
          subjects: [{ id: 'math', name: 'Math' }]
        }
      ],
      setupComplete: true
    })
    expect(settings.storageRoot).toBe('D:/School')
    expect(settings.students[0].avatar).toBe('📘')
    expect(settings.students[0].subjects[0].color).toBeTruthy()
    expect(settingsNeedSetup(settings)).toBe(false)
  })

  it('does not load a newer incompatible settings version', () => {
    const settings = parseSettings({ ...defaultSettings(), version: 99, storageRoot: 'X:/nope' })
    expect(settings.storageRoot).toBeNull()
  })
})
