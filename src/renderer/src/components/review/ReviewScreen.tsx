import { useEffect, useState } from 'react'
import { folderStudent, studentFolder, type FolderStudent } from '@shared/folderStudents'
import { appearsOnDate, dayRangesOf, dayScoreLabel, isPacketShell, packetDayLabel, pageSpanLabel, rangeForDate } from '@shared/packetDays'
import { formatDate, localIsoDate, shiftIsoDate } from '@shared/utils'
import type { DocumentProject, DocumentSummary, PacketDay, Student } from '@shared/types'
import { BrandLockup } from '../chrome/Brand'
import { Button } from '../shared/Button'
import { ExportStamp } from '../shared/ExportStamp'
import { refreshDocuments, saveDayReview, useCatalogDocuments } from '../../services/documents'
import { useAppStore } from '../../stores/appStore'
import { ReviewReader } from './ReviewReader'
import styles from './ReviewScreen.module.css'

interface Column {
  key: string
  person: FolderStudent
  items: DocumentSummary[]
}

export function ReviewScreen() {
  const settings = useAppStore((state) => state.settings)
  const documents = useCatalogDocuments()
  const today = localIsoDate()
  const [selected, setSelected] = useState(today)
  const [studentKey, setStudentKey] = useState<string | null>(null)
  const [docId, setDocId] = useState<string | null>(null)
  const [folders, setFolders] = useState<{ name: string; dir: string }[]>([])
  const [project, setProject] = useState<DocumentProject | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    void refreshDocuments()
    void window.studyApi.listStudentFolders().then((result) => {
      if (result.ok) setFolders(result.data)
    })
  }, [])

  const columns: Column[] =
    folders.length > 0
      ? folders.map((folder, index) => ({
          key: folder.name,
          person: folderStudent(folder.name, settings.students, index),
          items: documents.filter(
            (item) =>
              studentFolder(settings.storageRoot ?? '', item.projectDir)?.toLowerCase() === folder.name.toLowerCase()
          )
        }))
      : settings.students.map((student, index) => ({
          key: student.id,
          person: folderStudent(student.name, settings.students, index),
          items: documents.filter((item) => item.studentId === student.id)
        }))

  const column = columns.find((item) => item.key === studentKey) ?? null
  const work = (column?.items ?? [])
    .filter((item) => !isPacketShell(item) && appearsOnDate(item, selected))
    .sort((a, b) => (a.subjectName ?? '').localeCompare(b.subjectName ?? '') || a.title.localeCompare(b.title))
  const workIds = work.map((item) => item.id).join('|')

  useEffect(() => {
    setDocId((current) => {
      const ids = workIds.split('|').filter(Boolean)
      if (current && ids.includes(current)) return current
      return ids[0] ?? null
    })
  }, [workIds])

  const activeItem = work.find((item) => item.id === docId) ?? null

  const activeId = activeItem?.id ?? null
  const activeDir = activeItem?.projectDir ?? null

  useEffect(() => {
    if (!activeId || !activeDir) {
      setProject(null)
      setLoadError(null)
      return
    }
    let cancelled = false
    setProject(null)
    setLoadError(null)
    void window.studyApi.loadProject(activeDir).then((result) => {
      if (cancelled) return
      if (!result.ok) {
        setProject(null)
        setLoadError(result.error)
        return
      }
      setProject(result.data)
    })
    return () => {
      cancelled = true
    }
  }, [activeId, activeDir])

  const pages = project && activeItem ? pagesForDay(project, selected) : []

  return (
    <main className={styles.wrap}>
      <header className={styles.top}>
        <BrandLockup size="sm" />
        <div className={styles.heading}>
          <p className={styles.kicker}>Parent dashboard</p>
          <h1>Review</h1>
        </div>
        <Button
          variant="ghost"
          onClick={() => useAppStore.getState().setView(settings.selectedStudentId ? 'main' : 'picker')}
        >
          {settings.selectedStudentId ? 'Back to Today' : 'Back'}
        </Button>
      </header>

      {columns.length === 0 ? (
        <p className={styles.none}>No student folders yet. Add a folder for each child inside the schoolwork directory.</p>
      ) : (
        <div className={styles.desk}>
          <aside className={styles.rail} aria-label="Work to check">
            <div className={styles.students} role="group" aria-label="Student">
              {columns.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={item.key === studentKey ? styles.studentOn : styles.studentBtn}
                  aria-pressed={item.key === studentKey}
                  onClick={() => setStudentKey(item.key)}
                >
                  <i style={{ background: item.person.accentColor }} aria-hidden="true" />
                  {item.person.avatar} {item.person.name}
                </button>
              ))}
            </div>

            {column ? (
              <>
                <nav className={styles.monthNav} aria-label="School day">
                  <Button variant="ghost" aria-label="Previous day" onClick={() => setSelected(shiftIsoDate(selected, -1))}>
                    ‹
                  </Button>
                  <h2>{formatDate(selected)}</h2>
                  <Button variant="ghost" aria-label="Next day" onClick={() => setSelected(shiftIsoDate(selected, 1))}>
                    ›
                  </Button>
                </nav>
                <Button variant="ghost" disabled={selected === today} onClick={() => setSelected(today)}>
                  Today
                </Button>
                {work.length === 0 ? (
                  <p className={styles.none}>Nothing saved for this day.</p>
                ) : (
                  <ul className={styles.docs}>
                    {work.map((item) => {
                      const range = rangeForDate(item, selected)
                      const detail = detailLabel(item, selected, column.person.profile)
                      return (
                        <li key={item.id}>
                          <button
                            type="button"
                            className={item.id === docId ? styles.docOn : styles.doc}
                            aria-current={item.id === docId ? 'true' : undefined}
                            onClick={() => setDocId(item.id)}
                          >
                            <span className={styles.title}>{item.title}</span>
                            {detail ? <span className={styles.meta}>{detail}</span> : null}
                            <span className={range?.reviewedAt ? styles.checkedMark : styles.uncheckedMark}>
                              {range?.reviewedAt ? `Checked${dayScoreLabel(range) ? ` · ${dayScoreLabel(range)}` : ''}` : 'Not checked'}
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </>
            ) : (
              <p className={styles.prompt}>Choose a child. Their work for this day stays in this list.</p>
            )}
          </aside>

          <section className={styles.stage} aria-label="Worksheet">
            {!column ? (
              <p className={styles.prompt}>The worksheet opens here, with the marks still on the page.</p>
            ) : !activeItem ? (
              <p className={styles.prompt}>Nothing to open for {column.person.name} on this day.</p>
            ) : (
              <>
                <header className={styles.stageHead}>
                  <div>
                    <h2>{activeItem.title}</h2>
                    <p>{detailLabel(activeItem, selected, column.person.profile) || formatDate(selected)}</p>
                  </div>
                  <ExportStamp updatedAt={activeItem.updatedAt} lastExportedAt={activeItem.lastExportedAt} />
                  <ReviewControls item={activeItem} date={selected} />
                </header>
                {loadError ? <p className={styles.none}>{loadError}</p> : null}
                {project && pages.length > 0 ? <ReviewReader project={project} pages={pages} /> : null}
                {project && pages.length === 0 && !loadError ? <p className={styles.none}>Opening this worksheet…</p> : null}
                {!project && !loadError ? <p className={styles.none}>Opening this worksheet…</p> : null}
              </>
            )}
          </section>
        </div>
      )}
    </main>
  )
}

function pagesForDay(project: DocumentProject, date: string): number[] {
  const range = rangeForDate(project, date)
  const all = project.pages.map((page) => page.page)
  if (!range) return all
  const slice = all.filter((page) => page >= range.startPage && page <= range.endPage)
  return slice.length > 0 ? slice : all
}

function detailLabel(item: DocumentSummary, date: string, student: Student | null): string {
  const range = rangeForDate(item, date)
  const subject =
    item.subjectName?.trim() || student?.subjects.find((entry) => entry.id === item.subjectId)?.name
  const day = packetDayLabel(dayRangesOf(item), date)
  const pages = sliceLabel(item, range)
  return [subject, day, pages].filter(Boolean).join(' · ')
}

function sliceLabel(item: DocumentSummary, range: PacketDay | null): string | null {
  if (!range || item.role === 'day') return null
  const span = range.endPage - range.startPage + 1
  if (span >= item.pageCount) return null
  return pageSpanLabel(range)
}

function ReviewControls({ item, date }: { item: DocumentSummary; date: string }) {
  const range = rangeForDate(item, date)
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
            if (event.key === 'Enter') event.currentTarget.blur()
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
            if (event.key === 'Enter') event.currentTarget.blur()
          }}
        />
      </div>
    </div>
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
