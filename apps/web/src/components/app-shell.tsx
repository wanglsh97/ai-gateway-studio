'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { type ReactNode, useEffect, useState } from 'react'

import { logoutUser, sanitizeUserReturnTo } from '../lib/user-auth-client'
import { ThemeToggle } from './theme-toggle'
import { useUserSession } from './user-session-provider'

const navigation = [
  { href: '/chat', label: '聊天', description: '与模型实时对话', icon: ChatIcon },
  { href: '/image', label: '图片', description: '从文字生成图像', icon: ImageIcon },
  { href: '/skills', label: '技能', description: '查看已安装能力', icon: SparkIcon },
]

export function AppShell({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname()
  const isStandalone = pathname.startsWith('/admin')

  if (isStandalone) return children
  return <UserWorkspace>{children}</UserWorkspace>
}

function UserWorkspace({ children }: Readonly<{ children: ReactNode }>) {
  const router = useRouter()
  const pathname = usePathname()
  const session = useUserSession()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [avatarFailed, setAvatarFailed] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => setMobileOpen(false), [pathname])
  useEffect(() => setAvatarFailed(false), [session.user?.avatarUrl])

  async function logout() {
    if (loggingOut) return
    setLoggingOut(true)
    try {
      await logoutUser()
    } finally {
      session.clear()
      router.replace(`/login?returnTo=${encodeURIComponent(sanitizeUserReturnTo(pathname))}`)
      router.refresh()
      setLoggingOut(false)
    }
  }

  return (
    <div className="workspace-shell">
      <header className="mobile-workspace-bar">
        <Brand />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            type="button"
            className="shell-icon-button"
            aria-label="打开边栏"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(true)}
          >
            <MenuIcon />
          </button>
        </div>
      </header>

      {mobileOpen && (
        <button
          type="button"
          className="sidebar-scrim"
          aria-label="关闭边栏"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside className={`workspace-sidebar ${collapsed ? 'is-collapsed' : ''} ${mobileOpen ? 'is-open' : ''}`}>
        <div className="sidebar-brand-row">
          <Brand compact={collapsed} />
          <button
            type="button"
            className="shell-icon-button sidebar-close"
            aria-label={collapsed ? '展开边栏' : '关闭边栏'}
            title={collapsed ? '展开边栏' : '关闭边栏'}
            onClick={() => {
              if (window.matchMedia('(max-width: 767px)').matches) setMobileOpen(false)
              else setCollapsed((value) => !value)
            }}
          >
            <CollapseIcon collapsed={collapsed} />
          </button>
        </div>

        <nav className="sidebar-navigation" aria-label="功能菜单">
          {!collapsed && <p className="sidebar-section-label">功能</p>}
          {navigation.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`sidebar-nav-item ${active ? 'is-active' : ''}`}
                aria-current={active ? 'page' : undefined}
                title={collapsed ? item.label : undefined}
              >
                <span className="sidebar-nav-icon"><Icon /></span>
                {!collapsed && (
                  <span className="min-w-0">
                    <strong>{item.label}</strong>
                    <small>{item.description}</small>
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        <div className="sidebar-footer">
          {!collapsed && <ThemeToggle />}
          {session.status === 'authenticated' && session.user ? (
            <div className="sidebar-user">
              <span className="sidebar-avatar">
                {session.user.avatarUrl && !avatarFailed ? (
                  <img src={session.user.avatarUrl} alt="" referrerPolicy="no-referrer" onError={() => setAvatarFailed(true)} />
                ) : session.user.githubUsername.slice(0, 2).toUpperCase()}
              </span>
              {!collapsed && (
                <div className="min-w-0 flex-1">
                  <strong className="block truncate text-sm">{session.user.githubUsername}</strong>
                  <button type="button" disabled={loggingOut} onClick={() => void logout()} className="sidebar-logout">
                    {loggingOut ? '正在退出…' : '退出登录'}
                  </button>
                </div>
              )}
            </div>
          ) : session.status === 'unauthenticated' ? (
            <Link className="sidebar-login" href={`/login?returnTo=${encodeURIComponent(sanitizeUserReturnTo(pathname))}`}>
              <span className="sidebar-avatar"><UserIcon /></span>
              {!collapsed && <span>使用 GitHub 登录</span>}
            </Link>
          ) : (
            <div className="sidebar-user" aria-label="正在加载用户信息">
              <span className="sidebar-avatar animate-pulse" />
              {!collapsed && <span className="h-3 w-24 animate-pulse rounded bg-slate-200 dark:bg-white/10" />}
            </div>
          )}
        </div>
      </aside>

      <div className={`workspace-content ${collapsed ? 'sidebar-collapsed' : ''}`}>{children}</div>
    </div>
  )
}

function Brand({ compact = false }: Readonly<{ compact?: boolean }>) {
  return (
    <Link href="/" className="workspace-brand" aria-label="AI Gateway 首页">
      <span className="workspace-logo"><span>AI</span></span>
      {!compact && <span className="workspace-brand-name">AI Gateway</span>}
    </Link>
  )
}

type SvgProps = Readonly<{ children?: ReactNode; className?: string }>
function Icon({ children }: SvgProps) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
}
function ChatIcon() { return <Icon><path d="M7 8h10M7 12h7"/><path d="M20 15a3 3 0 0 1-3 3H9l-5 3v-6a3 3 0 0 1-1-2V6a3 3 0 0 1 3-3h11a3 3 0 0 1 3 3Z"/></Icon> }
function ImageIcon() { return <Icon><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="9" r="2"/><path d="m4 17 4.5-4 3.5 3 3-2.5 5 4.5"/></Icon> }
function SparkIcon() { return <Icon><path d="m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2L12 3Z"/><path d="m18 14 .8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8L18 14ZM5 13l.7 1.8 1.8.7-1.8.7L5 18l-.7-1.8-1.8-.7 1.8-.7L5 13Z"/></Icon> }
function UserIcon() { return <Icon><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></Icon> }
function MenuIcon() { return <Icon><path d="M4 7h16M4 12h16M4 17h16"/></Icon> }
function CollapseIcon({ collapsed }: Readonly<{ collapsed: boolean }>) { return <Icon><path d="M9 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M14 8l-4 4 4 4M10 12h11" className={collapsed ? 'origin-center rotate-180' : ''}/></Icon> }
