import type { TextModelAlias } from '@aigateway/sdk'

export interface ChatProviderBranding {
  /** 厂商 Logo 的静态资源地址；留空时展示 fallbackText。 */
  logoUrl: string | null
  fallbackText: string
}

/**
 * Chat 模型厂商视觉配置的唯一入口。
 *
 * 替换其他厂商 Logo 时，只需要填写对应的 logoUrl。
 */
export const CHAT_PROVIDER_BRANDING = {
  qwen: {
    logoUrl:
      'https://assets.alicdn.com/g/qwenweb/qwen-chat-fe/0.2.74/static/images/ms-icon-light-150x150.png',
    fallbackText: 'Q',
  },
  glm: {
    logoUrl: null,
    fallbackText: '智',
  },
  deepseek: {
    logoUrl: null,
    fallbackText: 'DS',
  },
  kimi: {
    logoUrl: null,
    fallbackText: 'K',
  },
} satisfies Record<TextModelAlias, ChatProviderBranding>
