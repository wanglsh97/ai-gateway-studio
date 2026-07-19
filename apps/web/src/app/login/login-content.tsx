'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

import { useUserSession } from '../../components/user-session-provider'
import {
  githubLoginUrl,
  sanitizeUserReturnTo,
  userLoginErrorMessage,
} from '../../lib/user-auth-client'

const destinations = [
  { name: 'Chat', detail: 'STREAM', color: 'violet' },
  { name: 'Image', detail: 'CREATE', color: 'coral' },
  { name: 'Prompt', detail: 'REFINE', color: 'mint' },
]

function IdentityRelay() {
  return (
    <div className="login-relay" aria-label="One GitHub identity connects to three AI tools">
      <div className="login-relay-head">
        <span>IDENTITY RELAY</span>
        <span className="login-relay-live">
          <i /> READY
        </span>
      </div>

      <div className="login-relay-stage">
        <div className="login-identity-node">
          <span className="login-identity-orbit" aria-hidden="true" />
          <strong>GH</strong>
          <small>YOUR IDENTITY</small>
        </div>

        <div className="login-relay-line" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>

        <div className="login-destinations">
          {destinations.map((destination) => (
            <div className="login-destination" key={destination.name}>
              <i className={`login-destination-${destination.color}`} />
              <span>{destination.name}</span>
              <small>{destination.detail}</small>
            </div>
          ))}
        </div>
      </div>

      <div className="login-relay-foot">
        <span>ONE SIGN-IN</span>
        <span>THREE TOOLS</span>
        <span>FREE ACCESS</span>
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
    <main className="login-page">
      <div className="login-layout">
        <div className="login-story">
          <p className="login-kicker">AI GATEWAY / ACCESS</p>
          <h1>
            One identity.
            <br />
            <span>Every capability.</span>
          </h1>
          <p>
            Bring your GitHub identity. We&apos;ll open the route to every AI tool in the studio.
          </p>
          <IdentityRelay />
        </div>

        <section className="login-card" aria-labelledby="login-title">
          <div className="login-card-index">ACCESS / 01</div>
          <div className="login-card-mark" aria-hidden="true">
            GH
          </div>
          <p className="login-card-eyebrow">USER SIGN IN</p>
          <h2 id="login-title">Continue with GitHub</h2>
          <p className="login-card-description">Sign in once. Use every tool for free.</p>

          {errorMessage && (
            <div role="alert" className="login-error">
              {errorMessage}
            </div>
          )}

          <a
            href={githubLoginUrl(returnTo)}
            aria-disabled={leaving}
            onClick={() => setLeaving(true)}
            className={`login-github-action ${leaving ? 'login-github-action-disabled' : ''}`}
          >
            <span>
              {leaving
                ? 'Opening GitHub…'
                : errorMessage
                  ? 'Try GitHub again'
                  : 'Continue with GitHub'}
            </span>
            <span aria-hidden="true">↗</span>
          </a>

          <div className="login-card-meta">
            <span>SECURE OAUTH</span>
            <span>NO PASSWORD STORED</span>
          </div>

          <Link className="login-back-link" href="/">
            ← Back to home
          </Link>
        </section>
      </div>
    </main>
  )
}
