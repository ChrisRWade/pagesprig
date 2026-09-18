import { useEffect, useRef, useState } from 'react'
import { ACCENT_COLORS, AVATARS, DEFAULT_SUBJECTS } from '@shared/types'
import { APP_VERSION } from '@shared/constants'
import { createId, nowIso } from '@shared/utils'
import type { AppSettings, Student, Subject } from '@shared/types'
import { Button } from '../shared/Button'
import { AvatarField } from '../shared/AvatarField'
import { useAppStore } from '../../stores/appStore'
import styles from './SettingsScreen.module.css'

export function SettingsScreen() {
  const settings = useAppStore((state) => state.settings)
  const setSettings = useAppStore((state) => state.setSettings)
  const closeOverlay = useAppStore((state) => state.closeOverlay)
  const setView = useAppStore((state) => state.setView)
  const setError = useAppStore((state) => state.setError)
  const [draft, setDraft] = useState<AppSettings>(settings)
  const draftRef = useRef(settings)
  const persistChain = useRef(Promise.resolve())

  useEffect(() => {
    draftRef.current = settings
    setDraft(settings)
  }, [settings])

  const updateDraft = (next: AppSettings) => {
    draftRef.current = next
    setDraft(next)
  }

  const persistLatest = () => {
    persistChain.current = persistChain.current.catch(() => undefined).then(async () => {
      const snapshot = draftRef.current
      const saved = await window.studyApi.saveSettings(snapshot)
      if (!saved.ok) {
        setError(saved.error)
        return
      }
      if (draftRef.current !== snapshot) return
      draftRef.current = saved.data
      setDraft(saved.data)
      setSettings(saved.data)
    })
  }

  const persist = (next: AppSettings) => {
    updateDraft(next)
    persistLatest()
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
    void persist({ ...draft, students: [...draft.students, student] })
  }

  const removeStudent = (id: string) => {
    const students = draft.students.filter((item) => item.id !== id)
    const selectedStudentId =
      draft.selectedStudentId === id ? (students[0]?.id ?? null) : draft.selectedStudentId
    const selected = students.find((item) => item.id === selectedStudentId)
    void persist({
      ...draft,
      students,
      selectedStudentId,
      selectedSubjectId: selected?.subjects[0]?.id ?? null,
      setupComplete: students.length > 0 && Boolean(draft.storageRoot)
    })
    if (students.length === 0) setView('setup')
  }

  const addSubject = (studentId: string) => {
    const next: Subject = { id: createId(), name: 'New subject', color: ACCENT_COLORS[0] }
    void persist({
      ...draft,
      students: draft.students.map((item) =>
        item.id === studentId ? { ...item, subjects: [...item.subjects, next] } : item
      )
    })
  }

  const removeSubject = (studentId: string, subjectId: string) => {
    void persist({
      ...draft,
      students: draft.students.map((item) =>
        item.id === studentId
          ? { ...item, subjects: item.subjects.filter((subject) => subject.id !== subjectId) }
          : item
      ),
      selectedSubjectId: draft.selectedSubjectId === subjectId ? null : draft.selectedSubjectId
    })
  }

  return (
    <main className={styles.wrap}>
      <header className={styles.header}>
        <h1>Settings</h1>
        <Button variant="ghost" onClick={closeOverlay}>
          Back to schoolwork
        </Button>
      </header>
      <section>
        <h2>Schoolwork folder</h2>
        <p className={styles.help}>
          StudyPDF saves only to this folder. If it is a Google Drive for Desktop, OneDrive, or Dropbox folder,
          that app handles syncing. No Google API credentials are required.
        </p>
        <p className={styles.path}>{draft.storageRoot ?? 'No folder selected'}</p>
        <Button
          onClick={async () => {
            const selected = await window.studyApi.selectStorageDirectory()
            if (selected.ok) persist({ ...draft, storageRoot: selected.data })
          }}
        >
          Change folder
        </Button>
      </section>
      <section>
        <h2>Folder and file names</h2>
        <label>
          Folder template
          <input
            value={draft.folderTemplate}
            onBlur={() => persist(draftRef.current)}
            onChange={(event) => updateDraft({ ...draft, folderTemplate: event.target.value })}
          />
        </label>
        <label>
          Filename template
          <input
            value={draft.filenameTemplate}
            onBlur={() => persist(draftRef.current)}
            onChange={(event) => updateDraft({ ...draft, filenameTemplate: event.target.value })}
          />
        </label>
        <p className={styles.help}>Tokens: {'{student} {subject} {date} {year} {month} {day} {originalName} {title}'}</p>
      </section>
      <section>
        <h2>Students</h2>
        <p className={styles.help}>The icon is the small picture shown next to each name.</p>
        {draft.students.length === 0 && <p className={styles.help}>No students yet. Add the first child below.</p>}
        {draft.students.map((student) => (
          <div key={student.id} className={styles.student}>
            <div className={styles.studentRow}>
              <AvatarField
                value={student.avatar}
                onChange={(avatar) =>
                  void persist({
                    ...draft,
                    students: draft.students.map((item) => (item.id === student.id ? { ...item, avatar } : item))
                  })
                }
              />
              <input
                value={student.name}
                aria-label="Student name"
                placeholder="First name"
                onChange={(event) =>
                  updateDraft({
                    ...draft,
                    students: draft.students.map((item) =>
                      item.id === student.id ? { ...item, name: event.target.value } : item
                    )
                  })
                }
                onBlur={() => persist(draftRef.current)}
              />
              <Button variant="danger" onClick={() => removeStudent(student.id)}>
                Remove student
              </Button>
            </div>
            {student.subjects.map((subject) => (
              <div key={subject.id} className={styles.subjectRow}>
                <input
                  value={subject.name}
                  aria-label={`${student.name || 'Student'} subject`}
                  placeholder="Subject name"
                  onChange={(event) =>
                    updateDraft({
                      ...draft,
                      students: draft.students.map((item) =>
                        item.id === student.id
                          ? {
                              ...item,
                              subjects: item.subjects.map((entry) =>
                                entry.id === subject.id ? { ...entry, name: event.target.value } : entry
                              )
                            }
                          : item
                      )
                    })
                  }
                  onBlur={() => persist(draftRef.current)}
                />
                <Button variant="ghost" onClick={() => removeSubject(student.id, subject.id)}>
                  Remove
                </Button>
              </div>
            ))}
            <Button variant="ghost" onClick={() => addSubject(student.id)}>
              Add subject
            </Button>
          </div>
        ))}
        <Button variant="ghost" onClick={addStudent}>
          {draft.students.length === 0 ? 'Add a student' : 'Add another student'}
        </Button>
      </section>
      <section>
        <h2>Saving</h2>
        <p className={styles.help}>
          Marks are saved automatically while you work. Save PDF writes the finished worksheet you can print or turn in.
        </p>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={draft.confirmDrop}
            onChange={(event) => void persist({ ...draft, confirmDrop: event.target.checked })}
          />
          Ask before adding a dropped PDF
        </label>
      </section>
      <section>
        <h2>About</h2>
        <p>StudyPDF {APP_VERSION}. No accounts, analytics, or cloud backend.</p>
      </section>
    </main>
  )
}
