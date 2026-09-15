'use client'

import { useEffect, useState } from 'react'

// SSR-safe matchMedia subscription. `initial` is what the server and the
// first client render assume; the real value takes over after mount.
export function useMediaQuery(query: string, initial = false): boolean {
  const [matches, setMatches] = useState(initial)

  useEffect(() => {
    const mql = window.matchMedia(query)
    const update = () => setMatches(mql.matches)
    update()
    mql.addEventListener('change', update)
    return () => mql.removeEventListener('change', update)
  }, [query])

  return matches
}

// True on devices with a real pointer that can hover (mouse/trackpad).
// Defaults to true so desktop never flashes touch-mode affordances on load;
// phones flip to false right after mount.
export function useCanHover(): boolean {
  return useMediaQuery('(hover: hover) and (pointer: fine)', true)
}

// True on touch-first devices (phones/tablets). Defaults to false.
export function useCoarsePointer(): boolean {
  return useMediaQuery('(pointer: coarse)', false)
}
