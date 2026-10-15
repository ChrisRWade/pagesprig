import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { APP_NAME } from '@shared/constants'
import {
  awaitingLessonStart,
  beginFirstLesson,
  canGrowOverview,
  clearFirstLesson,
  dayRangesOf,
  growOverview,
  isMultiDay,
  isOverviewPage,
  overviewEndPageOf,
  pageSpanLabel,
  pushRemainingDays,
  setHasOverview,
  setOverviewEndPage,
  setRangeDate,
  singleDayRange,
  toggleStartPage
} from '@shared/packetDays'
import { formatShortDate, localIsoDate } from '@shared/utils'
import { quantizeRenderWidth } from '@shared/renderBudget'
import type { DocumentProject, PageSpec } from '@shared/types'
import { Button } from '../shared/Button'
import {
  hasCachedPage,
  loadPdfDocument,
  paintCachedPage,
  pinCachedPage,
  RenderAbortedError,
  renderNotePage,
  unpinCachedPages,
  warmPdfPage
} from '../../services/pdfRenderer'
import { commitPacketDays } from '../../services/documents'
import { useAppStore } from '../../stores/appStore'
import { useDocumentStore } from '../../stores/documentStore'
import styles from './PacketSetup.module.css'

interface Props {
  projectId: string
}

const STRIP_WIDTH = 84

