import { useEffect, useRef } from 'react'

/** A pause longer than this starts a new scan. */
const SCAN_IDLE_MS = 1000

function isTextField(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  )
}

/**
 * Captures an order number typed outside a text field, as a barcode scanner does, and calls `onScan` on Enter.
 * That Enter is stopped so it cannot press whichever button has focus. Scans are ignored while a confirmation
 * dialog is open, so a scan can never confirm an action.
 */
export function useScanner(onScan: (term: string) => void) {
  const onScanRef = useRef(onScan)

  useEffect(() => {
    onScanRef.current = onScan
  })

  useEffect(() => {
    let buffer = ''
    let lastKeyAt = 0

    function handleKeyDown(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey || isTextField(event.target)) {
        buffer = ''
        return
      }
      const now = Date.now()
      if (now - lastKeyAt > SCAN_IDLE_MS) buffer = ''
      lastKeyAt = now

      if (/^[0-9]$/.test(event.key) || (event.key === '#' && buffer === '')) {
        buffer += event.key
        return
      }
      if (event.key === 'Enter' && /\d/.test(buffer)) {
        event.preventDefault()
        event.stopPropagation()
        const term = buffer
        buffer = ''
        if (document.querySelector('[role="alertdialog"][open]')) return
        onScanRef.current(term)
        return
      }
      buffer = ''
    }

    document.addEventListener('keydown', handleKeyDown, true)
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, [])
}
