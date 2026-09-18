import { finishedPdfLabel, finishedPdfState, finishedPdfTooltip } from '@shared/exportState'
import styles from './ExportStamp.module.css'

interface Props {
  updatedAt: string
  lastExportedAt?: string | null
  exporting?: boolean
}

export function ExportStamp({ updatedAt, lastExportedAt, exporting = false }: Props) {
  const state = finishedPdfState({ updatedAt, lastExportedAt })
  const label = finishedPdfLabel(state, exporting)
  return (
    <span
      className={`${styles.stamp} ${styles[exporting ? 'exporting' : state]}`}
      title={finishedPdfTooltip({ updatedAt, lastExportedAt })}
      aria-label={finishedPdfTooltip({ updatedAt, lastExportedAt })}
    >
      {label}
    </span>
  )
}
