import type { SupabaseClient } from '@supabase/supabase-js'

const MAX_EDGE = 1600
const JPEG_QUALITY = 0.82

async function decodeWithBitmap(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    // Older Safari rejects the options object.
    return await createImageBitmap(file)
  }
}

// Fallback for formats createImageBitmap won't decode (notably HEIC from
// iPhones — Safari can still render those through an <img>).
function decodeWithImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new window.Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not decode image')) }
    img.src = url
  })
}

function toJpeg(source: CanvasImageSource, width: number, height: number): Promise<Blob | null> {
  const scale = Math.min(1, MAX_EDGE / Math.max(width, height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width * scale))
  canvas.height = Math.max(1, Math.round(height * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.resolve(null)
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY))
}

// Downscales to at most MAX_EDGE on the long side and re-encodes as JPEG so
// a 4 MB phone photo becomes ~150–300 KB before it leaves the device, and so
// the bucket always receives a plain JPEG regardless of the source format.
export async function compressImage(file: File): Promise<Blob> {
  try {
    const bitmap = await decodeWithBitmap(file)
    const blob = await toJpeg(bitmap, bitmap.width, bitmap.height)
    bitmap.close()
    if (blob) return blob
  } catch {
    /* fall through to the <img> path */
  }
  const img = await decodeWithImage(file)
  const blob = await toJpeg(img, img.naturalWidth, img.naturalHeight)
  if (!blob) throw new Error('Could not process image')
  return blob
}

// Compresses and uploads an image into the user's own folder of the avatars
// bucket (the bucket every existing upload already uses, so its policies
// apply) and returns the public URL. `folder` keeps chat photos and post
// photos apart.
export async function uploadImage(
  supabase: SupabaseClient,
  userId: string,
  file: File,
  folder: 'chat' | 'posts' = 'chat',
): Promise<string> {
  const blob = await compressImage(file)
  const path = `${userId}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`
  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, blob, { contentType: 'image/jpeg', upsert: false })
  if (error) throw error
  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
}

export function uploadChatImage(supabase: SupabaseClient, userId: string, file: File): Promise<string> {
  return uploadImage(supabase, userId, file, 'chat')
}
