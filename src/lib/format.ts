const dateTimeFormatter = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' })

export function formatDateTime(date: Date): string {
  return dateTimeFormatter.format(date)
}
