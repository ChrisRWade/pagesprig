import { Button } from '../shared/Button'
import { useAppStore } from '../../stores/appStore'
import { useDocumentStore } from '../../stores/documentStore'
import styles from './AppHeader.module.css'

export function AppHeader() {
  const settings = useAppStore((state) => state.settings)
  const setSettings = useAppStore((state) => state.setSettings)
  const setView = useAppStore((state) => state.setView)
  const thumbnailsOpen = useAppStore((state) => state.thumbnailsOpen)
  const student = settings.students.find((item) => item.id === settings.selectedStudentId)
  const saveStatus = useDocumentStore((state) =>
    state.activeId ? state.open[state.activeId]?.saveStatus : 'idle'
  )

  if (!student) return null

  const selectStudent = async (id: string) => {
    const nextStudent = settings.students.find((item) => item.id === id)
    const next = {
      ...settings,
      selectedStudentId: id,
      selectedSubjectId: nextStudent?.subjects[0]?.id ?? null
    }
    const saved = await window.studyApi.saveSettings(next)
    if (saved.ok) setSettings(saved.data)
    useDocumentStore.getState().setActive(null)
  }

  const selectSubject = async (id: string) => {
    const saved = await window.studyApi.saveSettings({ ...settings, selectedSubjectId: id })
    if (saved.ok) setSettings(saved.data)
    useDocumentStore.getState().setActive(null)
  }

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <label className={styles.student}>
          <span className="visually-hidden">Student</span>
          <select
            value={student.id}
            aria-label="Student"
            onChange={(event) => void selectStudent(event.target.value)}
          >
            {settings.students.map((item) => (
              <option key={item.id} value={item.id}>
                {item.avatar} {item.name}
              </option>
            ))}
          </select>
        </label>
        <nav className={styles.tabs} aria-label="Subjects">
          {student.subjects.map((subject) => (
            <button
              key={subject.id}
              className={subject.id === settings.selectedSubjectId ? styles.tabOn : styles.tab}
              onClick={() => void selectSubject(subject.id)}
            >
              {subject.name}
            </button>
          ))}
        </nav>
      </div>
      <div className={styles.right}>
        <span className={styles.status} aria-live="polite">
          {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'error' ? 'Not saved' : 'Saved'}
        </span>
        <Button variant="ghost" onClick={() => setView('recent')}>
          Recent
        </Button>
        <Button
          variant="ghost"
          aria-pressed={thumbnailsOpen}
          onClick={() => useAppStore.getState().setThumbnailsOpen(!thumbnailsOpen)}
        >
          Pages
        </Button>
        <Button variant="ghost" onClick={() => useAppStore.getState().openSettings()}>
          Settings
        </Button>
        <Button variant="ghost" onClick={() => useDocumentStore.getState().setActive(null)}>
          Today
        </Button>
      </div>
    </header>
  )
}
