import { formatDate } from '@shared/utils'
import type { DocumentSummary, Student } from '@shared/types'
import { Button } from '../shared/Button'
import { useAppStore } from '../../stores/appStore'
import { useDocumentStore } from '../../stores/documentStore'
import styles from './TodayView.module.css'

interface Props {
  student: Student
  subjectId: string
  documents: DocumentSummary[]
}

export async function openSummary(summary: DocumentSummary): Promise<void> {
  const loaded = await window.studyApi.loadProject(summary.projectDir)
  if (!loaded.ok) {
    useAppStore.getState().setError(loaded.error)
    return
  }
  const bytes = await window.studyApi.readPdf(loaded.data.sourcePdfPath)
  if (!bytes.ok) {
    useAppStore.getState().setError(bytes.error)
    return
  }
  useDocumentStore.getState().openDocument(loaded.data, bytes.data)
}

export function TodayView({ student, subjectId, documents }: Props) {
  const today = new Date().toISOString().slice(0, 10)
  const subject = student.subjects.find((item) => item.id === subjectId)
  const todays = documents.filter(
    (item) => item.studentId === student.id && item.date === today && (!subjectId || item.subjectId === subjectId)
  )
  const grouped = student.subjects
    .filter((item) => !subjectId || item.id === subjectId)
    .map((item) => ({
      subject: item,
      items: documents.filter((doc) => doc.studentId === student.id && doc.date === today && doc.subjectId === item.id)
    }))

  const choosePdf = async () => {
    const result = await window.studyApi.selectPdfFiles()
    if (!result.ok) {
      useAppStore.getState().setError(result.error)
      return
    }
    if (result.data.length > 0) useAppStore.getState().setPendingDrop(result.data)
  }

  return (
    <section className={styles.today}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>{formatDate(today)}</p>
          <h1>{student.name}&rsquo;s schoolwork</h1>
        </div>
        <Button onClick={() => void choosePdf()}>Open PDF</Button>
      </header>
      <div className={styles.dropHint} role="note">
        Drop a PDF here to add it to {subject?.name ?? 'this subject'}.
      </div>
      {grouped.every((group) => group.items.length === 0) && (
        <p className={styles.empty}>Nothing for today yet. Drag a worksheet onto this window.</p>
      )}
      {grouped.map((group) =>
        group.items.length === 0 ? null : (
          <section key={group.subject.id} className={styles.group}>
            <h2>{group.subject.name}</h2>
            <ul>
              {group.items.map((item) => (
                <li key={item.id}>
                  <button className={styles.row} onClick={() => void openSummary(item)}>
                    <span>{item.title}</span>
                    <Status status={item.status} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )
      )}
      {todays.length === 0 && documents.some((item) => item.studentId === student.id) && (
        <p className={styles.muted}>Older work is in Recent.</p>
      )}
    </section>
  )
}

function Status({ status }: { status: DocumentSummary['status'] }) {
  const label = status === 'completed' ? 'Completed' : status === 'in_progress' ? 'In progress' : 'Not started'
  return <span className={styles[status]}>{label}</span>
}
