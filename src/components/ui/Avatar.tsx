'use client'

import Image from 'next/image'
import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface AvatarProps {
  src: string | null | undefined
  alt: string
  /** Rendered width and height in CSS px. */
  size: number
  shape?: 'circle' | 'rounded'
  /** Corner radius for shape="rounded"; defaults to ~28% of size. */
  radius?: number
  border?: string
  boxShadow?: string
  /** Background of the fallback box (no src). */
  background?: string
  className?: string
  style?: CSSProperties
  /** Fallback content when there is no src — initials, an emoji, an icon. */
  children?: ReactNode
  priority?: boolean
}

// One avatar for people and bands. Remote images go through next/image so
// a 3 MB phone photo is served at 50–100px instead of full size; blob:/data:
// previews from an <input type="file"> are passed through untouched.
//
// Width/height are set in BOTH the width/height props and the inline style.
// Tailwind's preflight applies `img { height: auto }`, which otherwise
// overrides the height and turns non-square photos into ovals.
export default function Avatar({
  src,
  alt,
  size,
  shape = 'circle',
  radius,
  border,
  boxShadow,
  background,
  className,
  style,
  children,
  priority,
}: AvatarProps) {
  const borderRadius = shape === 'circle' ? '50%' : (radius ?? Math.round(size * 0.28))
  const box: CSSProperties = { width: size, height: size, borderRadius, flexShrink: 0, border, boxShadow, ...style }

  if (src) {
    return (
      <Image
        src={src}
        alt={alt}
        width={size}
        height={size}
        priority={priority}
        unoptimized={!/^https?:\/\//.test(src)}
        className={className}
        style={{ ...box, objectFit: 'cover' }}
      />
    )
  }

  return (
    <div
      className={cn('flex items-center justify-center overflow-hidden', className)}
      style={{ ...box, background: background ?? 'rgba(255,255,255,0.06)' }}
      aria-label={alt}
    >
      {children}
    </div>
  )
}
