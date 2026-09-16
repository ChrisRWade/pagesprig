import type { DocumentProject } from '@shared/types'
import styles from './Thumbnails.module.css'

interface Props {
  project: DocumentProject
}

export function Thumbnails({ project }: Props) {
  return (
    <aside className={styles.side} aria-label="Page thumbnails">
      {project.pages.map((page) => (
        <button
          key={page.page}
          className={styles.thumb}
          onClick={() => {
            document.querySelector(`[aria-label="Page ${page.page}"]`)?.scrollIntoView({ block: 'start' })
          }}
        >
          <span className={styles.sheet} />
          {page.page}
        </button>
      ))}
    </aside>
  )
}
