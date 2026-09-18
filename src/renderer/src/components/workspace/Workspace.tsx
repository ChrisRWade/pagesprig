import { useEffect } from 'react'
import { useAppStore } from '../../stores/appStore'
import { useDocumentStore } from '../../stores/documentStore'
import { PdfViewer } from './PdfViewer'
import { PageControls } from './PageControls'
import { Toolbar } from './Toolbar'
import { Thumbnails } from './Thumbnails'
import { DocumentSwitcher } from './DocumentSwitcher'
import styles from './Workspace.module.css'

export function Workspace() {
  const openOrder = useDocumentStore((state) => state.openOrder)
  const open = useDocumentStore((state) => state.open)
  const activeId = useDocumentStore((state) => state.activeId)
  const thumbnailsOpen = useAppStore((state) => state.thumbnailsOpen)
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

  useEffect(() => {
    if (pageCount <= 1) useAppStore.getState().setThumbnailsOpen(false)
  }, [pageCount])

  if (!active) return null

  return (
    <section className={styles.workspace}>
      <Toolbar />
      <div className={styles.stage}>
        <PdfViewer project={active.project} />
        <PageControls project={active.project} />
        <DocumentSwitcher
          documents={tabs
            .map((id) => open[id]?.project)
            .filter((item): item is NonNullable<typeof item> => Boolean(item))}
          activeId={active.project.id}
        />
        {pageCount > 1 && <Thumbnails project={active.project} open={thumbnailsOpen} />}
      </div>
    </section>
  )
}
