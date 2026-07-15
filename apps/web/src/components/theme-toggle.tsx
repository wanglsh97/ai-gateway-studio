'use client'

import { useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  document.documentElement.style.colorScheme = theme
  localStorage.setItem('aigateway-theme', theme)
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null)

  useEffect(() => {
    setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light')
  }, [])

  const nextTheme = theme === 'dark' ? 'light' : 'dark'

  return (
    <button
      type="button"
      className="order-2 grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white/75 text-slate-600 shadow-sm transition hover:-translate-y-0.5 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500 sm:order-3 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:text-white"
      aria-label={`切换到${nextTheme === 'dark' ? '暗色' : '亮色'}主题`}
      title={`切换到${nextTheme === 'dark' ? '暗色' : '亮色'}主题`}
      onClick={() => {
        applyTheme(nextTheme)
        setTheme(nextTheme)
      }}
    >
      <span aria-hidden="true" className="text-base leading-none">
        {theme === 'dark' ? '☼' : '◐'}
      </span>
    </button>
  )
}
