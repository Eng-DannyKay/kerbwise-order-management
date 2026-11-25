import {
  parseMoney,
  parseOrderDetail,
  parseOrderSummary,
  parseOrdersPage,
  parseStatus,
  parseTimestamp,
  readConflictOrder,
  readTransitionFrom,
} from '../../src/services/order-parsers'

const validSummary = {
  id: 'ord_2347',
  number: 2347,
  customerName: 'Lena Bennett',
  phone: '07419226747',
  status: 'new',
  total: 122.25,
  itemCount: 1,
  createdAt: '2026-11-25T15:11:40.146Z',
  channel: 'whatsapp',
  version: 1,
}

const validDetail = {
  ...validSummary,
  lines: [{ name: 'Gift hamper', qty: 1, lineTotal: 122.25 }],
  address: { line1: '19 Mare Street', area: 'Hackney, London' },
  notes: '',
}

describe('parseMoney', () => {
  it.each([
    [122.25, 122.25],
    [38, 38],
    [0, 0],
    ['£122.25', 122.25],
    ['£38.00', 38],
    ['£1401.99', 1401.99],
  ])('reads %p as %p', (input, expected) => {
    expect(parseMoney(input)).toBe(expected)
  })

  it.each([
    ['122.25', 'no pound sign'],
    ['£122.5', 'one decimal place'],
    ['£1,401.99', 'thousands separator, never seen from the API'],
    ['£ 122.25', 'space'],
    ['$122.25', 'other currency'],
    ['£-1.00', 'negative'],
    [-1, 'negative number'],
    [12.345, 'more than two decimals'],
    [Number.NaN, 'NaN'],
    [Number.POSITIVE_INFINITY, 'infinity'],
    [null, 'null'],
    [undefined, 'missing'],
  ])('rejects %p (%s)', (input, _reason) => {
    expect(parseMoney(input)).toBeNull()
  })
})

describe('parseTimestamp', () => {
  it('converts Unix seconds to ISO 8601', () => {
    expect(parseTimestamp(1795621303)).toBe('2026-11-25T15:41:43.000Z')
  })

  it('keeps ISO 8601 with a time zone', () => {
    expect(parseTimestamp('2026-11-25T15:41:43.291Z')).toBe('2026-11-25T15:41:43.291Z')
    expect(parseTimestamp('2026-11-25T16:41:43+01:00')).toBe('2026-11-25T15:41:43.000Z')
  })

  it.each([
    [1795621303000, 'milliseconds, never seen from the API'],
    [1795621303.5, 'fractional seconds'],
    [12345, 'too small to be a date'],
    ['2026-11-25T15:41:43', 'no time zone'],
    ['yesterday', 'not a date'],
    [null, 'null'],
  ])('rejects %p (%s)', (input, _reason) => {
    expect(parseTimestamp(input)).toBeNull()
  })
})

describe('parseStatus', () => {
  it.each([
    ['paid', 'paid'],
    ['PAID', 'paid'],
    ['NEW', 'new'],
    ['FULFILLED', 'fulfilled'],
    ['CANCELLED', 'cancelled'],
    ['on_hold', 'on_hold'],
    ['ON_HOLD', 'on_hold'],
    ['part_refunded', 'part_refunded'],
  ])('reads %p as %p', (input, expected) => {
    expect(parseStatus(input)).toBe(expected)
  })

  it.each(['shipped', 'paid ', 'on hold', 'refunded', '', 1])('never maps the unknown status %p to a known one', (input) => {
    expect(parseStatus(input)).toBeNull()
  })
})

