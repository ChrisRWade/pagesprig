import { useEffect, useMemo, useState } from 'react'
import { calendarCells, formatMonthTitle, monthKey, shiftMonth, WEEKDAY_LABELS } from '@shared/calendar'
import {
  appearsOnDate,
  dateReviewStatus,
  dayScoreLabel,
  packetDayLabel,
  pageSpanLabel,
  rangeForDate
} from '@shared/packetDays'
import { formatDate, localIsoDate } from '@shared/utils'
import type { DocumentSummary, Student } from '@shared/types'
import { BrandLockup } from '../chrome/Brand'
import { Button } from '../shared/Button'
import { ExportStamp } from '../shared/ExportStamp'
import { openSummary, refreshDocuments, saveDayReview, useCatalogDocuments } from '../../services/documents'
import { useAppStore } from '../../stores/appStore'
import styles from './ReviewScreen.module.css'

export function ReviewScreen() {
  const settings = useAppStore((state) => state.settings)
  const documents = useCatalogDocuments()
  const today = localIsoDate()
  const [month, setMonth] = useState(monthKey(today))
  const [selected, setSelected] = useState(today)

  useEffect(() => {
    void refreshDocuments()
  }, [])

  const cells = useMemo(() => calendarCells(month), [month])
  const byDate = useMemo(() => {
    const map = new Map<string, DocumentSummary[]>()
    for (const item of documents) {
      for (const cell of cells) {
        if (!cell.date || !appearsOnDate(item, cell.date)) continue
        const list = map.get(cell.date) ?? []
        list.push(item)
        map.set(cell.date, list)
      }
    }
    return map
  }, [cells, documents])
  const selectedItems = byDate.get(selected) ?? []
  const grouped = settings.students
    .map((student) => ({
      student,
      items: selectedItems.filter((item) => item.studentId === student.id)
    }))
    .filter((group) => group.items.length > 0)

  const openItem = async (item: DocumentSummary) => {
    const range = rangeForDate(item, selected)
    await openSummary(item, { page: range?.startPage })
  }

  return (
    <main className={styles.wrap}>
      <header className={styles.top}>
        <BrandLockup size="sm" />
        <div className={styles.heading}>
          <p className={styles.kicker}>Parent review</p>
          <h1>Who has work this month?</h1>
        </div>
        <Button
          variant="ghost"
          onClick={() => useAppStore.getState().setView(settings.selectedStudentId ? 'main' : 'picker')}
        >
          {settings.selectedStudentId ? 'Back to Today' : 'Back'}
        </Button>
      </header>

      <div className={styles.sheet}>
        <nav className={styles.monthNav} aria-label="Month">
          <Button variant="ghost" aria-label="Previous month" onClick={() => setMonth(shiftMonth(month, -1))}>
            ‹
          </Button>
          <h2>{formatMonthTitle(month)}</h2>
          <Button variant="ghost" aria-label="Next month" onClick={() => setMonth(shiftMonth(month, 1))}>
            ›
          </Button>
          <Button
            variant="ghost"
            disabled={month === monthKey(today)}
            onClick={() => {
              setMonth(monthKey(today))
              setSelected(today)
            }}
          >
            This month
          </Button>
        </nav>

        <div className={styles.legend}>
          {settings.students.map((student) => (
            <span key={student.id} className={styles.legendItem}>
              <i style={{ background: student.accentColor }} aria-hidden="true" />
              {student.avatar} {student.name}
            </span>
          ))}
          <span className={styles.legendItem}>
            <span className={styles.legendCheck} aria-hidden="true">
              ✓
            </span>
            Checked
          </span>
        </div>

        <div className={styles.grid} role="grid" aria-label={formatMonthTitle(month)}>
          {WEEKDAY_LABELS.map((label) => (
            <div key={label} className={styles.weekday} role="columnheader">
              {label}
            </div>
          ))}
          {cells.map((cell, index) => {
            const date = cell.date
            if (!date) return <div key={`empty-${index}`} className={styles.empty} />
            const items = byDate.get(date) ?? []
            const owners = uniqueStudents(items, settings.students)
            const on = date === selected
            const isToday = date === today
            const review = dateReviewStatus(items, date)
            return (
              <button
                key={date}
                type="button"
                className={on ? styles.dayOn : styles.day}
                aria-current={isToday ? 'date' : undefined}
                aria-pressed={on}
                aria-label={dayLabel(date, owners, items.length, isToday, review)}
                onClick={() => setSelected(date)}
              >
                <span className={styles.dayHead}>
                  <span className={isToday ? styles.todayNum : styles.num}>{Number(date.slice(-2))}</span>
                  {review !== 'none' ? (
                    <span className={review === 'all' ? styles.checkedAll : styles.checkedSome} aria-hidden="true">
                      ✓
                    </span>
                  ) : null}
                </span>
                <span className={styles.dots}>
                  {owners.map((student) => (
                    <i key={student.id} style={{ background: student.accentColor }} title={student.name} />
                  ))}
                </span>
              </button>
            )
          })}
        </div>

        <section className={styles.detail} aria-live="polite">
          <h2>{formatDate(selected)}</h2>
          {grouped.length === 0 ? (
            <p className={styles.none}>No worksheets on this day.</p>
          ) : (
            grouped.map((group) => (
              <section key={group.student.id} className={styles.student}>
                <h3>
                  <i style={{ background: group.student.accentColor }} aria-hidden="true" />
                  {group.student.avatar} {group.student.name}
                </h3>
                <ul>
                  {group.items.map((item) => (
                    <DayReviewCard
                      key={item.id}
                      item={item}
                      date={selected}
                      subjectName={group.student.subjects.find((entry) => entry.id === item.subjectId)?.name}
                      onOpen={() => void openItem(item)}
                    />
                  ))}
                </ul>
              </section>
            ))
          )}
        </section>
      </div>
    </main>
  )
}

