import { ACCENT_COLORS, AVATARS, DEFAULT_SUBJECTS } from '@shared/types'
import { createId, nowIso } from '@shared/utils'
import type { AppSettings, Student } from '@shared/types'
import { Button } from '../shared/Button'
import { useAppStore } from '../../stores/appStore'
import styles from './SetupWizard.module.css'
import { useState } from 'react'

export function SetupWizard() {
  const settings = useAppStore((state) => state.settings)
  const setSettings = useAppStore((state) => state.setSettings)
  const setView = useAppStore((state) => state.setView)
  const setError = useAppStore((state) => state.setError)
  const [step, setStep] = useState(settings.storageRoot ? 1 : 0)
  const [draft, setDraft] = useState<AppSettings>(settings)

  const persist = async (next: AppSettings, complete = false) => {
    const saved = await window.studyApi.saveSettings({ ...next, setupComplete: complete || next.setupComplete })
    if (!saved.ok) {
      setError(saved.error)
      return null
    }
    setDraft(saved.data)
    setSettings(saved.data)
    return saved.data
  }

  const chooseFolder = async () => {
    const selected = await window.studyApi.selectStorageDirectory()
    if (!selected.ok) {
      setError(selected.error)
      return
    }
    await persist({ ...draft, storageRoot: selected.data })
    setStep(1)
  }

  const addStudent = () => {
    const student: Student = {
      id: createId(),
      name: '',
      avatar: AVATARS[draft.students.length % AVATARS.length],
      accentColor: ACCENT_COLORS[draft.students.length % ACCENT_COLORS.length],
      subjects: DEFAULT_SUBJECTS.map((item) => ({ ...item, id: createId() })),
      createdAt: nowIso()
    }
    setDraft({ ...draft, students: [...draft.students, student] })
  }

  const finish = async () => {
    const named = draft.students.filter((item) => item.name.trim().length > 0)
    if (!draft.storageRoot) {
      setError('Choose a folder for schoolwork first.')
      return
    }
    if (named.length === 0) {
      setError('Add at least one student name.')
      return
    }
    const next = {
      ...draft,
      students: named,
      selectedStudentId: named[0].id,
      selectedSubjectId: named[0].subjects[0]?.id ?? null,
      setupComplete: true
    }
    const saved = await persist(next, true)
    if (saved) setView('main')
  }

  return (
    <main className={styles.wrap}>
      <p className={styles.kicker}>StudyPDF</p>
      {step === 0 && (
        <>
          <h1>A notebook for worksheets.</h1>
          <p>
            Choose a folder on this computer for schoolwork. It can be a regular folder, a Google Drive for Desktop
            folder, OneDrive, Dropbox, or any other synced folder. StudyPDF never uploads files itself.
          </p>
          <Button onClick={() => void chooseFolder()}>Choose schoolwork folder</Button>
        </>
      )}
      {step === 1 && (
        <>
          <h1>Who is using this computer?</h1>
          <p>Add each child. You can change this later in Settings.</p>
          <ul className={styles.list}>
            {draft.students.map((student, index) => (
              <li key={student.id} className={styles.student}>
                <select
                  aria-label="Avatar"
                  value={student.avatar}
                  onChange={(event) => {
                    const students = draft.students.map((item, i) =>
                      i === index ? { ...item, avatar: event.target.value } : item
                    )
                    setDraft({ ...draft, students })
                  }}
                >
                  {AVATARS.map((avatar) => (
                    <option key={avatar}>{avatar}</option>
                  ))}
                </select>
                <input
                  value={student.name}
                  placeholder="First name"
                  aria-label="Student name"
                  onChange={(event) => {
                    const students = draft.students.map((item, i) =>
                      i === index ? { ...item, name: event.target.value } : item
                    )
                    setDraft({ ...draft, students })
                  }}
                />
              </li>
            ))}
          </ul>
          <Button variant="ghost" onClick={addStudent}>
            Add another student
          </Button>
          <div className={styles.actions}>
            <Button variant="ghost" onClick={() => setStep(0)}>
              Back
            </Button>
            <Button onClick={() => setStep(2)}>Next</Button>
          </div>
        </>
      )}
      {step === 2 && (
        <>
          <h1>Subjects</h1>
          <p>Each student can have different subjects. Rename them to match your curriculum.</p>
          {draft.students.map((student) => (
            <section key={student.id} className={styles.subjects}>
              <h2>
                {student.avatar} {student.name || 'Student'}
              </h2>
              {student.subjects.map((subject, index) => (
                <input
                  key={subject.id}
                  value={subject.name}
                  aria-label={`${student.name || 'Student'} subject ${index + 1}`}
                  onChange={(event) => {
                    const students = draft.students.map((item) =>
                      item.id === student.id
                        ? {
                            ...item,
                            subjects: item.subjects.map((entry, i) =>
                              i === index ? { ...entry, name: event.target.value } : entry
                            )
                          }
                        : item
                    )
                    setDraft({ ...draft, students })
                  }}
                />
              ))}
            </section>
          ))}
          <div className={styles.actions}>
            <Button variant="ghost" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button onClick={() => void finish()}>Start schoolwork</Button>
          </div>
        </>
      )}
    </main>
  )
}
