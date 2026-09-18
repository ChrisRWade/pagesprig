import { useEffect, useMemo, useState } from 'react'
import {
  DEFAULT_RECENT_FILTER,
  filterAndSortRecent,
  groupRecentByDay,
  recentFilterActive,
  type RecentFilter,
  type RecentPdfFilter,
  type RecentRange,
  type RecentSort,
  type RecentStatusFilter
} from '@shared/recentFilter'
import type { DocumentSummary } from '@shared/types'
import { formatDate, formatShortDate, localIsoDate } from '@shared/utils'
import { Button } from '../shared/Button'
import { ExportStamp } from '../shared/ExportStamp'
import { openSummary, removeDocument, refreshDocuments, useCatalogDocuments } from '../../services/documents'
import { useAppStore } from '../../stores/appStore'
import styles from './RecentDocuments.module.css'

const STATUS_CHIPS: { id: RecentStatusFilter; label: string }[] = [
  { id: 'all', label: 'Any status' },
  { id: 'not_started', label: 'Not started' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'completed', label: 'Completed' }
]

const PDF_CHIPS: { id: RecentPdfFilter; label: string }[] = [
  { id: 'all', label: 'Any PDF' },
  { id: 'missing', label: 'Not saved' },
  { id: 'stale', label: 'Needs saving' },
  { id: 'current', label: 'PDF saved' }
]

const RANGE_CHIPS: { id: RecentRange; label: string }[] = [
  { id: 'all', label: 'All days' },
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'Last 7 days' },
  { id: 'month', label: 'Last 30 days' },
  { id: 'custom', label: 'Choose dates' }
]