function DayReviewCard({
  item,
  date,
  subjectName,
  onOpen
}: {
  item: DocumentSummary
  date: string
  subjectName?: string
  onOpen: () => void
}) {
  const range = rangeForDate(item, date)
  const day = packetDayLabel(item.dayRanges, date)
  const score = range ? dayScoreLabel(range) : null
  const [questions, setQuestions] = useState(countDraft(range?.questionCount))
  const [correct, setCorrect] = useState(countDraft(range?.correctCount))

  useEffect(() => {
    setQuestions(countDraft(range?.questionCount))
    setCorrect(countDraft(range?.correctCount))
  }, [range?.questionCount, range?.correctCount, item.updatedAt])

  const commitScore = async () => {
    const questionCount = parseCountInput(questions)
    const correctCount = parseCountInput(correct)
    if (questions.trim() && questionCount == null) {
      setQuestions(countDraft(range?.questionCount))
      return
    }
    if (correct.trim() && correctCount == null) {
      setCorrect(countDraft(range?.correctCount))
      return
    }
    if (questionCount == null && correct.trim()) return
    const patch: { questionCount: number | null; correctCount: number | null; reviewed?: boolean } = {
      questionCount,
      correctCount: questionCount == null ? null : correctCount
    }
    if (questionCount != null && correctCount != null && !range?.reviewedAt) patch.reviewed = true
    await saveDayReview(item, date, patch)
  }

  return (
    <li>
      <div className={styles.card}>
        <button type="button" className={styles.row} onClick={onOpen}>
          <span className={styles.title}>{item.title}</span>
          <span className={styles.meta}>
            {subjectName}
            {day ? ` · ${day}` : ''}
            {range ? ` · ${pageSpanLabel(range)}` : ''}
            {score ? ` · ${score}` : ''}
            <ExportStamp updatedAt={item.updatedAt} lastExportedAt={item.lastExportedAt} />
          </span>
        </button>
        <div className={styles.reviewRow}>
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={Boolean(range?.reviewedAt)}
              onChange={(event) => void saveDayReview(item, date, { reviewed: event.target.checked })}
            />
            Checked
          </label>
          <div className={styles.score}>
            <span>Score</span>
            <input
              className={styles.count}
              inputMode="numeric"
              pattern="[0-9]*"
              aria-label="Correct answers"
              value={correct}
              onChange={(event) => setCorrect(event.target.value)}
              onBlur={() => void commitScore()}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.currentTarget.blur()
                }
              }}
            />
            <span>/</span>
            <input
              className={styles.count}
              inputMode="numeric"
              pattern="[0-9]*"
              aria-label="Total questions"
              value={questions}
              onChange={(event) => setQuestions(event.target.value)}
              onBlur={() => void commitScore()}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.currentTarget.blur()
                }
              }}
            />
          </div>
        </div>
      </div>
    </li>
  )
}

function countDraft(value: number | undefined): string {
  return value == null ? '' : String(value)
}

function parseCountInput(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const count = Number(trimmed)
  if (!Number.isFinite(count)) return null
  return count
}

function uniqueStudents(items: DocumentSummary[], students: Student[]): Student[] {
  const seen = new Set<string>()
  const result: Student[] = []
  for (const item of items) {
    if (seen.has(item.studentId)) continue
    const student = students.find((entry) => entry.id === item.studentId)
    if (!student) continue
    seen.add(item.studentId)
    result.push(student)
  }
  return result
}

function dayLabel(
  date: string,
  owners: Student[],
  count: number,
  isToday: boolean,
  review: 'none' | 'some' | 'all'
): string {
  const who = owners.length ? owners.map((item) => item.name).join(', ') : 'no worksheets'
  const work = count === 0 ? who : `${count} worksheet${count === 1 ? '' : 's'} for ${who}`
  const checked =
    review === 'all' ? ' All work checked.' : review === 'some' ? ' Some work checked.' : ''
  return `${isToday ? 'Today, ' : ''}${formatDate(date)}. ${work}.${checked}`
}
