'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { Volume2, VolumeX } from 'lucide-react'

const TARGET_VOL = 0.20
const FADE_STEP   = 0.01
const FADE_MS     = 75

function isActive(p: string) { return p === '/' || p === '/login' || p.startsWith('/onboarding') }
function isStop(p: string)   { return !isActive(p) }

export default function AmbientAudio() {
  const pathname   = usePathname()
  const pathRef    = useRef(pathname)
  const audioRef   = useRef<HTMLAudioElement | null>(null)
  const playingRef = useRef(false)
  const [muted, setMuted]     = useState(false)
  const mutedRef              = useRef(false)

  useEffect(() => { pathRef.current = pathname },  [pathname])
  useEffect(() => { mutedRef.current = muted },    [muted])

  // Create Audio element once on mount, try autoplay immediately
  useEffect(() => {
    const audio = new Audio('/boarding-music.mp3')
    audio.loop   = true
    audio.volume = 0
    audioRef.current = audio

    function fadeIn() {
      playingRef.current = true
      const id = setInterval(() => {
        if (!audioRef.current) { clearInterval(id); return }
        const target = mutedRef.current ? 0 : TARGET_VOL
        if (audioRef.current.volume < target - FADE_STEP) {
          audioRef.current.volume = Math.min(target, audioRef.current.volume + FADE_STEP)
        } else {
          audioRef.current.volume = target
          clearInterval(id)
        }
      }, FADE_MS)
    }

    // Only try to play on active routes
    if (isActive(pathRef.current)) {
      const p = audio.play()
      if (p !== undefined) {
        p.then(() => {
          fadeIn()
        }).catch(() => {
          // Autoplay blocked — unlock on first interaction
          const unlock = () => {
            if (!audioRef.current) return
            audioRef.current.play().then(() => {
              fadeIn()
            }).catch(() => {})
            document.removeEventListener('click',      unlock)
            document.removeEventListener('touchstart', unlock)
            document.removeEventListener('keydown',    unlock)
          }
          document.addEventListener('click',      unlock, { passive: true })
          document.addEventListener('touchstart', unlock, { passive: true })
          document.addEventListener('keydown',    unlock, { passive: true })
        })
      }
    }

    return () => { audio.pause(); audio.src = '' }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Fade helpers
  function fadeOut(ms = 1500) {
    const audio = audioRef.current
    if (!audio || !playingRef.current) return
    const startVol = audio.volume
    const steps    = Math.max(1, Math.ceil(ms / FADE_MS))
    const step     = startVol / steps
    const id = setInterval(() => {
      if (!audioRef.current) { clearInterval(id); return }
      if (audioRef.current.volume > step) {
        audioRef.current.volume = Math.max(0, audioRef.current.volume - step)
      } else {
        audioRef.current.volume = 0
        audioRef.current.pause()
        playingRef.current = false
        clearInterval(id)
      }
    }, FADE_MS)
  }

  function fadeToTarget(target: number) {
    const audio = audioRef.current
    if (!audio) return
    const up = target > audio.volume
    const id = setInterval(() => {
      if (!audioRef.current) { clearInterval(id); return }
      if (up) {
        if (audioRef.current.volume < target - FADE_STEP) {
          audioRef.current.volume = Math.min(target, audioRef.current.volume + FADE_STEP)
        } else { audioRef.current.volume = target; clearInterval(id) }
      } else {
        if (audioRef.current.volume > FADE_STEP) {
          audioRef.current.volume = Math.max(0, audioRef.current.volume - FADE_STEP)
        } else { audioRef.current.volume = 0; clearInterval(id) }
      }
    }, FADE_MS)
  }

  // Sync audio with route changes
  useEffect(() => {
    if (isStop(pathname)) {
      fadeOut(1500)
    } else if (isActive(pathname) && !playingRef.current && audioRef.current) {
      audioRef.current.play().then(() => {
        playingRef.current = true
        fadeToTarget(mutedRef.current ? 0 : TARGET_VOL)
      }).catch(() => {})
    }
  }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  // Bloom sync — fade out in 1800ms when onboarding completes
  useEffect(() => {
    function onStep(e: Event) {
      const { step } = (e as CustomEvent<{ step: number | 'complete' }>).detail
      if (step === 'complete') fadeOut(1800)
    }
    window.addEventListener('sondar-step', onStep)
    return () => window.removeEventListener('sondar-step', onStep)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function toggleMute() {
    const next = !muted
    setMuted(next)
    fadeToTarget(next ? 0 : TARGET_VOL)
  }

  if (!isActive(pathname)) return null

  const onboarding = pathname.startsWith('/onboarding')
  const bottom = onboarding
    ? 'calc(80px + env(safe-area-inset-bottom, 0px))'
    : '20px'

  return (
    <motion.button
      initial={{ opacity: 0.5 }}
      animate={{ opacity: 0.5 }}
      whileHover={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      onClick={toggleMute}
      aria-label={muted ? 'Unmute ambient audio' : 'Mute ambient audio'}
      className="fixed z-[150] flex items-center justify-center"
      style={{ bottom, right: 20, width: 44, height: 44 }}
    >
      <span
        className="flex h-9 w-9 items-center justify-center rounded-full"
        style={{
          background: 'rgba(13,13,13,0.65)',
          border: '1px solid rgba(240,239,235,0.12)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        }}
      >
        {muted
          ? <VolumeX size={16} color="rgba(240,239,235,0.6)" />
          : <Volume2 size={16} color="rgba(240,239,235,0.6)" />
        }
      </span>
    </motion.button>
  )
}
