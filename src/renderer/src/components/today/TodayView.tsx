import { useEffect, useMemo, useState } from 'react'
import type { DocumentSummary, Student } from '@shared/types'
import { formatDate, formatDayChip, formatShortDate, localIsoDate, schoolDayWindow } from '@shared/utils'
import { Button } from '../shared/Button'
import { ExportStamp } from '../shared/ExportStamp'
import { useAppStore } from '../../stores/appStore'
import { openSummary, refreshDocuments, removeDocument } from '../../services/documents'
import styles from './TodayView.module.css'

interface Props {
  student: Student
  subjectId: string
  documents: DocumentSummary[]
}

export function TodayView({ student, subjectId, documents }: Props) {
  const today = localIsoDate()
  const [selectedDate, setSelectedDate] = useState(today)
  const subject = student.subjects.find((item) => item.id === subjectId)
  const isToday = selectedDate === today

  useEffect(() => {
    setSelectedDate(localIsoDate())
  }, [student.id, subjectId])

  useEffect(() => {
    void refreshDocuments()
  }, [])

  const scoped = useMemo(
    () =>
      documents.filter(
        (item) => item.studentId === student.id && (!subjectId || item.subjectId === subjectId)
      ),
    [documents, student.id, subjectId]
  )
  const workDates = useMemo(() => [...new Set(scoped.map((item) => item.date))].sort(), [scoped])
  const days = schoolDayWindow(workDates, selectedDate, today)
  const earlier = workDates.filter((date) => date < selectedDate)
  const later = workDates.filter((date) => date > selectedDate)
  const previousDate = earlier[earlier.length - 1]
  const nextDate = later[0] ?? (selectedDate < today ? today : undefined)
  const items = scoped.filter((item) => item.date === selectedDate)
  const grouped = student.subjects
    .filter((item) => !subjectId || item.id === subjectId)
    .map((item) => ({
      subject: item,
      items: items.filter((doc) => doc.subjectId === item.id)
    }))
    .filter((group) => group.items.length > 0)
  const hasWork = grouped.length > 0
  const otherDates = [...new Set(scoped.filter((item) => item.date !== selectedDate).map((item) => item.date))].sort().reverse()
  const otherCount = scoped.length - items.length
  const subjectName = subject?.name ?? 'this subject'

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
      <div className={styles.sheet}>
        <nav className={styles.planner} aria-label="School days">
          <Button
            variant="ghost"
            className={styles.step}
            aria-label="Earlier work"
            disabled={!previousDate}
            onClick={() => previousDate && setSelectedDate(previousDate)}
          >
            ‹
          </Button>
          <div className={styles.days}>
            {days.map((date) => {
              const chip = formatDayChip(date)
              const selected = date === selectedDate
              const hasDocs = workDates.includes(date)
              return (
                <button
                  key={date}
                  type="button"
                  className={selected ? styles.dayOn : styles.day}
                  aria-current={selected ? 'date' : undefined}
                  aria-label={`${date === today ? 'Today, ' : ''}${formatDate(date)}${hasDocs ? '' : ', no worksheets'}`}
                  onClick={() => setSelectedDate(date)}
                >
                  <span className={styles.weekday}>{date === today ? 'Today' : chip.weekday}</span>
                  <span className={styles.dayNum}>{chip.day}</span>
                  {hasDocs && <span className={styles.dot} aria-hidden="true" />}
                </button>
              )
            })}
          </div>
          <Button
            variant="ghost"
            className={styles.step}
            aria-label="Later work"
            disabled={!nextDate}
            onClick={() => nextDate && setSelectedDate(nextDate)}
          >
            ›
          </Button>
          <label className={styles.pick}>
            <span className="visually-hidden">Pick a day</span>
            <input
              type="date"
              value={selectedDate}
              aria-label="Pick a day"
              onChange={(event) => {
                if (event.target.value) setSelectedDate(event.target.value)
              }}
            />
          </label>
          <Button variant={isToday ? 'ghost' : 'primary'} disabled={isToday} onClick={() => setSelectedDate(today)}>
            Today
          </Button>
        </nav>

        <header className={styles.header}>
          <p className={styles.kicker}>{isToday ? `Today · ${formatDate(selectedDate)}` : formatDate(selectedDate)}</p>
          <h1>
            {student.name}&rsquo;s {subjectName === 'this subject' ? 'schoolwork' : subjectName}
          </h1>
        </header>

        {isToday ? (
          <button className={hasWork ? styles.drop : styles.dropHero} type="button" onClick={() => void choosePdf()}>
            <span className={styles.dropTitle}>Drop a PDF here</span>
            <span className={styles.dropHint}>or click to add it to {subjectName}</span>
          </button>
        ) : (
          <div className={styles.pastNote}>
            <p>Looking at an earlier day. New worksheets always go on today.</p>
            <Button onClick={() => setSelectedDate(today)}>Back to today</Button>
          </div>
        )}

        {hasWork ? (
          grouped.map((group) => (
            <section key={group.subject.id} className={styles.group}>
              {!subjectId && <h2>{group.subject.name}</h2>}
              <p className={styles.count}>
                {group.items.length === 1 ? '1 worksheet' : `${group.items.length} worksheets`}
              </p>
              <ul>
                {group.items.map((item) => (
                  <li key={item.id} className={styles.item}>
                    <button className={styles.row} onClick={() => void openSummary(item)}>
                      <span className={styles.title}>{item.title}</span>
                      <span className={styles.meta}>
                        <ExportStamp updatedAt={item.updatedAt} lastExportedAt={item.lastExportedAt} />
                        <Status status={item.status} />
                      </span>
                    </button>
                    <Button
                      variant="ghost"
                      aria-label={`Remove ${item.title}`}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Remove "${item.title}" from StudyPDF? The copy in the schoolwork folder is deleted. The original file you dropped is not changed.`
                          )
                        ) {
                          void removeDocument(item.projectDir, item.id)
                        }
                      }}
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          ))
        ) : (
          <p className={styles.empty}>
            {isToday
              ? `Nothing for ${subjectName} yet today.`
              : `No ${subjectName} worksheets on this day.`}
          </p>
        )}
        {otherCount > 0 && (
          <p className={styles.otherDays}>
            {otherCount === 1 ? '1 more worksheet is on another day.' : `${otherCount} more worksheets are on other days.`}
            {otherDates[0] && (
              <>
                {' '}
                <button type="button" className={styles.link} onClick={() => setSelectedDate(otherDates[0])}>
                  Show {otherDates[0] === today ? 'today' : formatShortDate(otherDates[0])}
                </button>
              </>
            )}
          </p>
        )}
      </div>
    </section>
  )
}

function Status({ status }: { status: DocumentSummary['status'] }) {
  const label = status === 'completed' ? 'Completed' : status === 'in_progress' ? 'In progress' : 'Not started'
  return <span className={styles[status]}>{label}</span>
}
