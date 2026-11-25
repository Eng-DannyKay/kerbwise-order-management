import { render, screen } from '@testing-library/react'
import { App } from '../src/app/App'
import { getOrders } from '../src/services/orders-api'
import { buildPage } from './fixtures/orders'

jest.mock('../src/services/orders-api')

describe('App', () => {
  it('shows the shop and the Orders page', async () => {
    jest.mocked(getOrders).mockResolvedValue(buildPage([]))

    render(<App />)

    expect(screen.getByText('Kerbwise')).toBeInTheDocument()
    expect(screen.getByText('Fern & Thistle')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Orders' })).toBeInTheDocument()
    expect(await screen.findByText('No orders yet')).toBeInTheDocument()
  })
})
