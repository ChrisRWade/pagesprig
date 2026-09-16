import { forgetPdf } from '../../services/pdfRenderer'
import { saveNow } from '../../services/autosave'
import { useAppStore } from '../../stores/appStore'
import { useDocumentStore } from '../../stores/documentStore'
import { PdfViewer } from './PdfViewer'
import { PageControls } from './PageControls'
import { Toolbar } from './Toolbar'
import { Thumbnails } from './Thumbnails'
import styles from './Workspace.module.css'

export function Workspace() {
  const openOrder = useDocumentStore((state) => state.openOrder)
  const open = useDocumentStore((state) => state.open)
  const activeId = useDocumentStore((state) => state.activeId)
  const thumbnailsOpen = useAppStore((state) => state.thumbnailsOpen)
  const active = activeId ? open[activeId] : null

  if (!active) return null

  return (
    <section className={styles.workspace}>
      <Toolbar />
      <div className={styles.stage}>
        {openOrder.length > 1 && (
          <div className={styles.tabs} role="tablist" aria-label="Open worksheets">
            {openOrder.map((id) => {
              const doc = open[id]
              if (!doc) return null
              return (
                <button
                  key={id}
                  role="tab"
                  aria-selected={id === activeId}
                  className={id === activeId ? styles.tabOn : styles.tab}
                  onClick={() => useDocumentStore.getState().setActive(id)}
                >
                  {doc.project.title}
                  <span
                    className={styles.close}
                    onClick={(event) => {
                      event.stopPropagation()
                      void (async () => {
                        await saveNow(id, true)
                        forgetPdf(id)
                        useDocumentStore.getState().closeDocument(id)
                      })()
                    }}
                  >
                    ×
                  </span>
                </button>
              )
            })}
          </div>
        )}
        <PdfViewer project={active.project} pdfBytes={active.pdfBytes} />
        <PageControls project={active.project} />
      </div>
      {thumbnailsOpen && <Thumbnails project={active.project} />}
    </section>
  )
}