export function PacketSetup({ projectId }: Props) {
  const queued = useAppStore((state) => state.packetQueue.includes(projectId))
  const project = useDocumentStore((state) => state.open[projectId]?.project)
  const [ranges, setRanges] = useState(() => (project && !queued ? dayRangesOf(project) : []))
  const [overviewEnd, setOverviewEnd] = useState(() =>
    project && !queued ? overviewEndPageOf(project) : 0
  )
  const [wantOverview, setWantOverview] = useState(() => {
    if (!project) return true
    if (queued) return true
    return overviewEndPageOf(project) > 0
  })
  const [pushFrom, setPushFrom] = useState(localIsoDate())
  const [viewing, setViewing] = useState(1)
  const [ready, setReady] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [retry, setRetry] = useState(0)
  const previewWidth = useRef(packetPreviewWidth())
  const pageCount = project?.pages.length ?? 0
  const pageRefs = useRef(new Map<number, HTMLButtonElement>())

  useEffect(() => {
    const current = useDocumentStore.getState().open[projectId]?.project
    if (!current) return
    const queuedNow = useAppStore.getState().packetQueue.includes(projectId)
    if (queuedNow) {
      setWantOverview(true)
      setOverviewEnd(0)
      setRanges([])
    } else {
      const overview = overviewEndPageOf(current)
      setWantOverview(overview > 0)
      setOverviewEnd(overview)
      setRanges(dayRangesOf(current))
    }
    setPushFrom(localIsoDate())
    setViewing(1)
    setReady(false)
    setLoadError(null)
  }, [projectId, pageCount])

  useEffect(() => {
    if (!projectId) return
    const current = useDocumentStore.getState().open[projectId]?.project
    if (!current) return
    const ac = new AbortController()
    previewWidth.current = packetPreviewWidth()
    setReady(false)
    setLoadError(null)
    void preloadPacket(current, previewWidth.current, ac.signal, setProgress)
      .then(() => {
        if (!ac.signal.aborted) setReady(true)
      })
      .catch((error: Error) => {
        if (ac.signal.aborted || error instanceof RenderAbortedError) return
        setLoadError(error.message || 'Those pages could not be prepared.')
      })
    return () => {
      ac.abort()
      unpinCachedPages()
    }
  }, [pageCount, projectId, retry])

  useEffect(() => {
    if (!ready) return
    pageRefs.current.get(viewing)?.scrollIntoView({ block: 'nearest' })
  }, [ready, viewing])

  useEffect(() => {
    if (!ready) return
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
      if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
        event.preventDefault()
        setViewing((current) => Math.min(pageCount, current + 1))
      }
      if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
        event.preventDefault()
        setViewing((current) => Math.max(1, current - 1))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pageCount, ready])

  if (!project) {
    return (
      <div className={styles.modal} role="dialog" aria-labelledby="packet-title" aria-busy="true">
        <div className={styles.dialog}>
          <header className={styles.header}>
            <p className={styles.kicker}>Multi-day packet</p>
            <h2 id="packet-title">Preparing pages…</h2>
            <p>Opening the packet so you can split it without waiting.</p>
          </header>
          <div className={styles.loading} role="status" aria-live="polite">
            <span className={styles.spinner} aria-hidden="true" />
            <p className={styles.loadingTitle}>Preparing pages…</p>
            <p className={styles.loadingCopy}>Opening the packet</p>
          </div>
          <div className={styles.actions}>
            <Button variant="ghost" onClick={() => useAppStore.getState().dismissPacketSetup()}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const editing = !queued
  const days = ranges.length
  const awaiting = awaitingLessonStart(wantOverview, overviewEnd)
  const page = project.pages.find((item) => item.page === viewing) ?? project.pages[0]
  const inOverview = isOverviewPage(page.page, overviewEnd)
  const range = ranges.find((item) => page.page >= item.startPage && page.page <= item.endPage)
  const starts = Boolean(!inOverview && range && range.startPage === page.page)
  const firstLesson = wantOverview && !awaiting && page.page === overviewEnd + 1
  const dayIndex = range ? ranges.indexOf(range) : 0
  const canSave = !wantOverview || overviewEnd > 0
  const canAddToOverview = firstLesson && canGrowOverview(overviewEnd, pageCount)

  const applyOverview = (next: { ranges: typeof ranges; overviewEndPage: number }) => {
    setRanges(next.ranges)
    setOverviewEnd(next.overviewEndPage)
  }

  const save = async (next = ranges, nextOverview = overviewEnd) => {
    const saved = await commitPacketDays(project, next, nextOverview)
    if (saved) useAppStore.getState().dismissPacketSetup()
  }

  const pickDay1Again = () => {
    setViewing(1)
    applyOverview(clearFirstLesson())
  }

  const addCurrentToOverview = () => {
    if (!canAddToOverview) return
    applyOverview(growOverview(ranges, pageCount, project.date, overviewEnd))
    setViewing(Math.min(pageCount, overviewEnd + 2))
  }

  const togglePage = (pageNumber: number) => {
    if (!ready) return
    setViewing(pageNumber)
    if (!wantOverview) {
      if (pageNumber <= 1) return
      setRanges(toggleStartPage(ranges, pageNumber, pageCount, 0))
      return
    }
    if (awaiting) {
      const first = beginFirstLesson(pageNumber, pageCount, project.date)
      if (first) applyOverview(first)
      return
    }
    if (pageNumber <= 1) return
    if (pageNumber <= overviewEnd) {
      applyOverview(setOverviewEndPage(ranges, pageNumber - 1, pageCount, project.date))
      return
    }
    if (pageNumber === overviewEnd + 1) return
    setRanges(toggleStartPage(ranges, pageNumber, pageCount, overviewEnd))
  }

  const setOverviewEnabled = (enabled: boolean) => {
    setWantOverview(enabled)
    if (enabled) {
      setOverviewEnd(0)
      setRanges([])
      return
    }
    applyOverview(setHasOverview(ranges, false, pageCount, project.date))
  }

  const dismiss = () => useAppStore.getState().dismissPacketSetup()

  return (
    <div className={styles.modal} role="dialog" aria-labelledby="packet-title" aria-busy={!ready}>
      <div className={styles.dialog}>
        <header className={styles.header}>
          <p className={styles.kicker}>{editing ? 'Edit school days' : 'Multi-day packet'}</p>
          <h2 id="packet-title">{project.title}</h2>
          {ready ? (
            <>
              <p>
                {wantOverview
                  ? awaiting
                    ? 'Click the page where the first daily lesson begins. Pages before it will become the lesson overview.'
                    : 'Click a later page when a new school day should start. If Day 1 is wrong, open that page to move it or pick again.'
                  : 'Click a thumbnail when a new school day should start.'}{' '}
                {APP_NAME} keeps the PDF as one file.
                {awaiting
                  ? ''
                  : days === 1
                    ? ' This is one school day right now.'
                    : ` Split into ${days} school days.`}
              </p>
              <label className={styles.check}>
                <input
                  type="checkbox"
                  checked={wantOverview}
                  onChange={(event) => setOverviewEnabled(event.target.checked)}
                />
                This packet has a lesson overview
              </label>
            </>
          ) : (
            <p>Preparing every page so you can split this packet without waiting.</p>
          )}
        </header>

        {ready ? (
          <>
            <div className={styles.stage}>
              <div className={styles.pages} role="list" aria-label="Packet pages">
                {project.pages.map((item) => {
                  const itemOverview = isOverviewPage(item.page, overviewEnd)
                  const itemRange = ranges.find((entry) => item.page >= entry.startPage && item.page <= entry.endPage)
                  const itemStarts = Boolean(!itemOverview && itemRange?.startPage === item.page)
                  const itemDay = itemRange ? ranges.indexOf(itemRange) : 0
                  const on = item.page === viewing
                  return (
                    <div
                      key={item.page}
                      className={itemOverview || itemStarts ? styles.cut : styles.page}
                      role="listitem"
                    >
                      {itemOverview && (
                        <span className={`${styles.flag} ${styles.flagOverview}`}>
                          Overview
                          {item.page === 1 ? <em>Lesson</em> : <em>p. {item.page}</em>}
                        </span>
                      )}
                      {itemStarts && (
                        <span className={styles.flag}>
                          Day {itemDay + 1}
                          <em>{itemRange ? formatShortDate(itemRange.date) : ''}</em>
                        </span>
                      )}
                      <button
                        ref={(node) => {
                          if (node) pageRefs.current.set(item.page, node)
                          else pageRefs.current.delete(item.page)
                        }}
                        type="button"
                        className={on ? `${styles.thumb} ${styles.thumbOn}` : styles.thumb}
                        aria-current={on ? 'page' : undefined}
                        aria-pressed={itemStarts && item.page !== overviewEnd + 1}
                        aria-label={thumbLabel(
                          item.page,
                          itemStarts,
                          itemOverview,
                          awaiting,
                          wantOverview,
                          item.page === overviewEnd + 1
                        )}
                        onMouseEnter={() => setViewing(item.page)}
                        onFocus={() => setViewing(item.page)}
                        onClick={() => (item.page === 1 && !wantOverview ? setViewing(1) : togglePage(item.page))}
                      >
                        <PacketCanvas
                          page={item}
                          width={STRIP_WIDTH}
                          cacheId={`${project.id}:page:${item.originalPage ?? item.page}`}
                        />
                        <span className={styles.num}>{item.page}</span>
                      </button>
                    </div>
                  )
                })}
              </div>

              <PreviewPane
                project={project}
                page={page}
                width={previewWidth.current}
                starts={starts}
                overview={inOverview}
                awaiting={awaiting}
                firstLesson={firstLesson}
                hasOverview={wantOverview}
                canAddToOverview={canAddToOverview}
                dayIndex={dayIndex}
                date={range?.date}
                onToggle={() => togglePage(page.page)}
                onAddToOverview={addCurrentToOverview}
                onPickDay1Again={pickDay1Again}
              />
            </div>

            <ol className={styles.days}>
              {wantOverview && !awaiting && (
                <li>
                  <button type="button" className={styles.dayJump} onClick={() => setViewing(1)}>
                    <span className={styles.dayLabel}>
                      Lesson overview
                      <small>{pageSpanLabel({ date: project.date, startPage: 1, endPage: overviewEnd })}</small>
                    </span>
                  </button>
                </li>
              )}
              {ranges.map((item, index) => (
                <li key={`${item.startPage}-${item.date}`}>
                  <button type="button" className={styles.dayJump} onClick={() => setViewing(item.startPage)}>
                    <span className={styles.dayLabel}>
                      Day {index + 1}
                      <small>{pageSpanLabel(item)}</small>
                    </span>
                  </button>
                  <input
                    type="date"
                    value={item.date}
                    aria-label={`Date for day ${index + 1}`}
                    onChange={(event) => {
                      if (event.target.value) setRanges(setRangeDate(ranges, index, event.target.value))
                    }}
                  />
                </li>
              ))}
            </ol>

            {editing && isMultiDay(ranges) && (
              <div className={styles.push}>
                <p>Holiday or sick day? Push this day and the ones after it forward.</p>
                <label>
                  Starting
                  <input
                    type="date"
                    value={pushFrom}
                    onChange={(event) => event.target.value && setPushFrom(event.target.value)}
                  />
                </label>
                <Button variant="ghost" onClick={() => setRanges(pushRemainingDays(ranges, pushFrom))}>
                  Push remaining days
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className={styles.loading} role="status" aria-live="polite">
            {!loadError && <span className={styles.spinner} aria-hidden="true" />}
            <p className={styles.loadingTitle}>{loadError ? 'Could not prepare those pages' : 'Preparing pages…'}</p>
            <p className={styles.loadingCopy}>
              {loadError ??
                (progress.total > 0
                  ? `Page ${Math.min(progress.total, progress.done + 1)} of ${progress.total}`
                  : 'Opening the packet')}
            </p>
            {progress.total > 0 && !loadError && (
              <div className={styles.progress} aria-hidden="true">
                <span style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }} />
              </div>
            )}
          </div>
        )}

        <div className={styles.actions}>
          {ready && (
            <>
              <Button
                disabled={!canSave}
                title={canSave ? undefined : 'Choose the page where Day 1 begins first'}
                onClick={() => void save()}
              >
                {editing ? 'Save days' : days > 1 ? 'Save school days' : awaiting ? 'Save school days' : 'Keep as one day'}
              </Button>
              {queued && (days > 1 || awaiting) && (
                <Button variant="ghost" onClick={() => void save(singleDayRange(project.date, pageCount, 0), 0)}>
                  Keep as one day
                </Button>
              )}
            </>
          )}
          {loadError ? (
            <Button onClick={() => setRetry((count) => count + 1)}>Try again</Button>
          ) : null}
          <Button variant="ghost" onClick={dismiss}>
            {editing ? 'Cancel' : ready ? 'Skip' : 'Cancel'}
          </Button>
        </div>
      </div>
    </div>
  )
}

function PreviewPane({
  project,
  page,
  width,
  starts,
  overview,
  awaiting,
  firstLesson,
  hasOverview,
  canAddToOverview,
  dayIndex,
  date,
  onToggle,
  onAddToOverview,
  onPickDay1Again
}: {
  project: DocumentProject
  page: PageSpec
  width: number
  starts: boolean
  overview: boolean
  awaiting: boolean
  firstLesson: boolean
  hasOverview: boolean
  canAddToOverview: boolean
  dayIndex: number
  date?: string
  onToggle: () => void
  onAddToOverview: () => void
  onPickDay1Again: () => void
}) {
  return (
    <section className={styles.preview} aria-label={`Page ${page.page}`}>
      <div className={styles.previewHead}>
        <strong>Page {page.page}</strong>
        <span>
          {awaiting
            ? page.page === 1
              ? 'Choose where Day 1 begins'
              : 'Click to start Day 1 here'
            : overview
              ? page.page === 1
                ? 'Lesson overview'
                : 'Part of the lesson overview'
              : starts
                ? `Day ${dayIndex + 1}${date ? ` · ${formatShortDate(date)}` : ''}`
                : 'Continues the previous day'}
        </span>
      </div>
      <div className={styles.previewStage}>
        <PacketCanvas
          page={page}
          width={width}
          cacheId={`${project.id}:page:${page.originalPage ?? page.page}`}
          className={styles.previewSheet}
        />
      </div>
      <div className={styles.previewActions}>
        {page.page === 1 && hasOverview ? (
          <p>
            {awaiting
              ? 'Click the first daily lesson. Pages before it become the overview.'
              : 'This page starts the lesson overview.'}
          </p>
        ) : page.page === 1 && !hasOverview ? (
          <p>This page always starts Day 1.</p>
        ) : firstLesson ? (
          <>
            {canAddToOverview && (
              <Button variant="ghost" onClick={onAddToOverview}>
                Add to the lesson overview
              </Button>
            )}
            <Button variant="ghost" onClick={onPickDay1Again}>
              Pick Day 1 again
            </Button>
          </>
        ) : awaiting || overview ? (
          <Button onClick={onToggle}>Day 1 starts here</Button>
        ) : (
          <Button variant={starts ? 'ghost' : 'primary'} onClick={onToggle}>
            {starts ? 'Join the previous day' : 'Start a new school day here'}
          </Button>
        )}
      </div>
    </section>
  )
}

function PacketCanvas({
  page,
  width,
  cacheId,
  className
}: {
  page: PageSpec
  width: number
  cacheId: string
  className?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const height = width * (page.height / page.width)

  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    if (page.source !== 'original') {
      renderNotePage(canvas, page.source, width, height)
      return
    }
    paintCachedPage(canvas, cacheId, width, height)
  }, [cacheId, height, page.source, width])

  return (
    <canvas
      ref={canvasRef}
      className={className ?? styles.sheet}
      width={width}
      height={height}
      aria-hidden="true"
    />
  )
}

