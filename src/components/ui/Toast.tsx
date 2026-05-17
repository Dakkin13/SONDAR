'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

// ── Types ─────────────────────────────────────────────────────────────────────

type ToastVariant = 'default' | 'success' | 'error'

interface ToastItem {
  id: string
  message: string
  variant: ToastVariant
}

interface ToastContextValue {
  toast: (message: string, variant?: ToastVariant) => void
}

// ── Context ───────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}

// ── Single toast item ─────────────────────────────────────────────────────────

const ACCENT: Record<ToastVariant, string> = {
  default: '#FF5500',
  success: '#4ade80',
  error:   '#f87171',
}

function Toast({ item, onDismiss }: { item: ToastItem; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const t = setTimeout(() => onDismiss(item.id), 3000)
    return () => clearTimeout(t)
  }, [item.id, onDismiss])

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.96 }}
      animate={{ opacity: 1, y: 0,  scale: 1    }}
      exit={{    opacity: 0, y: 20, scale: 0.96 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] as const }}
      onClick={() => onDismiss(item.id)}
      className="flex cursor-pointer items-center gap-3 overflow-hidden rounded-xl px-4 py-3 shadow-[0_4px_24px_rgba(0,0,0,0.5)]"
      style={{
        background: 'rgba(24,24,24,0.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderLeft: `3px solid ${ACCENT[item.variant]}`,
        fontFamily: 'var(--font-dm-sans)',
        fontSize: 14,
        color: '#F0EFEB',
        maxWidth: 340,
        width: 'calc(100vw - 32px)',
      }}
    >
      {item.message}
    </motion.div>
  )
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const counterRef = useRef(0)

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback((message: string, variant: ToastVariant = 'default') => {
    const id = `t-${++counterRef.current}`
    setToasts((prev) => [...prev, { id, message, variant }])
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}

      {/* Portal — fixed bottom-center */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-24 left-0 right-0 z-[200] flex flex-col items-center gap-2"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <AnimatePresence mode="sync">
          {toasts.map((item) => (
            <div key={item.id} className="pointer-events-auto">
              <Toast item={item} onDismiss={dismiss} />
            </div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}
