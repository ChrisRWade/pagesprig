import { ACCENT_COLORS, AVATARS, DEFAULT_SUBJECTS } from '@shared/types'
import { APP_VERSION } from '@shared/constants'
import { createId, nowIso } from '@shared/utils'
import type { Student } from '@shared/types'
import { Button } from '../shared/Button'
import { useAppStore } from '../../stores/appStore'
import styles from './SettingsScreen.module.css'

export function SettingsScreen() {
  const settings = useAppStore((state) => state.settings)
  const setSettings = useAppStore((state) => state.setSettings)
  const closeOverlay = useAppStore((state) => state.closeOverlay)
  const setError = useAppStore((state) => state.setError)

  const persist = async (next: typeof settings) => {
    const saved = await window.studyApi.saveSettings(next)
    if (!saved.ok) {
      setError(saved.error)
      return
    }
    setSettings(saved.data)
  }

  const addStudent = () => {
    const student: Student = {
      id: createId(),
      name: 'New student',
      avatar: AVATARS[settings.students.length % AVATARS.length],
      accentColor: ACCENT_COLORS[settings.students.length % ACCENT_COLORS.length],
      subjects: DEFAULT_SUBJECTS.map((item) => ({ ...item, id: createId() })),
      createdAt: nowIso()
    }
    void persist({ ...settings, students: [...settings.students, student] })
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
        <p className={styles.path}>{settings.storageRoot ?? 'No folder selected'}</p>
        <Button
          onClick={async () => {
            const selected = await window.studyApi.selectStorageDirectory()
            if (selected.ok) await persist({ ...settings, storageRoot: selected.data })
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
            value={settings.folderTemplate}
            onChange={(event) => void persist({ ...settings, folderTemplate: event.target.value })}
          />
        </label>
        <label>
          Filename template
          <input
            value={settings.filenameTemplate}
            onChange={(event) => void persist({ ...settings, filenameTemplate: event.target.value })}
          />
        </label>
        <p className={styles.help}>Tokens: {'{student} {subject} {date} {year} {month} {day} {originalName} {title}'}</p>
      </section>
      <section>
        <h2>Students</h2>
        {settings.students.map((student) => (
          <div key={student.id} className={styles.student}>
            <input
              value={student.name}
              aria-label="Student name"
              onChange={(event) =>
                void persist({
                  ...settings,
                  students: settings.students.map((item) =>
                    item.id === student.id ? { ...item, name: event.target.value } : item
                  )
                })
              }
            />
            <Button
              variant="danger"
              onClick={() =>
                void persist({
                  ...settings,
                  students: settings.students.filter((item) => item.id !== student.id)
                })
              }
            >
              Remove
            </Button>
            {student.subjects.map((subject) => (
              <input
                key={subject.id}
                value={subject.name}
                aria-label={`${student.name} subject`}
                onChange={(event) =>
                  void persist({
                    ...settings,
                    students: settings.students.map((item) =>
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
              />
            ))}
          </div>
        ))}
        <Button variant="ghost" onClick={addStudent}>
          Add student
        </Button>
      </section>
      <section>
        <h2>Saving</h2>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={settings.confirmDrop}
            onChange={(event) => void persist({ ...settings, confirmDrop: event.target.checked })}
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
