'use client'

import { useEscapeKey } from '@/lib/hooks/useEscapeKey'

interface ImageLightboxProps {
  url: string | null
  onClose: () => void
}

// Full-screen viewer for a chat photo. Plain <img>: the point is the full
// resolution, so the optimizer would only add a hop.
export default function ImageLightbox({ url, onClose }: ImageLightboxProps) {
  useEscapeKey(url !== null, onClose)
  if (!url) return null

  return (
    <div
      className="fixed inset-0 z-[500] flex cursor-pointer items-center justify-center bg-black/95"
      style={{ backdropFilter: 'blur(10px)' }}
      onClick={onClose}
      role="dialog"
      aria-label="Photo"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt=""
        style={{ maxWidth: '95vw', maxHeight: '90dvh', objectFit: 'contain', borderRadius: 12, cursor: 'default' }}
        onClick={(e) => e.stopPropagation()}
      />
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 flex h-11 w-11 items-center justify-center rounded-full text-white"
        style={{ top: 'calc(16px + env(safe-area-inset-top, 0px))', background: 'rgba(255,255,255,0.12)', fontSize: 20 }}
        aria-label="Close"
      >
        ×
      </button>
    </div>
  )
}
