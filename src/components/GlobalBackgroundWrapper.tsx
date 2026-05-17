'use client'

import { Component, ReactNode } from 'react'
import GlobalBackground from './GlobalBackground'

interface State { hasError: boolean }

class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() { return { hasError: true } }
  render() {
    if (this.state.hasError) return null
    return this.props.children
  }
}

export default function GlobalBackgroundWrapper() {
  return (
    <ErrorBoundary>
      <GlobalBackground />
    </ErrorBoundary>
  )
}
