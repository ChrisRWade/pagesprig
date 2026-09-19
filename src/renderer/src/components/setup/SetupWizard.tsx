import { useState } from 'react'
import { ACCENT_COLORS, AVATARS, DEFAULT_SUBJECTS } from '@shared/types'
import { createId, nowIso } from '@shared/utils'
import type { AppSettings, Student, Subject } from '@shared/types'
import { Button } from '../shared/Button'
import { AvatarField } from '../shared/AvatarField'
import { APP_NAME } from '@shared/constants'
import { useAppStore } from '../../stores/appStore'
import { BrandLockup } from '../chrome/Brand'
import styles from './SetupWizard.module.css'

function emptyStudent(index: number): Student {
  return {
    id: createId(),
    name: '',
    avatar: AVATARS[index % AVATARS.length],
    accentColor: ACCENT_COLORS[index % ACCENT_COLORS.length],
    subjects: DEFAULT_SUBJECTS.map((item) => ({ ...item, id: createId() })),
    createdAt: nowIso()
  }
}

export function SetupWizard() {
  const settings = useAppStore((state) => state.settings)
  const setSettings = useAppStore((state) => state.setSettings)
  const setView = useAppStore((state) => state.setView)
  const setError = useAppStore((state) => state.setError)
  const [step, setStep] = useState(settings.storageRoot ? 1 : 0)
  const [draft, setDraft] = useState<AppSettings>(() =>
    settings.students.length > 0 ? settings : { ...settings, students: [emptyStudent(0)] }
  )

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
    setDraft({ ...draft, students: [...draft.students, emptyStudent(draft.students.length)] })
  }

  const removeStudent = (id: string) => {
    setDraft({ ...draft, students: draft.students.filter((item) => item.id !== id) })
  }

  const addSubject = (studentId: string) => {
    const next: Subject = {
      id: createId(),
      name: '',
      color: ACCENT_COLORS[0]
    }
    setDraft({
      ...draft,
      students: draft.students.map((item) =>
        item.id === studentId ? { ...item, subjects: [...item.subjects, next] } : item
      )
    })
  }

  const removeSubject = (studentId: string, subjectId: string) => {
    setDraft({
      ...draft,
      students: draft.students.map((item) =>
        item.id === studentId
          ? { ...item, subjects: item.subjects.filter((subject) => subject.id !== subjectId) }
          : item
      )
    })
  }

  const finish = async () => {
    const named = draft.students
      .map((student) => ({
        ...student,
        name: student.name.trim(),
        subjects: student.subjects.filter((subject) => subject.name.trim().length > 0)
      }))
      .filter((item) => item.name.length > 0)
    if (!draft.storageRoot) {
      setError('Choose a folder for schoolwork first.')
      return
    }
    if (named.length === 0) {
      setError('Add at least one student name.')
      return
    }
    if (named.some((item) => item.subjects.length === 0)) {
      setError('Each student needs at least one subject.')
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
      <BrandLockup size="lg" />
      {step === 0 && (
        <>
          <h1>A notebook for worksheets.</h1>
          <p>
            Choose a folder on this computer for schoolwork. It can be a regular folder, a Google Drive for Desktop
            folder, OneDrive, Dropbox, or any other synced folder. {APP_NAME} never uploads files itself.
          </p>
          <Button onClick={() => void chooseFolder()}>Choose schoolwork folder</Button>
        </>
      )}
      {step === 1 && (
        <>
          <h1>Who is using this computer?</h1>
          <p>Add each child. The icon is the little picture next to their name.</p>
          {draft.students.length === 0 || draft.students.every((item) => !item.name.trim()) ? (
            <p className={styles.empty}>No students yet. Type a first name below, or add a child to get started.</p>
          ) : null}
          <ul className={styles.list}>
            {draft.students.map((student, index) => (
              <li key={student.id} className={styles.student}>
                <AvatarField
                  value={student.avatar}
                  onChange={(avatar) => {
                    const students = draft.students.map((item, i) => (i === index ? { ...item, avatar } : item))
                    setDraft({ ...draft, students })
                  }}
                />
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
                <Button variant="ghost" aria-label={`Remove ${student.name || 'student'}`} onClick={() => removeStudent(student.id)}>
                  Remove
                </Button>
              </li>
            ))}
          </ul>
          <Button variant="ghost" onClick={addStudent}>
            {draft.students.length === 0 ? 'Add a student' : 'Add another student'}
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
          <p>Each student can have different subjects. Start with these four, then add more if you need them.</p>
          {draft.students.map((student) => (
            <section key={student.id} className={styles.subjects}>
              <h2>
                {student.avatar} {student.name || 'Student'}
              </h2>
              {student.subjects.map((subject, index) => (
                <div key={subject.id} className={styles.subjectRow}>
                  <input
                    value={subject.name}
                    placeholder="Subject name"
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
                  <Button
                    variant="ghost"
                    aria-label={`Remove ${subject.name || 'subject'}`}
                    onClick={() => removeSubject(student.id, subject.id)}
                  >
                    Remove
                  </Button>
                </div>
              ))}
              <Button variant="ghost" onClick={() => addSubject(student.id)}>
                Add subject
              </Button>
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
