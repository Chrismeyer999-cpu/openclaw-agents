'use client'

import { Button } from '@/components/ui/button'
import { Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

function resolveTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  const stored = window.localStorage.getItem('theme')
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
  root.style.colorScheme = theme
}

export function DarkModeToggle() {
  const [theme, setTheme] = useState<Theme>('light')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const nextTheme = resolveTheme()
    setTheme(nextTheme)
    applyTheme(nextTheme)
    setReady(true)
  }, [])

  const toggleTheme = () => {
    const nextTheme: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(nextTheme)
    applyTheme(nextTheme)
    window.localStorage.setItem('theme', nextTheme)
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={toggleTheme}
      aria-label={theme === 'dark' ? 'Schakel naar lichte modus' : 'Schakel naar donkere modus'}
      className="h-9 border-gray-200 bg-white px-3 text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
    >
      {ready && theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
      <span className="hidden sm:inline">{ready && theme === 'dark' ? 'Licht' : 'Donker'}</span>
    </Button>
  )
}
