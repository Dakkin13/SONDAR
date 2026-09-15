import type { SupabaseClient } from '@supabase/supabase-js'

const MAX_EDGE = 1600
const JPEG_QUALITY = 0.82

// Downscales to at most MAX_EDGE on the long side and re-encodes as JPEG so a
// 4 MB phone photo becomes ~150–300 KB before it ever leaves the device.
// Falls back to the original file if the browser can't decode it.
export async function compressImage(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
    const w = Math.round(bitmap.width * scale)
    const h = Math.round(bitmap.height * scale)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close()
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY))
    return blob ?? file
  } catch {
    return file
  }
}

// Uploads a chat image into the user's own folder of the avatars bucket
// (the bucket every existing upload already uses, so its policies apply)
// and returns the public URL.
export async function uploadChatImage(supabase: SupabaseClient, userId: string, file: File): Promise<string> {
  const blob = await compressImage(file)
  const path = `${userId}/chat/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`
  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, blob, { contentType: 'image/jpeg', upsert: false })
  if (error) throw error
  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
}
