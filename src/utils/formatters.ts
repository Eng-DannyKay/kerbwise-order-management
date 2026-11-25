const currencyFormatter = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' })

const dateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/London',
})

const shortDateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/London',
})

export function formatCurrency(amount: number): string {
  return currencyFormatter.format(amount)
}

function formatWith(formatter: Intl.DateTimeFormat, isoTimestamp: string): string {
  const date = new Date(isoTimestamp)
  return Number.isNaN(date.getTime()) ? isoTimestamp : formatter.format(date)
}

/** Always shown in shop time (London), whatever the device's time zone. */
export function formatDateTime(isoTimestamp: string): string {
  return formatWith(dateTimeFormatter, isoTimestamp)
}

/** As {@link formatDateTime}, without the year, for compact lists. */
export function formatShortDateTime(isoTimestamp: string): string {
  return formatWith(shortDateTimeFormatter, isoTimestamp)
}
