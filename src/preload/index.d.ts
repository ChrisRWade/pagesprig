import type { StudyApi } from '@shared/ipc'

declare global {
  interface Window {
    studyApi: StudyApi
  }
}

export {}
