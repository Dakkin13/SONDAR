'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

function urlBase64ToUint8Array(base64: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(b64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out.buffer as ArrayBuffer
}

export function usePushNotifications(userId: string | null) {
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [supported, setSupported] = useState(false)
  const [subscribed, setSubscribed] = useState(false)

  useEffect(() => {
    const ok = typeof window !== 'undefined'
      && 'Notification' in window
      && 'serviceWorker' in navigator
      && 'PushManager' in window
    setSupported(ok)
    if (ok) setPermission(Notification.permission)
  }, [])

  async function requestAndSubscribe() {
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!supported || !userId || !vapidKey) return

    const perm = await Notification.requestPermission()
    setPermission(perm)
    if (perm !== 'granted') return

    try {
      const reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready

      const existing = await reg.pushManager.getSubscription()
      const sub = existing ?? await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      })

      const supabase = createClient()
      await supabase.from('push_subscriptions').upsert(
        { user_id: userId, subscription: JSON.stringify(sub) },
        { onConflict: 'user_id' }
      )
      setSubscribed(true)
    } catch (err) {
      console.error('Push subscription failed:', err)
    }
  }

  return { supported, permission, subscribed, requestAndSubscribe }
}
