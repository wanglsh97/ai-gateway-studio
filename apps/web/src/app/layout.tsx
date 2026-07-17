import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import { SiteHeader } from '../components/site-header'

import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'AI Gateway Studio',
    template: '%s · AI Gateway Studio',
  },
  description: '统一体验 Chat、文生图与 Prompt 优化能力',
}

const themeScript = `
  try {
    const storedTheme = localStorage.getItem('aigateway-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = storedTheme === 'light' || storedTheme === 'dark'
      ? storedTheme
      : prefersDark ? 'dark' : 'light';
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.style.colorScheme = theme;
  } catch {}
`

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="zh-CN" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body suppressHydrationWarning>
        <SiteHeader />
        {children}
      </body>
    </html>
  )
}
