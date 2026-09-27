export function monthKey(isoDate: string): string {
  return isoDate.slice(0, 7)
}

export function shiftMonth(yearMonth: string, delta: number): string {
  const [year, month] = yearMonth.split('-').map(Number)
  if (!year || !month) return yearMonth
  const date = new Date(year, month - 1 + delta, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function daysInMonth(yearMonth: string): string[] {
  const [year, month] = yearMonth.split('-').map(Number)
  if (!year || !month) return []
  const last = new Date(year, month, 0).getDate()
  return Array.from({ length: last }, (_, index) => `${yearMonth}-${String(index + 1).padStart(2, '0')}`)
}

export function calendarCells(yearMonth: string): { date: string | null }[] {
  const days = daysInMonth(yearMonth)
  if (days.length === 0) return []
  const firstWeekday = new Date(`${days[0]}T00:00:00`).getDay()
  const cells: { date: string | null }[] = Array.from({ length: firstWeekday }, () => ({ date: null }))
  for (const date of days) cells.push({ date })
  while (cells.length % 7 !== 0) cells.push({ date: null })
  return cells
}

export function formatMonthTitle(yearMonth: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(
      new Date(`${yearMonth}-01T00:00:00`)
    )
  } catch {
    return yearMonth
  }
}

export const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
