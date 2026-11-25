import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { SortMenu } from '../../src/components/orders/SortMenu'
import type { SortOptionValue } from '../../src/hooks/useOrderQuery'

function ControlledSortMenu({ onChange }: { onChange: (value: SortOptionValue) => void }) {
  const [value, setValue] = useState<SortOptionValue>('createdAt-desc')
  return (
    <>
      <SortMenu
        value={value}
        onChange={(next) => {
          setValue(next)
          onChange(next)
        }}
      />
      <p>Outside</p>
    </>
  )
}

function sortButton() {
  return screen.getByRole('button', { name: /^Sort:/ })
}

describe('SortMenu', () => {
  it('shows the current sort and marks it in the menu', async () => {
    const user = userEvent.setup()
    render(<ControlledSortMenu onChange={jest.fn()} />)

    expect(sortButton()).toHaveTextContent('Sort: Newest first')
    expect(sortButton()).toHaveAttribute('aria-expanded', 'false')

    await user.click(sortButton())

    expect(sortButton()).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('menuitemradio', { name: 'Date created · Newest first' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('menuitemradio', { name: 'Date created · Newest first' })).toHaveFocus()
  })

  it('picks an option with the mouse and closes', async () => {
    const user = userEvent.setup()
    const onChange = jest.fn()
    render(<ControlledSortMenu onChange={onChange} />)

    await user.click(sortButton())
    await user.click(screen.getByRole('menuitemradio', { name: 'Total · High to low' }))

    expect(onChange).toHaveBeenCalledWith('total-desc')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(sortButton()).toHaveTextContent('Sort: Total, high to low')
    expect(sortButton()).toHaveFocus()
  })

  it('works with the keyboard alone', async () => {
    const user = userEvent.setup()
    const onChange = jest.fn()
    render(<ControlledSortMenu onChange={onChange} />)

    sortButton().focus()
    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('menuitemradio', { name: 'Date created · Newest first' })).toHaveFocus()

    await user.keyboard('{ArrowDown}{ArrowDown}')
    expect(screen.getByRole('menuitemradio', { name: 'Total · High to low' })).toHaveFocus()
    await user.keyboard('{End}')
    expect(screen.getByRole('menuitemradio', { name: 'Total · Low to high' })).toHaveFocus()
    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('menuitemradio', { name: 'Date created · Newest first' })).toHaveFocus()
    await user.keyboard('{ArrowUp}{Enter}')

    expect(onChange).toHaveBeenCalledWith('total-asc')
    expect(sortButton()).toHaveFocus()
  })

  it('closes on Escape without changing the sort, and returns focus', async () => {
    const user = userEvent.setup()
    const onChange = jest.fn()
    render(<ControlledSortMenu onChange={onChange} />)

    await user.click(sortButton())
    await user.keyboard('{ArrowDown}{Escape}')

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(sortButton()).toHaveFocus()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('closes when clicking elsewhere', async () => {
    const user = userEvent.setup()
    render(<ControlledSortMenu onChange={jest.fn()} />)

    await user.click(sortButton())
    await user.click(screen.getByText('Outside'))

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})
