import {
  addAnnotation,
  removeAnnotation,
  replaceAnnotation
} from './serialize'
import type { Annotation, DocumentProject } from './types'

export interface HistoryCommand {
  label: string
  apply: (project: DocumentProject) => DocumentProject
  undo: (project: DocumentProject) => DocumentProject
}

export function addAnnotationCommand(annotation: Annotation): HistoryCommand {
  return {
    label: 'Add',
    apply: (project) => addAnnotation(project, annotation),
    undo: (project) => removeAnnotation(project, annotation.id)
  }
}

export function deleteAnnotationCommand(annotation: Annotation): HistoryCommand {
  return {
    label: 'Delete',
    apply: (project) => removeAnnotation(project, annotation.id),
    undo: (project) => addAnnotation(project, annotation)
  }
}

export function modifyAnnotationCommand(before: Annotation, after: Annotation): HistoryCommand {
  return {
    label: 'Edit',
    apply: (project) => replaceAnnotation(project, after),
    undo: (project) => replaceAnnotation(project, before)
  }
}

export function deleteManyCommand(annotations: Annotation[]): HistoryCommand {
  return {
    label: 'Erase',
    apply: (project) => annotations.reduce((next, item) => removeAnnotation(next, item.id), project),
    undo: (project) => annotations.reduce((next, item) => addAnnotation(next, item), project)
  }
}

export interface HistoryState {
  undoStack: HistoryCommand[]
  redoStack: HistoryCommand[]
}

export function createHistory(): HistoryState {
  return { undoStack: [], redoStack: [] }
}

export function pushCommand(
  history: HistoryState,
  command: HistoryCommand,
  project: DocumentProject,
  limit = 250
): { history: HistoryState; project: DocumentProject } {
  const nextProject = command.apply(project)
  return {
    project: nextProject,
    history: {
      undoStack: [...history.undoStack, command].slice(-limit),
      redoStack: []
    }
  }
}

export function undoHistory(
  history: HistoryState,
  project: DocumentProject
): { history: HistoryState; project: DocumentProject } | null {
  const command = history.undoStack[history.undoStack.length - 1]
  if (!command) return null
  return {
    project: command.undo(project),
    history: {
      undoStack: history.undoStack.slice(0, -1),
      redoStack: [...history.redoStack, command]
    }
  }
}

export function redoHistory(
  history: HistoryState,
  project: DocumentProject
): { history: HistoryState; project: DocumentProject } | null {
  const command = history.redoStack[history.redoStack.length - 1]
  if (!command) return null
  return {
    project: command.apply(project),
    history: {
      undoStack: [...history.undoStack, command],
      redoStack: history.redoStack.slice(0, -1)
    }
  }
}

export function canUndo(history: HistoryState): boolean {
  return history.undoStack.length > 0
}

export function canRedo(history: HistoryState): boolean {
  return history.redoStack.length > 0
}