export function RecentDocuments() {
  const documents = useCatalogDocuments()
  const settings = useAppStore((state) => state.settings)
  const closeOverlay = useAppStore((state) => state.closeOverlay)
  const [filter, setFilter] = useState<RecentFilter>({
    ...DEFAULT_RECENT_FILTER,
    studentId: settings.selectedStudentId ?? ''
  })
  const today = localIsoDate()

  useEffect(() => {
    void refreshDocuments()
  }, [])

  const filtered = useMemo(() => {
    const namesFor = (item: DocumentSummary) => {
      const owner = settings.students.find((entry) => entry.id === item.studentId)
      const course = owner?.subjects.find((entry) => entry.id === item.subjectId)
      return { student: owner?.name ?? '', subject: course?.name ?? '' }
    }
    return filterAndSortRecent(documents, filter, today, namesFor)
  }, [documents, filter, settings.students, today])
  const grouped = useMemo(() => groupRecentByDay(filtered), [filtered])
  const namesFor = (item: DocumentSummary) => {
    const owner = settings.students.find((entry) => entry.id === item.studentId)
    const course = owner?.subjects.find((entry) => entry.id === item.subjectId)
    return { student: owner?.name ?? '', subject: course?.name ?? '' }
  }
  const groupByDay = filter.sort === 'day'
  const student = settings.students.find((item) => item.id === filter.studentId)
  const subjectOptions = student
    ? student.subjects.map((item) => ({ id: item.id, label: item.name }))
    : settings.students.flatMap((entry) =>
        entry.subjects.map((item) => ({ id: item.id, label: `${entry.name} · ${item.name}` }))
      )
  const active = recentFilterActive(filter)
  const showStudent = !filter.studentId || settings.students.length > 1

  const patch = (next: Partial<RecentFilter>) => setFilter((current) => ({ ...current, ...next }))

  const chooseStudent = (studentId: string) => {
    const nextStudent = settings.students.find((item) => item.id === studentId)
    const subjectOk = nextStudent?.subjects.some((item) => item.id === filter.subjectId)
    patch({ studentId, subjectId: subjectOk ? filter.subjectId : '' })
  }

  return (
    <main className={styles.wrap}>
      <div className={styles.sheet}>
        <header className={styles.header}>
          <div>
            <p className={styles.kicker}>Find a worksheet</p>
            <h1>Recent work</h1>
          </div>
          <Button variant="ghost" onClick={closeOverlay}>
            Back
          </Button>
        </header>

        <label className={styles.search}>
          <span className="visually-hidden">Search worksheets</span>
          <input
            value={filter.query}
            placeholder="Search title, file name, student, or subject"
            aria-label="Search worksheets"
            onChange={(event) => patch({ query: event.target.value })}
          />
        </label>

        <div className={styles.controls}>
          <label>
            Student
            <select
              aria-label="Student"
              value={filter.studentId}
              onChange={(event) => chooseStudent(event.target.value)}
            >
              <option value="">All students</option>
              {settings.students.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Subject
            <select
              aria-label="Subject"
              value={filter.subjectId}
              onChange={(event) => patch({ subjectId: event.target.value })}
            >
              <option value="">All subjects</option>
              {subjectOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Sort
            <select
              aria-label="Sort worksheets"
              value={filter.sort}
              onChange={(event) => patch({ sort: event.target.value as RecentSort })}
            >
              <option value="day">By school day</option>
              <option value="opened">Last opened</option>
              <option value="edited">Last edited</option>
              <option value="title">Name</option>
            </select>
          </label>
        </div>

        <fieldset className={styles.chips}>
          <legend>Days</legend>
          {RANGE_CHIPS.map((item) => (
            <Chip
              key={item.id}
              label={item.label}
              pressed={filter.range === item.id}
              onClick={() => patch({ range: item.id })}
            />
          ))}
        </fieldset>
        {filter.range === 'custom' && (
          <div className={styles.dates}>
            <label>
              From
              <input type="date" value={filter.fromDate} onChange={(event) => patch({ fromDate: event.target.value })} />
            </label>
            <label>
              To
              <input type="date" value={filter.toDate} onChange={(event) => patch({ toDate: event.target.value })} />
            </label>
          </div>
        )}

        <fieldset className={styles.chips}>
          <legend>Status</legend>
          {STATUS_CHIPS.map((item) => (
            <Chip
              key={item.id}
              label={item.label}
              pressed={filter.status === item.id}
              onClick={() => patch({ status: item.id })}
            />
          ))}
        </fieldset>

        <fieldset className={styles.chips}>
          <legend>Finished PDF</legend>
          {PDF_CHIPS.map((item) => (
            <Chip
              key={item.id}
              label={item.label}
              pressed={filter.pdf === item.id}
              onClick={() => patch({ pdf: item.id })}
            />
          ))}
        </fieldset>

        <div className={styles.summary}>
          <p>
            {filtered.length === 1 ? '1 worksheet' : `${filtered.length} worksheets`}
            {active ? ' match' : ''}
          </p>
          {active && (
            <Button
              variant="ghost"
              onClick={() => setFilter({ ...DEFAULT_RECENT_FILTER, studentId: settings.selectedStudentId ?? '' })}
            >
              Clear filters
            </Button>
          )}
        </div>

        {filtered.length === 0 ? (
          <p className={styles.empty}>
            {documents.length === 0
              ? 'No worksheets saved yet.'
              : 'Nothing matches. Try a different day, subject, or clear the filters.'}
          </p>
        ) : groupByDay ? (
          grouped.map((group) => (
            <section key={group.date} className={styles.group}>
              <h2>{group.date === today ? `Today · ${formatDate(group.date)}` : formatDate(group.date)}</h2>
              <ul>
                {group.items.map((item) => (
                  <WorkRow
                    key={item.id}
                    item={item}
                    names={namesFor(item)}
                    showStudent={showStudent}
                    onOpen={() => {
                      void openSummary(item)
                      closeOverlay()
                    }}
                  />
                ))}
              </ul>
            </section>
          ))
        ) : (
          <ul className={styles.list}>
            {filtered.map((item) => (
              <WorkRow
                key={item.id}
                item={item}
                names={namesFor(item)}
                showStudent={showStudent}
                showDate
                onOpen={() => {
                  void openSummary(item)
                  closeOverlay()
                }}
              />
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}

function Chip({ label, pressed, onClick }: { label: string; pressed: boolean; onClick: () => void }) {
  return (
    <button type="button" className={pressed ? styles.chipOn : styles.chip} aria-pressed={pressed} onClick={onClick}>
      {label}
    </button>
  )
}

function WorkRow({
  item,
  names,
  showStudent,
  showDate = false,
  onOpen
}: {
  item: DocumentSummary
  names: { student: string; subject: string }
  showStudent: boolean
  showDate?: boolean
  onOpen: () => void
}) {
  const bits = [showStudent ? names.student : '', names.subject, showDate ? formatShortDate(item.date) : ''].filter(
    Boolean
  )
  return (
    <li className={styles.item}>
      <button className={styles.row} onClick={onOpen}>
        <span className={styles.copy}>
          <span className={styles.title}>{item.title}</span>
          <span className={styles.detail}>{bits.join(' · ')}</span>
        </span>
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
  )
}

function Status({ status }: { status: DocumentSummary['status'] }) {
  const label = status === 'completed' ? 'Completed' : status === 'in_progress' ? 'In progress' : 'Not started'
  return <span className={styles[status]}>{label}</span>
}
