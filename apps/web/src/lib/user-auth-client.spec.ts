import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { githubLoginUrl, sanitizeUserReturnTo, userLoginErrorMessage } from './user-auth-client'

describe('user auth login helpers', () => {
  it('allows only explicit same-origin capability paths', () => {
    assert.equal(sanitizeUserReturnTo('/image'), '/image')
    for (const unsafe of ['https://attacker.example', '//attacker.example', '/admin', '/chat?next=x']) {
      assert.equal(sanitizeUserReturnTo(unsafe), '/chat')
    }
    assert.equal(githubLoginUrl('/prompt'), '/api/v1/auth/github?returnTo=%2Fprompt')
  })

  it('maps callback errors without exposing provider details', () => {
    assert.match(userLoginErrorMessage('authorization_rejected'), /取消/)
    assert.match(userLoginErrorMessage('oauth_failed'), /未完成/)
    assert.equal(userLoginErrorMessage(null), '')
  })
})
