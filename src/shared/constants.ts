export const APP_NAME = 'StudyPDF'
export const APP_VERSION = '0.1.0'

export const SETTINGS_VERSION = 1
export const PROJECT_VERSION = 1

export const DEFAULT_FOLDER_TEMPLATE = '{student}/{year}/{month}/{date}/{subject}'
export const DEFAULT_FILENAME_TEMPLATE = '{date} - {subject} - {originalName}'

export const AUTOSAVE_DEBOUNCE_MS = 350
export const RECOVERY_CHECKPOINT_MS = 30_000
export const RECOVERY_CHECKPOINT_LIMIT = 8
export const HISTORY_LIMIT = 250
export const VIRTUALIZATION_BUFFER = 2
export const SESSION_HEARTBEAT_MS = 4_000

export const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const

export const LETTER_WIDTH_PT = 612
export const LETTER_HEIGHT_PT = 792

export const DEFAULT_PENCIL_WIDTH_PT = 1.6
export const DEFAULT_HIGHLIGHT_WIDTH_PT = 14
export const DEFAULT_SHAPE_WIDTH_PT = 2
export const DEFAULT_TEXT_SIZE_PT = 16

export const PENCIL_COLOR = '#1A1612'
export const HIGHLIGHT_COLOR = '#F5D76E'
export const SHAPE_COLOR = '#1F4E79'
export const TEXT_COLOR = '#1A1612'

export const HIGHLIGHT_OPACITY = 0.42

export const ANNOTATIONS_FILE = 'annotations.study.json'
export const ORIGINAL_PDF_FILE = 'original.pdf'
export const RECOVERY_DIR = '.recovery'
export const INDEX_FILE = '.studypdf-index.json'

export const ERROR_CODES = {
  INVALID_PDF: 'INVALID_PDF',
  PASSWORD_PROTECTED: 'PASSWORD_PROTECTED',
  CORRUPT_PDF: 'CORRUPT_PDF',
  MISSING_SOURCE: 'MISSING_SOURCE',
  STORAGE_UNAVAILABLE: 'STORAGE_UNAVAILABLE',
  DISK_FULL: 'DISK_FULL',
  FILE_LOCKED: 'FILE_LOCKED',
  INVALID_PATH: 'INVALID_PATH',
  EXTERNAL_CHANGE: 'EXTERNAL_CHANGE',
  EXPORT_FAILED: 'EXPORT_FAILED',
  SAVE_FAILED: 'SAVE_FAILED',
  VALIDATION: 'VALIDATION',
  UNKNOWN: 'UNKNOWN'
} as const

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES]
