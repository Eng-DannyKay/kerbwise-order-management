import { render, screen } from '@testing-library/react'
import { ConfigError } from '../../src/app/ConfigError'
import { findMissingSettings } from '../../src/config/check-config'
import { describeOrderCount, displayCustomerName } from '../../src/utils/order-labels'
import { getErrorMessage } from '../../src/utils/error-messages'
import { ApiError } from '../../src/services/api-error'

describe('configuration', () => {
  it('lists settings that are missing or blank', () => {
    expect(findMissingSettings({ VITE_API_BASE_URL: 'http://localhost:4000', VITE_API_TOKEN: '  ' })).toEqual(['VITE_API_TOKEN'])
    expect(findMissingSettings({ VITE_API_BASE_URL: undefined, VITE_API_TOKEN: undefined })).toEqual([
      'VITE_API_BASE_URL',
      'VITE_API_TOKEN',
    ])
    expect(findMissingSettings({ VITE_API_BASE_URL: 'x', VITE_API_TOKEN: 'y' })).toEqual([])
  })

  it('shows a visible setup message naming the missing settings', () => {
    render(<ConfigError missing={['VITE_API_TOKEN']} />)

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('The order desk isn’t set up yet')
    expect(alert).toHaveTextContent('VITE_API_TOKEN')
  })
})

describe('displayCustomerName', () => {
  it.each([
    ['  ben  bennett ', 'ben bennett'],
    ['Lena Bennett', 'Lena Bennett'],
    [null, 'Till customer'],
    ['   ', 'No name given'],
  ])('shows %p as %p', (input, expected) => {
    expect(displayCustomerName(input)).toBe(expected)
  })
})

describe('describeOrderCount', () => {
  it.each([
    [148, 'all', '148 orders'],
    [1, 'paid', '1 paid order'],
    [8, 'on_hold', '8 orders on hold'],
    [3, 'part_refunded', '3 part-refunded orders'],
  ] as const)('describes %p %p orders as %p', (count, status, expected) => {
    expect(describeOrderCount(count, status)).toBe(expected)
  })
})

describe('getErrorMessage', () => {
  it.each([
    [new ApiError('Request failed with status 401.', 401, 'unauthorized'), 'The desk isn’t allowed to read orders.'],
    [new ApiError('Request failed with status 429.', 429, 'slow_down'), 'The orders service is busy right now.'],
    [new ApiError('Request failed with status 502.', 502, null), 'The orders service has a problem at the moment.'],
    [new ApiError('Request failed with status 418.', 418, null), 'The orders service couldn’t handle that request.'],
    [new Error('TypeError: x is undefined'), 'Something went wrong.'],
  ])('never shows status codes or technical text for %p', (error, expected) => {
    const message = getErrorMessage(error)
    expect(message).toContain(expected)
    expect(message).not.toMatch(/\d{3}|status|TypeError|JSON|fetch/i)
  })
})
