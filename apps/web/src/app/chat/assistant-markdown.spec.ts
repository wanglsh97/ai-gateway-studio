import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { AssistantMarkdown, safeMarkdownUrl } from './assistant-markdown'

describe('AssistantMarkdown security', () => {
  it('allows safe web, mail and relative links', () => {
    assert.equal(safeMarkdownUrl('https://example.com/path'), 'https://example.com/path')
    assert.equal(safeMarkdownUrl('mailto:test@example.com'), 'mailto:test@example.com')
    assert.equal(safeMarkdownUrl('/docs'), '/docs')
  })

  it('rejects dangerous protocols including whitespace-obfuscated values', () => {
    for (const value of [
      'javascript:alert(1)',
      'java\nscript:alert(1)',
      'data:text/html;base64,PHNjcmlwdD4=',
      'vbscript:msgbox(1)',
      'file:///etc/passwd',
    ]) {
      assert.equal(safeMarkdownUrl(value), '')
    }
  })

  it('drops raw HTML and images while rendering safe Markdown elements', () => {
    const markup = renderToStaticMarkup(
      createElement(
        AssistantMarkdown,
        null,
        '# 标题\n\n**加粗** <script>alert(1)</script>\n\n![tracker](https://evil.test/a.png)\n\n[危险](javascript:alert(1))',
      ),
    )

    assert.match(markup, /<h1>标题<\/h1>/)
    assert.match(markup, /<strong>加粗<\/strong>/)
    assert.doesNotMatch(markup, /<script|<img|javascript:/i)
  })
})
