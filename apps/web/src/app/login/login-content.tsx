'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

import { useUserSession } from '../../components/user-session-provider'
import { cn } from '../../lib/cn'
import {
  githubLoginUrl,
  sanitizeUserReturnTo,
  userLoginErrorMessage,
} from '../../lib/user-auth-client'

const destinations = [
  { name: 'Chat', detail: 'STREAM', dotClass: 'bg-brand' },
  { name: 'Image', detail: 'CREATE', dotClass: 'bg-coral' },
  { name: 'Prompt', detail: 'REFINE', dotClass: 'bg-mint' },
]

const focusRing =
  'focus-visible:outline-3 focus-visible:outline-brand focus-visible:outline-offset-4'

function IdentityRelay() {
  return (
    <div
      className="mt-10 overflow-hidden rounded-xl border border-console-border bg-console text-[#f7f3ff] shadow-[0_24px_60px_rgb(33_27_50/0.16)]"
      aria-label="One GitHub identity connects to three AI tools"
    >
      <div className="flex items-center justify-between border-b border-console-border px-4 py-3 font-mono text-[0.54rem] font-bold tracking-widest text-[#8f849f]">
        <span>IDENTITY RELAY</span>
        <span className="flex items-center gap-2">
          <i className="size-1.5 rounded-full bg-mint shadow-[0_0_8px_#53d6bd]" />
          READY
        </span>
      </div>

      <div className="relative grid min-h-60 grid-cols-[1fr_1.35fr] items-center bg-[linear-gradient(rgb(255_255_255/0.035)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/0.035)_1px,transparent_1px)] bg-size-[28px_28px] p-8 max-sm:min-h-52 max-sm:p-5">
        <div className="relative z-2 grid size-24 place-items-center justify-self-center rounded-full border border-[#7964d8] bg-[#211a36] max-sm:size-[4.7rem]">
          <span className="absolute inset-[-0.7rem] animate-login-orbit rounded-full border border-dashed border-[#55466e]" aria-hidden="true" />
          <strong className="font-display text-xl">GH</strong>
          <small className="absolute top-[calc(100%+0.8rem)] font-mono text-[0.5rem] tracking-widest text-[#8f849f]">
            YOUR IDENTITY
          </small>
        </div>

        <div className="pointer-events-none absolute top-1/2 left-[31%] z-1 h-[5.8rem] w-[24%] -translate-y-1/2 border-t border-r border-[#55466e] max-sm:left-[28%]">
          <span className="absolute top-0 right-[-24%] h-px w-[24%] bg-[#55466e]" />
          <span className="absolute top-1/2 right-[-24%] h-px w-[24%] bg-[#55466e]" />
          <span className="absolute bottom-0 right-[-24%] h-px w-[24%] bg-[#55466e]" />
        </div>

        <div className="relative z-2 grid gap-2">
          {destinations.map((destination) => (
            <div
              key={destination.name}
              className="grid min-h-[2.9rem] grid-cols-[auto_1fr_auto] items-center gap-2.5 rounded-md border border-[#403654] bg-[rgb(32_26_49/0.94)] px-3 text-[0.68rem]"
            >
              <i className={cn('size-1.5 rounded-full', destination.dotClass)} />
              <span>{destination.name}</span>
              <small className="font-mono text-[0.5rem] text-[#817591]">{destination.detail}</small>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-console-border px-4 py-3 font-mono text-[0.54rem] font-bold tracking-widest text-[#8f849f]">
        <span className="before:text-[#8c75ef] before:content-['/ ']">ONE SIGN-IN</span>
        <span className="before:text-[#8c75ef] before:content-['/ ']">THREE TOOLS</span>
        <span className="before:text-[#8c75ef] before:content-['/ ']">FREE ACCESS</span>
      </div>
    </div>
  )
}

export function LoginContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const session = useUserSession()
  const [leaving, setLeaving] = useState(false)
  const returnTo = sanitizeUserReturnTo(searchParams.get('returnTo'))
  const errorMessage = userLoginErrorMessage(searchParams.get('error'))

  useEffect(() => {
    if (session.status === 'authenticated') router.replace(returnTo)
  }, [returnTo, router, session.status])

  return (
    <main className="min-h-[calc(100svh-65px)] bg-[radial-gradient(circle_at_18%_22%,rgb(112_87_232/0.09),transparent_24rem)] px-6 py-12 md:px-10 md:py-[6.5rem]">
      <div className="mx-auto grid max-w-[72rem] grid-cols-1 items-center gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:gap-32">
        <div className="min-w-0 max-lg:order-2">
          <p className="font-mono text-[0.62rem] font-bold tracking-[0.13em] text-[#7b718a]">AI GATEWAY / ACCESS</p>
          <h1 className="mt-5 font-display text-[clamp(3rem,6vw,5.6rem)] leading-[0.98] font-black tracking-tight text-ink">
            One identity.
            <br />
            <span className="text-brand">Every capability.</span>
          </h1>
          <p className="mt-5 max-w-[35rem] text-sm leading-relaxed text-ink-muted max-lg:hidden">
            Bring your GitHub identity. We&apos;ll open the route to every AI tool in the studio.
          </p>
          <div className="max-lg:hidden">
            <IdentityRelay />
          </div>
        </div>

        <section
          className="relative overflow-hidden rounded-xl border border-line bg-surface-card/82 p-8 shadow-[0_26px_75px_rgb(33_27_50/0.12)] backdrop-blur-lg max-lg:order-1 md:p-12 dark:border-console-border dark:bg-[rgb(23_18_37/0.88)]"
          aria-labelledby="login-title"
        >
          <div className="pointer-events-none absolute top-0 right-0 size-[4.5rem] border-b border-l border-line bg-brand-subtle [clip-path:polygon(100%_0,100%_100%,0_0)] dark:border-[#403654] dark:bg-brand-subtle" />
          <div className="absolute top-4 right-4 z-1 font-mono text-[0.5rem] tracking-widest text-ink-subtle">ACCESS / 01</div>
          <div className="grid size-14 place-items-center rounded-full bg-ink font-display text-sm text-white dark:bg-[#f7f3ff] dark:text-ink" aria-hidden="true">
            GH
          </div>
          <p className="mt-8 font-mono text-[0.62rem] font-bold tracking-[0.13em] text-brand">USER SIGN IN</p>
          <h2 id="login-title" className="mt-3 text-[clamp(2rem,3vw,2.8rem)] leading-tight tracking-tight text-ink">
            Continue with GitHub
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-ink-muted">Sign in once. Use every tool for free.</p>

          {errorMessage && (
            <div role="alert" className="mt-5 rounded-md border border-[#f2b8aa] bg-[#fff0ec] px-4 py-3 text-xs leading-relaxed text-[#a73c29] dark:border-[#6b3a36] dark:bg-[#321d21] dark:text-[#ffb5a5]">
              {errorMessage}
            </div>
          )}

          <a
            href={githubLoginUrl(returnTo)}
            aria-disabled={leaving}
            onClick={() => setLeaving(true)}
            className={cn(
              'mt-8 flex min-h-14 items-center justify-center gap-3 rounded-md bg-ink px-5 text-sm font-bold text-white transition-[transform,background] hover:-translate-y-0.5 hover:bg-[#302645] dark:bg-[#f7f3ff] dark:text-ink',
              leaving && 'pointer-events-none opacity-60',
              focusRing,
            )}
          >
            <svg className="size-[1.125rem] shrink-0" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path
                fill="currentColor"
                d="M12 .7a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2.24c-3.22.7-3.9-1.37-3.9-1.37-.52-1.34-1.28-1.7-1.28-1.7-1.05-.72.08-.71.08-.71 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.57-.29-5.27-1.29-5.27-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.47.11-3.05 0 0 .97-.31 3.16 1.18A11 11 0 0 1 12 6.08c.98 0 1.95.13 2.86.38 2.2-1.49 3.16-1.18 3.16-1.18.63 1.58.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.4-2.71 5.38-5.29 5.67.42.36.79 1.06.79 2.14v3.32c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .7Z"
              />
            </svg>
            <span>
              {leaving ? 'OPENING GITHUB…' : errorMessage ? 'TRY GITHUB AGAIN' : 'CONTINUE WITH GITHUB'}
            </span>
          </a>

          <div className="mt-4 flex justify-between gap-4 font-mono text-[0.48rem] tracking-wide text-[#8f849f] max-sm:flex-col max-sm:gap-1.5">
            <span>SECURE OAUTH</span>
            <span>NO PASSWORD STORED</span>
          </div>

          <Link className="mt-10 inline-block text-xs font-semibold text-ink-muted hover:text-brand" href="/">
            ← Back to home
          </Link>
        </section>

        <div className="lg:hidden max-lg:order-3">
          <IdentityRelay />
        </div>
      </div>
    </main>
  )
}
