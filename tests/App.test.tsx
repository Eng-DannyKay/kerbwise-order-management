import { render, screen } from '@testing-library/react'
import { App } from '../src/app/App'

describe('App', () => {
  it('renders the Order Desk heading', () => {
    render(<App />)

    expect(screen.getByRole('heading', { level: 1, name: 'Order Desk' })).toBeInTheDocument()
  })
})
