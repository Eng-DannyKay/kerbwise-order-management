import { formatCurrency, formatDateTime, formatShortDateTime } from '../../src/utils/formatters'

describe('formatCurrency', () => {
  it.each([
    [176.99, '£176.99'],
    [38, '£38.00'],
    [1234.5, '£1,234.50'],
  ])('formats %p as %p', (amount, expected) => {
    expect(formatCurrency(amount)).toBe(expected)
  })
})

describe('formatDateTime', () => {
  it('uses London time in winter (GMT)', () => {
    expect(formatDateTime('2026-11-24T11:56:41.612Z')).toBe('24 Nov 2026, 11:56')
  })

  it('uses London time in summer (BST)', () => {
    expect(formatDateTime('2026-07-01T11:00:00Z')).toBe('1 Jul 2026, 12:00')
  })

  it('returns the original value when it is not a valid date', () => {
    expect(formatDateTime('not-a-date')).toBe('not-a-date')
  })
})

describe('formatShortDateTime', () => {
  it('leaves out the year and still uses London time', () => {
    expect(formatShortDateTime('2026-11-24T11:56:41.612Z')).toBe('24 Nov, 11:56')
    expect(formatShortDateTime('2026-07-01T11:00:00Z')).toBe('1 Jul, 12:00')
  })
})
