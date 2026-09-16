import { useMemo, useState } from 'react'
import { Button } from '../shared/Button'
import { openSummary } from '../today/TodayView'
import { useAppStore } from '../../stores/appStore'
import styles from './RecentDocuments.module.css'

export function RecentDocuments() {
  const documents = useAppStore((state) => state.documents)
  const settings = useAppStore((state) => state.settings)
  const closeOverlay = useAppStore((state) => state.closeOverlay)
  const [query, setQuery] = useState('')
  const [studentId, setStudentId] = useState(settings.selectedStudentId ?? '')
  const [subjectId, setSubjectId] = useState('')

  const filtered = useMemo(
    () =>
      documents.filter((item) => {
        if (studentId && item.studentId !== studentId) return false
        if (subjectId && item.subjectId !== subjectId) return false
        if (query && !item.title.toLowerCase().includes(query.toLowerCase()) && !item.date.includes(query)) {
          return false
        }
        return true
      }),
    [documents, query, studentId, subjectId]
  )

  const student = settings.students.find((item) => item.id === studentId)

  return (
    <main className={styles.wrap}>
      <header className={styles.header}>
        <h1>Recent work</h1>
        <Button variant="ghost" onClick={closeOverlay}>
          Back
        </Button>
      </header>
      <div className={styles.filters}>
        <input value={query} placeholder="Title or date" aria-label="Filter by title or date" onChange={(event) => setQuery(event.target.value)} />
        <select aria-label="Student" value={studentId} onChange={(event) => setStudentId(event.target.value)}>
          <option value="">All students</option>
          {settings.students.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <select aria-label="Subject" value={subjectId} onChange={(event) => setSubjectId(event.target.value)}>
          <option value="">All subjects</option>
          {student?.subjects.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </div>
      <ul className={styles.list}>
        {filtered.map((item) => (
          <li key={item.id}>
            <button
              className={styles.row}
              onClick={() => {
                void openSummary(item)
                closeOverlay()
              }}
            >
              <span>{item.title}</span>
              <span className={styles.meta}>
                {item.date} · {item.status.replace('_', ' ')}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </main>
  )
}
