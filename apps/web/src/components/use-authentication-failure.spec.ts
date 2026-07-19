import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { isUserAuthenticationFailure } from './use-authentication-failure'

describe('user authentication failure handling', () => {
  it('redirects only typed 401 authentication failures', () => {
    assert.equal(
      isUserAuthenticationFailure(
        Object.assign(new Error('expired'), {
          name: 'AIGatewayAuthenticationError',
          status: 401,
          code: 'UNAUTHORIZED',
        }),
      ),
      true,
    )
    assert.equal(
      isUserAuthenticationFailure(
        Object.assign(new Error('limited'), {
          name: 'AIGatewayError',
          status: 429,
          code: 'RATE_LIMITED',
        }),
      ),
      false,
    )
  })
})
