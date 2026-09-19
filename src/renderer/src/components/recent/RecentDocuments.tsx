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
import { APP_NAME } from '@shared/constants'
import { formatDate, formatShortDate, localIsoDate } from '@shared/utils'
import { Button } from '../shared/Button'
import { ExportStamp } from '../shared/ExportStamp'
import { openSummary, removeDocument, refreshDocuments, useCatalogDocuments } from '../../services/documents'
import { useAppStore } from '../../stores/appStore'
import styles from './RecentDocuments.module.css'

const STATUS_OPTIONS: { id: RecentStatusFilter; label: string }[] = [
  { id: 'all', label: 'Any status' },
  { id: 'not_started', label: 'Not started' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'completed', label: 'Completed' }
]

const PDF_OPTIONS: { id: RecentPdfFilter; label: string }[] = [
  { id: 'all', label: 'Any PDF' },
  { id: 'missing', label: 'Not saved' },
  { id: 'stale', label: 'Needs saving' },
  { id: 'current', label: 'PDF saved' }
]

const RANGE_OPTIONS: { id: RecentRange; label: string }[] = [
  { id: 'all', label: 'All days' },
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'Last 7 days' },
  { id: 'month', label: 'Last 30 days' },
  { id: 'custom', label: 'Choose dates' }
]

const SORT_OPTIONS: { id: RecentSort; label: string }[] = [
  { id: 'day', label: 'By school day' },
  { id: 'opened', label: 'Last opened' },
  { id: 'edited', label: 'Last edited' },
  { id: 'title', label: 'Name' }
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

        <div className={styles.toolbar}>
          <label className={styles.search}>
            <span className="visually-hidden">Search worksheets</span>
            <input
              value={filter.query}
              placeholder="Search title, file name, student, or subject"
              aria-label="Search worksheets"
              onChange={(event) => patch({ query: event.target.value })}
            />
          </label>

          <div className={styles.filters}>
            <FilterSelect
              label="Student"
              value={filter.studentId}
              onChange={chooseStudent}
              options={[{ id: '', label: 'All students' }, ...settings.students.map((item) => ({ id: item.id, label: item.name }))]}
            />
            <FilterSelect
              label="Subject"
              value={filter.subjectId}
              onChange={(subjectId) => patch({ subjectId })}
              options={[{ id: '', label: 'All subjects' }, ...subjectOptions]}
            />
            <FilterSelect
              label="Days"
              value={filter.range}
              onChange={(range) => patch({ range: range as RecentRange })}
              options={RANGE_OPTIONS}
            />
            <FilterSelect
              label="Status"
              value={filter.status}
              onChange={(status) => patch({ status: status as RecentStatusFilter })}
              options={STATUS_OPTIONS}
            />
            <FilterSelect
              label="Finished PDF"
              value={filter.pdf}
              onChange={(pdf) => patch({ pdf: pdf as RecentPdfFilter })}
              options={PDF_OPTIONS}
            />
            <FilterSelect
              label="Sort"
              value={filter.sort}
              onChange={(sort) => patch({ sort: sort as RecentSort })}
              options={SORT_OPTIONS}
            />
          </div>

          {filter.range === 'custom' && (
            <div className={styles.dates}>
              <label>
                From
                <input
                  type="date"
                  value={filter.fromDate}
                  onChange={(event) => patch({ fromDate: event.target.value })}
                />
              </label>
              <label>
                To
                <input type="date" value={filter.toDate} onChange={(event) => patch({ toDate: event.target.value })} />
              </label>
            </div>
          )}

          <div className={styles.summary}>
            <p>
              {filtered.length === 1 ? '1 worksheet' : `${filtered.length} worksheets`}
              {active ? ' match' : ''}
            </p>
            {active && (
              <Button
                variant="ghost"
                className={styles.clear}
                onClick={() => setFilter({ ...DEFAULT_RECENT_FILTER, studentId: settings.selectedStudentId ?? '' })}
              >
                Clear filters
              </Button>
            )}
          </div>
        </div>

        <div className={styles.results}>
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
      </div>
    </main>
  )
}

function FilterSelect({
  label,
  value,
  onChange,
  options
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: { id: string; label: string }[]
}) {
  return (
    <label>
      {label}
      <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((item) => (
          <option key={`${label}:${item.id}`} value={item.id}>
            {item.label}
          </option>
        ))}
      </select>
    </label>
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
              `Remove "${item.title}" from ${APP_NAME}? The copy in the schoolwork folder is deleted. The original file you dropped is not changed.`
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
