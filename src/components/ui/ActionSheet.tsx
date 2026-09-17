'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useEscapeKey } from '@/lib/hooks/useEscapeKey'

export interface SheetAction {
  label: string
  onSelect: () => void
  /** Red, for destructive actions. */
  destructive?: boolean
  icon?: string
}

interface ActionSheetProps {
  open: boolean
  onClose: () => void
  title?: string
  actions: SheetAction[]
}

// Instagram-style bottom sheet: a list of actions, Cancel at the bottom,
// tap outside or Escape to dismiss. Used for "⋯" menus on posts and comments.
export function ActionSheet({ open, onClose, title, actions }: ActionSheetProps) {
  useEscapeKey(open, onClose)
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[400] flex items-end justify-center bg-black/60 backdrop-blur-sm"
          onClick={onClose}
          role="dialog"
        >
          <motion.div
            initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 340 }}
            className="w-full max-w-lg px-3"
            style={{ paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="overflow-hidden rounded-2xl" style={{ background: 'rgba(24,24,24,0.98)', border: '1px solid rgba(255,255,255,0.08)' }}>
              {title && (
                <p className="px-4 py-3 text-center text-[11px] text-[rgba(240,239,235,0.4)]" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {title}
                </p>
              )}
              {actions.map((a, i) => (
                <button
                  key={a.label}
                  type="button"
                  onClick={() => { onClose(); a.onSelect() }}
                  className="flex w-full items-center justify-center gap-2 py-3.5 text-[15px] transition-colors active:bg-white/5"
                  style={{
                    color: a.destructive ? '#ef4444' : '#F0EFEB',
                    fontWeight: a.destructive ? 600 : 400,
                    borderTop: i > 0 ? '1px solid rgba(255,255,255,0.06)' : undefined,
                  }}
                >
                  {a.icon && <span aria-hidden>{a.icon}</span>}{a.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="mt-2 w-full rounded-2xl py-3.5 text-[15px] font-semibold text-[#F0EFEB]"
              style={{ background: 'rgba(24,24,24,0.98)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              Cancel
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

interface ConfirmSheetProps {
  open: boolean
  title: string
  message?: string
  confirmLabel?: string
  onConfirm: () => void
  onClose: () => void
}

// "Delete comment?" style confirmation: centred card with a red confirm
// button, replacing window.confirm() which looks foreign inside the app.
export function ConfirmSheet({ open, title, message, confirmLabel = 'Delete', onConfirm, onClose }: ConfirmSheetProps) {
  useEscapeKey(open, onClose)
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[410] flex items-center justify-center bg-black/60 px-6 backdrop-blur-sm"
          onClick={onClose}
          role="alertdialog"
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
            transition={{ type: 'spring', damping: 26, stiffness: 380 }}
            className="w-full max-w-xs overflow-hidden rounded-2xl text-center"
            style={{ background: 'rgba(24,24,24,0.98)', border: '1px solid rgba(255,255,255,0.08)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="px-5 pt-5 pb-4">
              <p className="text-[16px] font-semibold text-[#F0EFEB]">{title}</p>
              {message && <p className="mt-1.5 text-[13px] leading-snug text-[rgba(240,239,235,0.45)]">{message}</p>}
            </div>
            <button
              type="button"
              onClick={() => { onClose(); onConfirm() }}
              className="w-full py-3.5 text-[15px] font-semibold transition-colors active:bg-white/5"
              style={{ color: '#ef4444', borderTop: '1px solid rgba(255,255,255,0.06)' }}
            >
              {confirmLabel}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3.5 text-[15px] text-[#F0EFEB] transition-colors active:bg-white/5"
              style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
            >
              Cancel
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
