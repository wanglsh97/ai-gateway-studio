'use client'

import { useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  document.documentElement.style.colorScheme = theme
  localStorage.setItem('aigateway-theme', theme)
}

export function ThemeToggle({ variant = 'icon' }: Readonly<{ variant?: 'icon' | 'menu' }>) {
  const [theme, setTheme] = useState<Theme | null>(null)

  useEffect(() => {
    setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light')
  }, [])

  const nextTheme = theme === 'dark' ? 'light' : 'dark'

  return (
    <button
      type="button"
      className={variant === 'menu' ? 'user-menu-item' : 'grid h-9 w-9 place-items-center rounded-md border border-[#ded9e8] bg-white/75 text-[#70677f] shadow-sm transition hover:-translate-y-0.5 hover:border-[#7057e8] hover:text-[#7057e8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7057e8] dark:border-[#302943] dark:bg-white/5 dark:text-slate-300 dark:hover:text-white'}
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
      {variant === 'menu' && <span>切换主题</span>}
    </button>
  )
}
