export const USER_RETURN_PATHS = ['/chat', '/chat/compare', '/image', '/prompt'] as const

export function sanitizeUserReturnTo(value: string | null | undefined): string {
  return value && USER_RETURN_PATHS.includes(value as (typeof USER_RETURN_PATHS)[number])
    ? value
    : '/chat'
}

export function githubLoginUrl(returnTo: string | null | undefined): string {
  return `/api/v1/auth/github?returnTo=${encodeURIComponent(sanitizeUserReturnTo(returnTo))}`
}

export function userLoginErrorMessage(error: string | null): string {
  if (error === 'authorization_rejected') return '你取消了 GitHub 授权，可以重新尝试登录。'
  if (error === 'oauth_failed') return 'GitHub 登录未完成，请检查网络后重试。'
  return error ? '登录请求已失效，请重新发起 GitHub 登录。' : ''
}
