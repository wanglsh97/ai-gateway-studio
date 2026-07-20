'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { type ReactNode, useEffect, useRef, useState } from 'react'

import { logoutUser, sanitizeUserReturnTo } from '../lib/user-auth-client'
import { ThemeToggle } from './theme-toggle'
import { useUserSession } from './user-session-provider'

const navigation = [
  { href: '/chat', label: '聊天', description: '与模型实时对话', icon: ChatIcon },
  { href: '/image', label: '图片', description: '从文字生成图像', icon: ImageIcon },
  { href: '/skills', label: '技能', description: '查看已安装能力', icon: SparkIcon },
  { href: '/api', label: 'API', description: '接入网关能力', icon: ApiIcon },
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
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => setMobileOpen(false), [pathname])
  useEffect(() => setAvatarFailed(false), [session.user?.avatarUrl])
  useEffect(() => {
    if (!userMenuOpen) return
    function closeMenu(event: MouseEvent | KeyboardEvent) {
      if (event instanceof KeyboardEvent && event.key !== 'Escape') return
      if (event instanceof MouseEvent && userMenuRef.current?.contains(event.target as Node)) return
      setUserMenuOpen(false)
    }
    document.addEventListener('mousedown', closeMenu)
    document.addEventListener('keydown', closeMenu)
    return () => {
      document.removeEventListener('mousedown', closeMenu)
      document.removeEventListener('keydown', closeMenu)
    }
  }, [userMenuOpen])

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
        <button
            type="button"
            className="shell-icon-button"
            aria-label="打开边栏"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(true)}
          >
            <MenuIcon />
          </button>
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
          {collapsed ? (
            <button
              type="button"
              className="compact-sidebar-toggle"
              aria-label="展开边栏"
              title="展开边栏"
              onClick={() => setCollapsed(false)}
            >
              <span className="workspace-logo compact-toggle-logo"><span>AI</span></span>
              <span className="compact-toggle-icon"><CollapseIcon collapsed /></span>
            </button>
          ) : (
            <>
              <Brand />
              <button
                type="button"
                className="shell-icon-button sidebar-close"
                aria-label="关闭边栏"
                title="关闭边栏"
                onClick={() => {
                  if (window.matchMedia('(max-width: 767px)').matches) setMobileOpen(false)
                  else setCollapsed(true)
                }}
              >
                <CollapseIcon collapsed={false} />
              </button>
            </>
          )}
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

        <div className="sidebar-footer" ref={userMenuRef}>
          {session.status === 'authenticated' && session.user ? (
            <>
            {userMenuOpen && (
              <div className="user-popover" role="menu" aria-label="用户菜单">
                <ThemeToggle variant="menu" />
                <Link href="/admin" className="user-menu-item" role="menuitem" onClick={() => setUserMenuOpen(false)}>
                  <AdminIcon /><span>管理后台</span>
                </Link>
                <div className="user-menu-divider" />
                <button type="button" role="menuitem" disabled={loggingOut} onClick={() => void logout()} className="user-menu-item is-danger">
                  <LogoutIcon /><span>{loggingOut ? '正在退出…' : '退出登录'}</span>
                </button>
              </div>
            )}
            <button
              type="button"
              className="sidebar-user"
              aria-haspopup="menu"
              aria-expanded={userMenuOpen}
              onClick={() => setUserMenuOpen((open) => !open)}
            >
              <span className="sidebar-avatar">
                {session.user.avatarUrl && !avatarFailed ? (
                  <img src={session.user.avatarUrl} alt="" referrerPolicy="no-referrer" onError={() => setAvatarFailed(true)} />
                ) : session.user.githubUsername.slice(0, 2).toUpperCase()}
              </span>
              {!collapsed && (
                <div className="min-w-0 flex-1">
                  <strong className="block truncate text-sm">{session.user.githubUsername}</strong>
                  <span className="sidebar-user-hint">账户与设置</span>
                </div>
              )}
              {!collapsed && <ChevronIcon />}
            </button>
            </>
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
function ApiIcon() { return <Icon><path d="m8 9-3 3 3 3M16 9l3 3-3 3M14 5l-4 14"/></Icon> }
function UserIcon() { return <Icon><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></Icon> }
function MenuIcon() { return <Icon><path d="M4 7h16M4 12h16M4 17h16"/></Icon> }
function AdminIcon() { return <Icon><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 20V9"/></Icon> }
function LogoutIcon() { return <Icon><path d="M10 17l5-5-5-5M15 12H3"/><path d="M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5"/></Icon> }
function ChevronIcon() { return <Icon><path d="m9 15 3-3-3-3"/></Icon> }
function CollapseIcon({ collapsed }: Readonly<{ collapsed: boolean }>) { return <Icon><path d="M9 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M14 8l-4 4 4 4M10 12h11" className={collapsed ? 'origin-center rotate-180' : ''}/></Icon> }
