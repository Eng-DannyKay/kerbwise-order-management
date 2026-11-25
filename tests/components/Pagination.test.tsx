import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Pagination } from '../../src/components/ui/Pagination'

function pageNumbers(): string[] {
  const nav = screen.getByRole('navigation', { name: 'Pagination' })
  return within(nav)
    .getAllByRole('button', { name: /^Page \d+$/ })
    .map((button) => button.textContent ?? '')
}

describe('Pagination', () => {
  it('shows every page when there are only a few', () => {
    render(<Pagination page={2} pageSize={20} total={60} onPageChange={jest.fn()} />)

    expect(pageNumbers()).toEqual(['1', '2', '3'])
    expect(screen.getByRole('button', { name: 'Page 2' })).toHaveAttribute('aria-current', 'page')
  })

  it.each([
    [1, ['1', '2', '3', '4', '5', '8']],
    [4, ['1', '3', '4', '5', '8']],
    [8, ['1', '4', '5', '6', '7', '8']],
  ])('keeps the first, last and nearby pages when on page %i of 8', (page, expected) => {
    render(<Pagination page={page} pageSize={20} total={148} onPageChange={jest.fn()} />)

    expect(pageNumbers()).toEqual(expected)
    expect(screen.getByText('Showing ' + ((page - 1) * 20 + 1) + '–' + Math.min(page * 20, 148) + ' of 148 orders')).toBeInTheDocument()
  })

  it('jumps straight to a chosen page', async () => {
    const user = userEvent.setup()
    const onPageChange = jest.fn()
    render(<Pagination page={1} pageSize={20} total={148} onPageChange={onPageChange} />)

    await user.click(screen.getByRole('button', { name: 'Page 5' }))

    expect(onPageChange).toHaveBeenCalledWith(5)
  })

  it('ignores Previous on the first page and Next on the last', async () => {
    const user = userEvent.setup()
    const onPageChange = jest.fn()
    const { rerender } = render(<Pagination page={1} pageSize={20} total={40} onPageChange={onPageChange} />)

    await user.click(screen.getByRole('button', { name: 'Previous page' }))
    rerender(<Pagination page={2} pageSize={20} total={40} onPageChange={onPageChange} />)
    await user.click(screen.getByRole('button', { name: 'Next page' }))

    expect(onPageChange).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Next page' })).toHaveAttribute('aria-disabled', 'true')
  })
})
