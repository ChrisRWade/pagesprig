import { useEffect, useState } from 'react'
import { folderStudent, profileForFolder } from '@shared/folderStudents'
import { DEFAULT_SUBJECTS } from '@shared/types'
import { createId, nowIso } from '@shared/utils'
import { useAppStore } from '../../stores/appStore'
import { BrandLockup } from './Brand'
import styles from './StudentPicker.module.css'

export function StudentPicker() {
  const students = useAppStore((state) => state.settings.students)
  const setSettings = useAppStore((state) => state.setSettings)
  const setView = useAppStore((state) => state.setView)
  const settings = useAppStore((state) => state.settings)
  const [folders, setFolders] = useState<string[]>([])

  useEffect(() => {
    void window.studyApi.listStudentFolders().then((result) => {
      if (result.ok) setFolders(result.data.map((folder) => folder.name))
    })
  }, [])

  const extras = folders.filter((name) => !profileForFolder(name, students))

  const choose = async (id: string) => {
    const student = students.find((item) => item.id === id)
    const next = {
      ...settings,
      selectedStudentId: id,
      selectedSubjectId: student?.subjects[0]?.id ?? null
    }
    const saved = await window.studyApi.saveSettings(next)
    if (saved.ok) {
      setSettings(saved.data)
      setView('main')
    }
  }

  const chooseFolder = async (name: string, index: number) => {
    const existing = profileForFolder(name, students)
    if (existing) {
      await choose(existing.id)
      return
    }
    const person = folderStudent(name, students, students.length + index)
    const created = {
      id: createId(),
      name,
      avatar: person.avatar,
      accentColor: person.accentColor,
      subjects: DEFAULT_SUBJECTS,
      createdAt: nowIso()
    }
    const next = {
      ...settings,
      students: [...students, created],
      selectedStudentId: created.id,
      selectedSubjectId: created.subjects[0]?.id ?? null
    }
    const saved = await window.studyApi.saveSettings(next)
    if (saved.ok) {
      setSettings(saved.data)
      setView('main')
    }
  }

  return (
    <main className={styles.wrap}>
      <BrandLockup size="lg" />
      <h1>Who is working?</h1>
      {students.length === 0 && extras.length === 0 && (
        <p className={styles.empty}>No students yet. Open Settings to add the first child.</p>
      )}
      <ul className={styles.grid}>
        {students.map((student) => (
          <li key={student.id}>
            <button className={styles.card} onClick={() => void choose(student.id)} style={{ '--accent': student.accentColor } as never}>
              <span className={styles.avatar} aria-hidden="true">
                {student.avatar}
              </span>
              {student.name}
            </button>
          </li>
        ))}
        {extras.map((name, index) => {
          const person = folderStudent(name, students, students.length + index)
          return (
            <li key={name}>
              <button
                className={styles.card}
                onClick={() => void chooseFolder(name, index)}
                style={{ '--accent': person.accentColor } as never}
              >
                <span className={styles.avatar} aria-hidden="true">
                  {person.avatar}
                </span>
                {name}
              </button>
            </li>
          )
        })}
        {(students.length > 0 || extras.length > 0) && (
          <li>
            <button className={styles.review} onClick={() => setView('review')}>
              <span className={styles.avatar} aria-hidden="true">
                📅
              </span>
              Review
            </button>
          </li>
        )}
      </ul>
      <button className={styles.settings} onClick={() => useAppStore.getState().openSettings()}>
        Settings
      </button>
    </main>
  )
}

