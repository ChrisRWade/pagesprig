export const APP_NAME = 'PageSprig'
export const APP_ID = 'org.pagesprig.app'
export const APP_VERSION = '0.1.0'
export const LEGACY_USER_DATA_NAMES = ['study-pdf', 'StudyPDF'] as const

export const SETTINGS_VERSION = 1
export const PROJECT_VERSION = 1

export const DEFAULT_FOLDER_TEMPLATE = '{student}/{year}/{month}/{date}/{subject}'
export const DEFAULT_FILENAME_TEMPLATE = '{date} - {subject} - {originalName}'

export const AUTOSAVE_DEBOUNCE_MS = 800
export const RECOVERY_CHECKPOINT_MS = 30_000
export const RECOVERY_CHECKPOINT_LIMIT = 8
export const HISTORY_LIMIT = 250
export const VIRTUALIZATION_BUFFER = 1
export const SESSION_HEARTBEAT_MS = 4_000
export const TOAST_ERROR_MS = 10_000
export const BANNER_DISMISS_MS = TOAST_ERROR_MS
export const TOAST_SUCCESS_MS = 5_000
export const TOAST_EXIT_MS = 180

export const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const

export const LETTER_WIDTH_PT = 612
export const LETTER_HEIGHT_PT = 792

export const DEFAULT_PENCIL_WIDTH_PT = 1.6
export const DEFAULT_HIGHLIGHT_WIDTH_PT = 14
export const DEFAULT_SHAPE_WIDTH_PT = 2
export const DEFAULT_TEXT_SIZE_PT = 16
export const TEXT_FONT_STACK = 'Atkinson Hyperlegible, Segoe UI, sans-serif'
export const TEXT_LINE_HEIGHT = 1.25

export const PENCIL_COLOR = '#1A1612'
export const HIGHLIGHT_COLOR = '#F5D76E'
export const SHAPE_COLOR = '#1F4E79'
export const TEXT_COLOR = '#1A1612'

export const HIGHLIGHT_OPACITY = 0.42

export type ColorableTool = 'pencil' | 'highlighter' | 'line' | 'rect' | 'ellipse' | 'arrow'

export interface ToolSwatch {
  id: string
  name: string
  value: string
}

/** Opaque crayon colors for pencil, line, box, circle, and arrow. */
export const INK_SWATCHES: readonly ToolSwatch[] = [
  { id: 'graphite', name: 'Black', value: PENCIL_COLOR },
  { id: 'navy', name: 'Blue', value: SHAPE_COLOR },
  { id: 'brick', name: 'Red', value: '#C44536' },
  { id: 'forest', name: 'Green', value: '#2F6B4F' },
  { id: 'grape', name: 'Purple', value: '#6B3FA0' },
  { id: 'amber', name: 'Orange', value: '#C47B12' }
]

/** Washed marker colors for the highlighter. */
export const HIGHLIGHT_SWATCHES: readonly ToolSwatch[] = [
  { id: 'yellow', name: 'Yellow', value: HIGHLIGHT_COLOR },
  { id: 'pink', name: 'Pink', value: '#F4A6C1' },
  { id: 'mint', name: 'Green', value: '#8ED4A4' },
  { id: 'sky', name: 'Blue', value: '#8EC8F0' },
  { id: 'peach', name: 'Orange', value: '#F5B57A' },
  { id: 'lilac', name: 'Purple', value: '#C9B6F2' }
]

export const DEFAULT_TOOL_COLORS: Record<ColorableTool, string> = {
  pencil: PENCIL_COLOR,
  highlighter: HIGHLIGHT_COLOR,
  line: SHAPE_COLOR,
  rect: SHAPE_COLOR,
  ellipse: SHAPE_COLOR,
  arrow: SHAPE_COLOR
}

export function isColorableTool(tool: string): tool is ColorableTool {
  return tool in DEFAULT_TOOL_COLORS
}

export function swatchesForTool(tool: ColorableTool): readonly ToolSwatch[] {
  return tool === 'highlighter' ? HIGHLIGHT_SWATCHES : INK_SWATCHES
}

export const MARK_SIZE_PRESETS = {
  small: 0.018,
  medium: 0.028,
  large: 0.04
} as const

export type MarkSize = keyof typeof MARK_SIZE_PRESETS

/** Keep smaller checks/Xs bold so they stay readable. */
export function markStrokeFactor(size: number): number {
  const t = Math.min(1, Math.max(0, size / MARK_SIZE_PRESETS.large))
  return 1 + (1 - t) * 0.55
}

export const ANNOTATIONS_FILE = 'annotations.study.json'
export const ORIGINAL_PDF_FILE = 'original.pdf'
export const RECOVERY_DIR = '.recovery'
export const INDEX_FILE = '.pagesprig-index.json'
export const LEGACY_INDEX_FILE = '.studypdf-index.json'

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
