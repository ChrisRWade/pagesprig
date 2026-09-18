import { useAppStore } from '../../stores/appStore'
import styles from './StudentPicker.module.css'

export function StudentPicker() {
  const students = useAppStore((state) => state.settings.students)
  const setSettings = useAppStore((state) => state.setSettings)
  const setView = useAppStore((state) => state.setView)
  const settings = useAppStore((state) => state.settings)

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

  return (
    <main className={styles.wrap}>
      <p className={styles.kicker}>StudyPDF</p>
      <h1>Who is working?</h1>
      {students.length === 0 && (
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
      </ul>
      <button className={styles.settings} onClick={() => useAppStore.getState().openSettings()}>
        Settings
      </button>
    </main>
  )
}
