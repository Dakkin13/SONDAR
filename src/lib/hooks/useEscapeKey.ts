'use client'

import { useEffect } from 'react'

// Calls onEscape when the Escape key is pressed while `active` is true.
// Use on anything dismissable — sheets, menus, lightboxes, popovers — so
// keyboard users on desktop aren't forced to find the backdrop with a mouse.
export function useEscapeKey(active: boolean, onEscape: () => void) {
  useEffect(() => {
    if (!active) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onEscape()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [active, onEscape])
}
