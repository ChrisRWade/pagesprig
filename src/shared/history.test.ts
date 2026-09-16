import { describe, expect, it } from 'vitest'
import {
  addAnnotationCommand,
  createHistory,
  deleteAnnotationCommand,
  modifyAnnotationCommand,
  pushCommand,
  redoHistory,
  undoHistory
} from './history'
import type { DocumentProject, StrokeAnnotation } from './types'

const stroke = (id: string, x = 0.1): StrokeAnnotation => ({
  id,
  type: 'stroke',
  page: 1,
  createdAt: '2026-09-16T12:00:00.000Z',
  updatedAt: '2026-09-16T12:00:00.000Z',
  style: { color: '#000000', width: 1, opacity: 1 },
  points: [
    { x, y: 0.2 },
    { x: x + 0.1, y: 0.3 }
  ]
})

const project = (): DocumentProject => ({
  version: 1,
  id: 'doc',
  studentId: 's',
  subjectId: 'math',
  date: '2026-09-16',
  title: 'Notes',
  originalFilename: 'notes.pdf',
  sourcePdfPath: '/tmp/original.pdf',
  projectDir: '/tmp/doc',
  exportPdfPath: '/tmp/doc/notes.pdf',
  pages: [{ page: 1, source: 'original', originalPage: 1, width: 612, height: 792 }],
  annotations: [{ page: 1, annotations: [] }],
  status: 'not_started',
  createdAt: '2026-09-16T12:00:00.000Z',
  updatedAt: '2026-09-16T12:00:00.000Z',
  lastOpenedAt: '2026-09-16T12:00:00.000Z',
  fingerprint: '1'
})

describe('undo and redo', () => {
  it('adds, undoes, and redoes an annotation without snapshotting the whole project', () => {
    let history = createHistory()
    let current = project()
    const added = pushCommand(history, addAnnotationCommand(stroke('a')), current)
    current = added.project
    history = added.history
    expect(current.annotations[0].annotations).toHaveLength(1)

    const undone = undoHistory(history, current)
    expect(undone).not.toBeNull()
    current = undone!.project
    history = undone!.history
    expect(current.annotations[0].annotations).toHaveLength(0)

    const redone = redoHistory(history, current)
    expect(redone?.project.annotations[0].annotations[0].id).toBe('a')
  })

  it('records style edits as invert-able commands', () => {
    const before = stroke('a')
    const after = { ...before, style: { ...before.style, color: '#c00' } }
    let history = createHistory()
    let current = pushCommand(createHistory(), addAnnotationCommand(before), project()).project
    const edited = pushCommand(history, modifyAnnotationCommand(before, after), current)
    current = edited.project
    history = edited.history
    expect(current.annotations[0].annotations[0].style.color).toBe('#c00')
    const undone = undoHistory(history, current)
    expect(undone?.project.annotations[0].annotations[0].style.color).toBe('#000000')
  })

  it('clears redo when a new command is pushed', () => {
    let history = createHistory()
    let current = project()
    const first = pushCommand(history, addAnnotationCommand(stroke('a')), current)
    current = first.project
    history = first.history
    const undone = undoHistory(history, current)!
    const second = pushCommand(undone.history, addAnnotationCommand(stroke('b')), undone.project)
    expect(second.history.redoStack).toHaveLength(0)
    expect(second.project.annotations[0].annotations[0].id).toBe('b')
  })

  it('restores a deleted annotation', () => {
    const item = stroke('a')
    const current = pushCommand(createHistory(), addAnnotationCommand(item), project()).project
    const deleted = pushCommand(createHistory(), deleteAnnotationCommand(item), current)
    expect(deleted.project.annotations[0].annotations).toHaveLength(0)
    const undone = undoHistory(deleted.history, deleted.project)
    expect(undone?.project.annotations[0].annotations[0].id).toBe('a')
  })
})
