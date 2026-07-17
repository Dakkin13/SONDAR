import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Supabase's PostgrestError is a plain object, not an Error instance, so
// `err instanceof Error ? err.message : fallback` silently swallows the real
// cause for every Postgrest/RLS failure. Extract .message off any err shape.
export function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'object' && err !== null && 'message' in err) {
    return String((err as { message: unknown }).message)
  }
  return fallback
}
