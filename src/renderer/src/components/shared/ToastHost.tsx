import { useEffect, useState } from 'react'
import { TOAST_ERROR_MS, TOAST_EXIT_MS, TOAST_SUCCESS_MS } from '@shared/constants'
import { useAppStore, type Toast } from '../../stores/appStore'
import styles from './ToastHost.module.css'

export function ToastHost() {
  const toasts = useAppStore((state) => state.toasts)
  return (
    <div className={styles.host} aria-live="polite" aria-relevant="additions text">
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} />
      ))}
    </div>
  )
}

function ToastCard({ toast }: { toast: Toast }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const enter = window.requestAnimationFrame(() => setVisible(true))
    const life = toast.kind === 'success' ? TOAST_SUCCESS_MS : TOAST_ERROR_MS
    const hide = window.setTimeout(() => setVisible(false), life)
    const remove = window.setTimeout(
      () => useAppStore.getState().dismissToast(toast.id),
      life + TOAST_EXIT_MS
    )
    return () => {
      window.cancelAnimationFrame(enter)
      window.clearTimeout(hide)
      window.clearTimeout(remove)
    }
  }, [toast.id, toast.kind])

  const dismiss = () => {
    setVisible(false)
    window.setTimeout(() => useAppStore.getState().dismissToast(toast.id), TOAST_EXIT_MS)
  }

  return (
    <div
      className={`${styles.toast} ${styles[toast.kind]} ${visible ? styles.in : ''}`}
      role={toast.kind === 'error' ? 'alert' : 'status'}
    >
      <p>{toast.message}</p>
      <button type="button" className={styles.dismiss} onClick={dismiss} aria-label="Dismiss">
        Dismiss
      </button>
    </div>
  )
}
