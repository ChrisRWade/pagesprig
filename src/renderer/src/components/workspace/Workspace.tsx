import { useEffect } from 'react'
import { lessonOverviewCount } from '@shared/packetDays'
import { useAppStore } from '../../stores/appStore'
import { useDocumentStore } from '../../stores/documentStore'
import { PdfViewer } from './PdfViewer'
import { PageControls } from './PageControls'
import { Toolbar } from './Toolbar'
import { Thumbnails } from './Thumbnails'
import { DocumentSwitcher } from './DocumentSwitcher'
import { CalculatorTray } from './CalculatorTray'
import { OverviewPane } from './OverviewPane'
import styles from './Workspace.module.css'

export function Workspace() {
  const openOrder = useDocumentStore((state) => state.openOrder)
  const open = useDocumentStore((state) => state.open)
  const activeId = useDocumentStore((state) => state.activeId)
  const thumbnailsOpen = useAppStore((state) => state.thumbnailsOpen)
  const overviewOpen = useAppStore((state) => state.overviewOpen)
  const settings = useAppStore((state) => state.settings)
  const active = activeId ? open[activeId] : null
  const tabs = openOrder.filter((id) => {
    const doc = open[id]
    return (
      Boolean(doc) &&
      doc.project.studentId === settings.selectedStudentId &&
      doc.project.subjectId === settings.selectedSubjectId
    )
  })
  const pageCount = active?.project.pages.length ?? 0
  const canOverview = Boolean(active && lessonOverviewCount(active.project) > 0)
  const showOverview = overviewOpen && canOverview

  useEffect(() => {
    if (pageCount <= 1) useAppStore.getState().setThumbnailsOpen(false)
  }, [pageCount])

  useEffect(() => {
    if (!canOverview && overviewOpen) useAppStore.getState().setOverviewOpen(false)
  }, [canOverview, overviewOpen])

  if (!active) return null

  return (
    <section className={styles.workspace}>
      <Toolbar />
      <div className={showOverview ? `${styles.stage} ${styles.withOverview}` : styles.stage}>
        {showOverview && <OverviewPane project={active.project} />}
        <div className={styles.viewer}>
          <PdfViewer project={active.project} />
          <DocumentSwitcher
            documents={tabs
              .map((id) => open[id]?.project)
              .filter((item): item is NonNullable<typeof item> => Boolean(item))}
            activeId={active.project.id}
          />
        </div>
        <PageControls project={active.project} />
        {pageCount > 1 && <Thumbnails project={active.project} open={thumbnailsOpen} />}
        <CalculatorTray />
      </div>
    </section>
  )
}
