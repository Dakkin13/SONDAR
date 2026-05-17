import type { Metadata, Viewport } from 'next'
import { Bebas_Neue, DM_Sans } from 'next/font/google'
import './globals.css'
import GlobalBackgroundWrapper from '@/components/GlobalBackgroundWrapper'
import AmbientAudioWrapper from '@/components/AmbientAudioWrapper'
import { ToastProvider } from '@/components/ui/Toast'

const bebasNeue = Bebas_Neue({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-bebas',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
})

export const metadata: Metadata = {
  title: 'Sondar',
  description: 'Find your people. Make noise.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Sondar',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#0D0D0D',
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${bebasNeue.variable} ${dmSans.variable} h-full`}
    >
      <head>
        <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
      </head>
      <body className="min-h-full antialiased" style={{ fontFamily: 'var(--font-dm-sans)' }}>
        {/* SVG filter for liquid-glass displacement — referenced by CSS filter: url(#liquid-glass-filter) */}
        <svg style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }} aria-hidden="true">
          <defs>
            <filter id="liquid-glass-filter" x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
              <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" seed="2" stitchTiles="stitch" result="noise" />
              <feDisplacementMap in="SourceGraphic" in2="noise" scale="3" xChannelSelector="R" yChannelSelector="G" result="displaced" />
              <feComposite in="displaced" in2="SourceGraphic" operator="in" />
            </filter>
          </defs>
        </svg>
        <GlobalBackgroundWrapper />
        <AmbientAudioWrapper />
        <ToastProvider>
          <div style={{ position: 'relative', zIndex: 1, minHeight: '100dvh', overflowX: 'clip' }}>
            {children}
          </div>
        </ToastProvider>
      </body>
    </html>
  )
}
