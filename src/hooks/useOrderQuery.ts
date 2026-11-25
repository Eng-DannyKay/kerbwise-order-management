import { useEffect, useState } from 'react'
import type { OrderSortField, OrderStatus, OrdersQuery, SortDirection } from '../types/order.types'

export const SEARCH_DELAY_MS = 300

export const SORT_OPTIONS = [
  { value: 'createdAt-desc', label: 'Date created · Newest first', shortLabel: 'Newest first', sort: 'createdAt', dir: 'desc' },
  { value: 'createdAt-asc', label: 'Date created · Oldest first', shortLabel: 'Oldest first', sort: 'createdAt', dir: 'asc' },
  { value: 'total-desc', label: 'Total · High to low', shortLabel: 'Total, high to low', sort: 'total', dir: 'desc' },
  { value: 'total-asc', label: 'Total · Low to high', shortLabel: 'Total, low to high', sort: 'total', dir: 'asc' },
] as const satisfies readonly {
  value: string
  label: string
  shortLabel: string
  sort: OrderSortField
  dir: SortDirection
}[]

export type SortOptionValue = (typeof SORT_OPTIONS)[number]['value']
export type StatusFilter = OrderStatus | 'all'

interface Filters {
  q: string
  status: StatusFilter
  sort: SortOptionValue
}

const DEFAULT_FILTERS: Filters = { q: '', status: 'all', sort: 'createdAt-desc' }

/** Search, filter, sort and page state. Any filter change returns to page 1. */
export function useOrderQuery(pageSize: number) {
  const [searchText, setSearchText] = useState('')
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [page, setPage] = useState(1)

  function updateFilters(changes: Partial<Filters>) {
    setFilters((current) => ({ ...current, ...changes }))
    setPage(1)
  }

  useEffect(() => {
    const q = searchText.trim()
    if (q === filters.q) return
    const timer = setTimeout(() => {
      setFilters((current) => ({ ...current, q }))
      setPage(1)
    }, SEARCH_DELAY_MS)
    return () => clearTimeout(timer)
  }, [searchText, filters.q])

  const sortOption = SORT_OPTIONS.find((option) => option.value === filters.sort) ?? SORT_OPTIONS[0]
  const query: OrdersQuery = {
    q: filters.q || undefined,
    status: filters.status === 'all' ? undefined : filters.status,
    sort: sortOption.sort,
    dir: sortOption.dir,
    page,
    pageSize,
  }

  return {
    query,
    page,
    setPage,
    searchText,
    setSearchText,
    submitSearch: () => updateFilters({ q: searchText.trim() }),
    searchFor: (term: string) => {
      setSearchText(term)
      updateFilters({ q: term.trim() })
    },
    clearSearch: () => {
      setSearchText('')
      updateFilters({ q: '' })
    },
    search: filters.q,
    status: filters.status,
    setStatus: (status: StatusFilter) => updateFilters({ status }),
    sort: filters.sort,
    setSort: (sort: SortOptionValue) => updateFilters({ sort }),
    isFiltered: filters.q !== '' || filters.status !== 'all',
    clearFilters: () => {
      setSearchText('')
      updateFilters({ q: '', status: 'all' })
    },
  }
}
