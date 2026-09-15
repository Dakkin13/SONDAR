import type { TouchEvent } from 'react'

// Finger travel beyond this (in CSS px) means the user was scrolling, not tapping.
const MOVE_TOLERANCE = 10

// Spread onto any element: `<button {...tap(() => …)}>`.
//
// Desktop gets a normal onClick. Touch devices fire on touchend with
// preventDefault, which makes iOS Safari respond immediately and suppresses
// the synthetic click that would otherwise fire the handler twice. Unlike a
// bare touchend handler, this ignores the lift at the end of a scroll gesture
// so a list you were dragging doesn't activate whatever item ended up under
// your finger.
export function tap(fn: () => void) {
  let startX = 0
  let startY = 0
  let moved = false

  return {
    onClick: fn,
    onTouchStart: (e: TouchEvent) => {
      const t = e.touches[0]
      if (!t) return
      startX = t.clientX
      startY = t.clientY
      moved = false
    },
    onTouchMove: (e: TouchEvent) => {
      const t = e.touches[0]
      if (!t) return
      if (Math.abs(t.clientX - startX) > MOVE_TOLERANCE || Math.abs(t.clientY - startY) > MOVE_TOLERANCE) {
        moved = true
      }
    },
    onTouchEnd: (e: TouchEvent) => {
      if (moved) return
      e.preventDefault()
      fn()
    },
  }
}