describe('parseOrderSummary', () => {
  it('normalises the list format the real API sends', () => {
    const result = parseOrderSummary({ ...validSummary, status: 'PAID', total: '£280.90', createdAt: 1795621303 })

    expect(result).toEqual({
      ok: true,
      value: { ...validSummary, status: 'paid', total: 280.9, createdAt: '2026-11-25T15:41:43.000Z' },
    })
  })

  it('accepts a till order with no customer name or phone', () => {
    const result = parseOrderSummary({ ...validSummary, customerName: null, phone: null, channel: 'pos' })

    expect(result).toMatchObject({ ok: true, value: { customerName: null, phone: null } })
  })

  it.each([
    [{ status: 'shipped' }, 'unknown status "shipped"'],
    [{ total: '£1,401.99' }, 'unreadable total "£1,401.99"'],
    [{ total: undefined }, 'unreadable total missing'],
    [{ createdAt: 1795621303000 }, 'unreadable order date 1795621303000'],
    [{ channel: 'phone' }, 'unknown channel "phone"'],
    [{ customerName: 42 }, 'unreadable customer name 42'],
    [{ number: '2347' }, 'unreadable order number "2347"'],
    [{ version: null }, 'unreadable version null'],
  ])('rejects %p with a reason', (override, reason) => {
    expect(parseOrderSummary({ ...validSummary, ...override })).toEqual({ ok: false, reason })
  })
})

describe('parseOrderDetail', () => {
  it('reads a valid detail', () => {
    expect(parseOrderDetail(validDetail)).toEqual({ ok: true, value: validDetail })
  })

  it('keeps each line total exactly as sent, without multiplying by quantity', () => {
    const result = parseOrderDetail({ ...validDetail, lines: [{ name: 'Peony bouquet', qty: 2, lineTotal: 40.25 }] })

    expect(result).toMatchObject({ ok: true, value: { lines: [{ qty: 2, lineTotal: 40.25 }] } })
  })

  it('never recalculates the order total from its lines', () => {
    const result = parseOrderDetail({ ...validDetail, total: 130, lines: [{ name: 'Gift hamper', qty: 1, lineTotal: 122.25 }] })

    expect(result).toMatchObject({ ok: true, value: { total: 130 } })
  })

  it.each([
    [{ lines: 'none' }, 'missing order lines'],
    [{ lines: [{ name: 'Mug', qty: 0, lineTotal: 5 }] }, 'unreadable order line 1'],
    [{ lines: [{ name: 'Mug', qty: 1, lineTotal: '5' }] }, 'unreadable order line 1'],
    [{ address: { line1: '1 Mare Street' } }, 'unreadable delivery address'],
    [{ notes: null }, 'unreadable notes'],
  ])('rejects %p with a reason', (override, reason) => {
    expect(parseOrderDetail({ ...validDetail, ...override })).toEqual({ ok: false, reason })
  })
})

describe('parseOrdersPage', () => {
  it('keeps valid orders and reports each unreadable one instead of failing the page', () => {
    const result = parseOrdersPage({
      orders: [validSummary, { ...validSummary, id: 'ord_2337', number: 2337, status: 'teleported' }, 'garbage'],
      page: 1,
      pageSize: 50,
      total: 3,
    })

    expect(result).toEqual({
      ok: true,
      value: {
        orders: [validSummary],
        rejected: [
          { id: 'ord_2337', number: 2337, reason: 'unknown status "teleported"' },
          { id: null, number: null, reason: 'not an order record' },
        ],
        page: 1,
        pageSize: 50,
        total: 3,
      },
    })
  })

  it('fails when the page information itself is missing', () => {
    expect(parseOrdersPage({ orders: [validSummary] })).toEqual({ ok: false, reason: 'missing page information' })
    expect(parseOrdersPage('<html>Bad Gateway</html>')).toEqual({ ok: false, reason: 'missing orders list' })
  })
})

describe('conflict and transition bodies', () => {
  it('normalises the latest order sent with a 409 stale response', () => {
    expect(readConflictOrder({ code: 'stale', current: { ...validDetail, status: 'FULFILLED', version: 2 } })).toMatchObject({
      status: 'fulfilled',
      version: 2,
    })
    expect(readConflictOrder({ code: 'stale', current: { id: 'broken' } })).toBeNull()
  })

  it('reads the status from a 409 invalid transition', () => {
    expect(readTransitionFrom({ code: 'invalid_transition', from: 'on_hold' })).toBe('on_hold')
    expect(readTransitionFrom({ code: 'invalid_transition', from: 'teleported' })).toBeNull()
  })
})