async function preloadPacket(
  project: DocumentProject,
  previewWidth: number,
  signal: AbortSignal,
  onProgress: (progress: { done: number; total: number }) => void
): Promise<void> {
  const originals = project.pages.filter((item) => item.source === 'original' && item.originalPage)
  onProgress({ done: 0, total: originals.length })
  if (originals.length === 0) return
  const pdf = await loadPdfDocument(project.id, project.sourcePdfPath)
  if (signal.aborted) throw new RenderAbortedError()
  let done = 0
  for (const item of originals) {
    if (signal.aborted) throw new RenderAbortedError()
    const cacheId = `${project.id}:page:${item.originalPage}`
    if (!hasCachedPage(cacheId, previewWidth)) {
      await warmPdfPage(pdf, item.originalPage as number, previewWidth, {
        cacheId,
        priority: 0,
        signal
      })
    }
    pinCachedPage(cacheId, previewWidth)
    done += 1
    onProgress({ done, total: originals.length })
  }
}

function packetPreviewWidth(): number {
  const dialogW = Math.min(1120, window.innerWidth - 32)
  const dialogH = Math.min(860, window.innerHeight - 32)
  const stageW = Math.max(280, dialogW - 212)
  const stageH = Math.max(280, dialogH - 280)
  const ratio = 792 / 612
  let width = stageW
  if (width * ratio > stageH) width = stageH / ratio
  return quantizeRenderWidth(width)
}

function thumbLabel(
  page: number,
  starts: boolean,
  overview: boolean,
  awaiting: boolean,
  hasOverview: boolean,
  firstLesson: boolean
): string {
  if (page === 1 && hasOverview) {
    return awaiting
      ? 'Click a later page to start Day 1. Pages before it will become the lesson overview.'
      : 'Page 1 starts the lesson overview'
  }
  if (page === 1) return 'Page 1 always starts the first day'
  if (firstLesson) return `Page ${page} starts Day 1. Open it to add it to the overview or pick Day 1 again.`
  if (awaiting) return `Page ${page}. Click to start Day 1 here.`
  if (overview) return `Page ${page} is in the lesson overview. Click to start Day 1 here instead.`
  if (starts) return `Page ${page} starts a new day. Click to join it to the previous day.`
  return `Page ${page}. Click to start a new day here.`
}
