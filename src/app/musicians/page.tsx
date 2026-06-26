'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ForMusiciansPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/explore')
  }, [router])

  return (
    <div style={{ minHeight: '100dvh', background: '#08080F', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[rgba(240,239,235,0.12)] border-t-[#FF5500]" />
    </div>
  )
}
