import { useEffect } from 'react'
import { settingsNeedSetup } from '@shared/settingsSchema'
import { AppHeader } from './components/chrome/AppHeader'
import { StudentPicker } from './components/chrome/StudentPicker'
import { RecoveryScreen } from './components/recovery/RecoveryScreen'
import { RecentDocuments } from './components/recent/RecentDocuments'
import { SettingsScreen } from './components/settings/SettingsScreen'
import { SetupWizard } from './components/setup/SetupWizard'
import { TodayView } from './components/today/TodayView'
import { Workspace } from './components/workspace/Workspace'
import { Button } from './components/shared/Button'
import { ToastHost } from './components/shared/ToastHost'
import { useKeyboard, useSessionHeartbeat } from './hooks/useInput'
import { useAutosave } from './services/autosave'
import { openProject, ensureReadable, refreshDocuments, useCatalogDocuments } from './services/documents'
import { useAppStore } from './stores/appStore'
import { useDocumentStore } from './stores/documentStore'
import styles from './App.module.css'

export default function App() {
  const view = useAppStore((state) => state.view)
  const settings = useAppStore((state) => state.settings)
  const documents = useCatalogDocuments()
  const pendingDrop = useAppStore((state) => state.pendingDrop)
  const activeId = useDocumentStore((state) => state.activeId)

  useAutosave()
  useSessionHeartbeat()
  useKeyboard()

  useEffect(() => {
    void bootstrap()
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => {
      const { open } = useDocumentStore.getState()
      const { recoveryCheckpoints } = useAppStore.getState().settings
      for (const doc of Object.values(open)) {
        void window.studyApi.writeCheckpoint(doc.project)
      }
      void recoveryCheckpoints
    }, 30_000)
    return () => window.clearInterval(timer)
  }, [])

  const student = settings.students.find((item) => item.id === settings.selectedStudentId)
  const subject = student?.subjects.find((item) => item.id === settings.selectedSubjectId)

  const importFiles = async (filePaths: string[]) => {
    if (!student || !subject) {
      useAppStore.getState().setError('Choose a student and subject first.')
      return
    }
    const result = await window.studyApi.importPdfs({
      filePaths,
      studentId: student.id,
      subjectId: subject.id
    })
    useAppStore.getState().setPendingDrop([])
    if (!result.ok) {
      useAppStore.getState().setError(result.error)
      return
    }
    await refreshDocuments()
    let opened = false
    for (const project of result.data) {
      if (!opened) {
        opened = await openProject(project, { discardIfUnreadable: true })
      } else {
        await ensureReadable(project, { discardIfUnreadable: true })
      }
    }
  }

  const onDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    const files = [...event.dataTransfer.files].filter((file) => file.name.toLowerCase().endsWith('.pdf'))
    if (files.length === 0) {
      useAppStore.getState().setError('Drop a PDF worksheet.')
      return
    }
    const paths = files.map((file) => window.studyApi.getPathForFile(file)).filter(Boolean)
    if (settings.confirmDrop) useAppStore.getState().setPendingDrop(paths)
    else void importFiles(paths)
  }

  return (
    <div
      className={styles.app}
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
    >
      <ToastHost />
      {view === 'loading' && <main className={styles.center}>Opening StudyPDF…</main>}
      {view === 'setup' && <SetupWizard />}
      {view === 'recovery' && <RecoveryScreen />}
      {view === 'picker' && <StudentPicker />}
      {view === 'settings' && <SettingsScreen />}
      {view === 'recent' && <RecentDocuments />}
      {view === 'main' && student && (
        <div className={styles.shell}>
          <AppHeader />
          <div className={styles.body}>
            {activeId ? (
              <Workspace />
            ) : (
              <TodayView student={student} subjectId={settings.selectedSubjectId ?? ''} documents={documents} />
            )}
          </div>
        </div>
      )}
      {view === 'main' && !student && <StudentPicker />}
      {pendingDrop.length > 0 && student && subject && (
        <div className={styles.modal} role="dialog" aria-labelledby="drop-title">
          <div className={styles.dialog}>
            <h2 id="drop-title">Add {pendingDrop.length === 1 ? 'this worksheet' : 'these worksheets'}?</h2>
            <p>
              {student.name} · {subject.name} · today
            </p>
            <div className={styles.actions}>
              <Button onClick={() => void importFiles(pendingDrop)}>Add</Button>
              <Button variant="ghost" onClick={() => useAppStore.getState().setPendingDrop([])}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

async function bootstrap(): Promise<void> {
  const app = useAppStore.getState()
  const settings = await window.studyApi.getSettings()
  if (!settings.ok) {
    app.setError(settings.error)
    app.setView('setup')
    return
  }
  app.setSettings(settings.data)
  const docs = await window.studyApi.listDocuments()
  if (docs.ok) app.setDocuments(docs.data)
  if (settingsNeedSetup(settings.data)) {
    app.setView('setup')
    return
  }
  const recovery = await window.studyApi.getRecovery()
  if (recovery.ok && recovery.data.length > 0) {
    app.setRecovery(recovery.data)
    app.setView('recovery')
    return
  }
  if (!settings.data.selectedStudentId) {
    app.setView('picker')
    return
  }
  app.setView('main')
}
