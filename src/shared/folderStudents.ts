import type { Student } from './types'

const SKIPPED = new Set(['packet'])

export function isStudentFolderName(name: string): boolean {
  const trimmed = name.trim()
  if (!trimmed || trimmed.startsWith('.')) return false
  if (SKIPPED.has(trimmed.toLowerCase())) return false
  return true
}

export function studentFolder(storageRoot: string, projectDir: string): string | null {
  const split = (value: string) => value.replace(/\\/g, '/').replace(/\/+$/, '')
  const root = split(storageRoot)
  const dir = split(projectDir)
  if (!root || !dir.toLowerCase().startsWith(`${root.toLowerCase()}/`)) return null
  const rest = dir.slice(root.length).replace(/^\/+/, '')
  const first = rest.split('/')[0]
  return first && isStudentFolderName(first) ? first : null
}

export function profileForFolder(name: string, students: readonly Student[]): Student | null {
  const key = name.trim().toLowerCase()
  return students.find((student) => student.name.trim().toLowerCase() === key) ?? null
}

/** The child a worksheet belongs to: their schoolwork folder, then a saved profile id. */
export function profileForWork(
  students: readonly Student[],
  studentId: string,
  folderName: string | null
): Student | null {
  if (folderName) {
    const byFolder = profileForFolder(folderName, students)
    if (byFolder) return byFolder
  }
  if (!studentId) return null
  return students.find((student) => student.id === studentId) ?? null
}

export interface FolderStudent {
  name: string
  avatar: string
  accentColor: string
  profile: Student | null
}

const FOLDER_COLORS = ['#2A6F6F', '#8B4B2A', '#3B6B2F', '#6B3A4A', '#1F4E79', '#7A4E1D', '#4A3B73']

export function folderStudent(name: string, students: readonly Student[], index = 0): FolderStudent {
  const profile = profileForFolder(name, students)
  return {
    name,
    avatar: profile?.avatar ?? '📘',
    accentColor: profile?.accentColor ?? FOLDER_COLORS[index % FOLDER_COLORS.length],
    profile
  }
}
