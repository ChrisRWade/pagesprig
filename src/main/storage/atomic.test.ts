import { mkdir, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { atomicWriteFile, readTextIfExists } from './atomic'

describe('atomic writes', () => {
  it('replaces the destination file without leaving a partial document', async () => {
    const dir = path.join(tmpdir(), `studypdf-atomic-${Date.now()}`)
    await mkdir(dir, { recursive: true })
    const file = path.join(dir, 'annotations.study.json')
    await atomicWriteFile(file, '{"ok":1}')
    await atomicWriteFile(file, '{"ok":2}')
    expect(await readFile(file, 'utf8')).toBe('{"ok":2}')
    expect(await readTextIfExists(path.join(dir, 'missing.json'))).toBeNull()
  })
})
