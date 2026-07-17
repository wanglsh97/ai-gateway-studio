import React from 'react'
import type { ComponentProps } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const allowedElements = [
  'p',
  'br',
  'strong',
  'em',
  'del',
  'a',
  'blockquote',
  'ul',
  'ol',
  'li',
  'pre',
  'code',
  'hr',
  'h1',
  'h2',
  'h3',
  'h4',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
] as const

export function AssistantMarkdown({ children }: { children: string }) {
  return (
    <div className="space-y-3 break-words [&_a]:text-cyan-700 [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-slate-300 [&_blockquote]:pl-3 [&_code]:rounded [&_code]:bg-slate-200/70 [&_code]:px-1 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-slate-950 [&_pre]:p-4 [&_pre]:text-slate-100 [&_table]:block [&_table]:overflow-x-auto [&_td]:border [&_td]:border-slate-200 [&_td]:p-2 [&_th]:border [&_th]:border-slate-200 [&_th]:p-2 dark:[&_a]:text-cyan-300 dark:[&_code]:bg-white/10 dark:[&_td]:border-white/10 dark:[&_th]:border-white/10">
      <Markdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        allowedElements={[...allowedElements]}
        unwrapDisallowed
        urlTransform={safeMarkdownUrl}
        components={{ a: SafeLink }}
      >
        {children}
      </Markdown>
    </div>
  )
}

function SafeLink({ href, children, ...props }: ComponentProps<'a'>) {
  return (
    <a {...props} href={href} target="_blank" rel="noreferrer noopener">
      {children}
    </a>
  )
}

export function safeMarkdownUrl(value: string): string {
  const normalized = [...value.trim()]
    .filter((character) => {
      const code = character.charCodeAt(0)
      return code > 31 && code !== 127 && !/\s/.test(character)
    })
    .join('')
  const protocol = /^([a-z][a-z\d+.-]*):/i.exec(normalized)?.[1]?.toLowerCase()
  if (protocol && !['http', 'https', 'mailto'].includes(protocol)) return ''
  return value
}
