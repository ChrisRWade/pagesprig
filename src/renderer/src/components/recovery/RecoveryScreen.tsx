import { formatTime } from '@shared/utils'
import { Button } from '../shared/Button'
import { openProject, openSummary } from '../../services/documents'
import { useAppStore } from '../../stores/appStore'
import styles from './RecoveryScreen.module.css'

export function RecoveryScreen() {
  const recovery = useAppStore((state) => state.recovery)
  const documents = useAppStore((state) => state.documents)
  const setView = useAppStore((state) => state.setView)

  const resume = async (projectDir: string) => {
    const match = documents.find((item) => item.projectDir === projectDir)
    if (match) await openSummary(match)
    setView('main')
  }

  const savedCopy = async (projectDir: string) => {
    const loaded = await window.studyApi.loadCheckpoint(projectDir)
    if (!loaded.ok) {
      useAppStore.getState().setError(loaded.error)
      return
    }
    const opened = await openProject(loaded.data)
    if (opened) setView('main')
  }

  return (
    <main className={styles.wrap}>
      <h1>We found schoolwork that was open when the app closed.</h1>
      <p>Choose Resume to keep going from the last autosave.</p>
      <ul className={styles.list}>
        {recovery.map((item) => (
          <li key={item.documentId} className={styles.item}>
            <div>
              <strong>{item.title}</strong>
              <p>
                {item.studentName} · {item.subjectName} · Last saved {formatTime(item.lastSavedAt)}
              </p>
            </div>
            <div className={styles.actions}>
              <Button onClick={() => void resume(item.projectDir)}>Resume</Button>
              <Button variant="ghost" onClick={() => void savedCopy(item.projectDir)}>
                Open saved copy
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <Button variant="ghost" onClick={() => setView('main')}>
        Skip
      </Button>
    </main>
  )
}
