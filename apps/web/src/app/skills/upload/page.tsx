'use client'

import { createAIGatewayClient } from '@aigateway/sdk'
import type { SkillUploadProgress } from '@aigateway/sdk'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

import { ProtectedUserPage } from '../../../components/protected-user-page'
import { useAuthenticationFailure } from '../../../components/use-authentication-failure'
import { cn } from '../../../lib/cn'
import { prepareSkillFolder, type PreparedSkillFolder } from './skill-folder-package'
import {
  formatFileSize,
  SKILL_CATEGORIES,
  SKILL_DESCRIPTION_MAX_LENGTH,
  SKILL_TITLE_MAX_LENGTH,
  validateSkillMetadata,
  type SkillCategory,
} from './skill-upload-form'

const client = createAIGatewayClient()
const folderPickerAttributes = {
  directory: '',
  webkitdirectory: '',
} as unknown as React.InputHTMLAttributes<HTMLInputElement>

type UploadState = 'idle' | 'preparing' | 'ready' | 'uploading' | 'submitting' | 'submitted'

export default function SkillUploadPage() {
  return (
    <ProtectedUserPage>
      <SkillUploadForm />
    </ProtectedUserPage>
  )
}

function SkillUploadForm() {
  const handleAuthenticationFailure = useAuthenticationFailure()
  const folderInputRef = useRef<HTMLInputElement | null>(null)
  const activeUploadRef = useRef<AbortController | null>(null)
  const [prepared, setPrepared] = useState<PreparedSkillFolder | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<SkillCategory>('development')
  const [state, setState] = useState<UploadState>('idle')
  const [progress, setProgress] = useState<SkillUploadProgress | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [uploadError, setUploadError] = useState('')
  const [finalizedSessionId, setFinalizedSessionId] = useState('')

  useEffect(() => () => activeUploadRef.current?.abort(), [])

  async function chooseFolder(files: FileList | null) {
    if (!files?.length) return
    setState('preparing')
    setPrepared(null)
    setProgress(null)
    setFinalizedSessionId('')
    setErrors({})
    setUploadError('')
    try {
      const next = await prepareSkillFolder(Array.from(files))
      setPrepared(next)
      setTitle(next.title)
      setDescription(next.description)
      setState('ready')
    } catch (cause) {
      setState('idle')
      setUploadError(cause instanceof Error ? cause.message : '无法读取 Skill 文件夹')
    } finally {
      if (folderInputRef.current) folderInputRef.current.value = ''
    }
  }

  async function uploadAndSubmit() {
    if (!prepared || state === 'uploading' || state === 'submitting') return
    const metadataErrors = validateSkillMetadata({
      name: prepared.name,
      title,
      description,
      category,
    })
    if (metadataErrors.name) {
      metadataErrors.package = `${metadataErrors.name}，请修改 SKILL.md 中的 name`
      delete metadataErrors.name
    }
    setErrors(metadataErrors)
    if (Object.keys(metadataErrors).length > 0) return

    setUploadError('')
    let sessionId = finalizedSessionId
    try {
      if (!sessionId) {
        const controller = new AbortController()
        activeUploadRef.current = controller
        setState('uploading')
        const finalized = await client.agent.skills.uploadPackage(prepared.archive, {
          signal: controller.signal,
          maxRetries: 2,
          onProgress: setProgress,
        })
        sessionId = finalized.sessionId
        setFinalizedSessionId(sessionId)
        activeUploadRef.current = null
      }

      setState('submitting')
      await client.skills.owner.submit({
        uploadSessionId: sessionId,
        name: prepared.name,
        title: title.trim(),
        description: description.trim(),
        category,
      })
      setState('submitted')
    } catch (cause) {
      const wasCancelled = activeUploadRef.current?.signal.aborted ?? false
      activeUploadRef.current = null
      setState('ready')
      if (wasCancelled) {
        setUploadError('上传已取消，可直接重新提交。')
      } else if (!handleAuthenticationFailure(cause)) {
        setUploadError(cause instanceof Error ? cause.message : '上传失败，请重试')
      }
    }
  }

  const busy = state === 'preparing' || state === 'uploading' || state === 'submitting'

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 md:py-14">
      <Link
        href="/skills"
        className="font-mono text-[0.65rem] font-bold tracking-[0.14em] text-brand hover:text-brand-hover"
      >
        ← SKILL 市场
      </Link>
      <h1 className="mt-4 text-[clamp(2rem,5vw,3.5rem)] leading-none font-extrabold tracking-[-0.045em]">
        上传 Skill
      </h1>
      <p className="mt-4 text-sm leading-6 text-ink-muted">
        选择传统 Skill 文件夹。系统会读取根目录
        <code className="mx-1 rounded bg-surface-inset px-1.5 py-0.5 font-mono text-xs">
          SKILL.md
        </code>
        并在浏览器中打包后直传私有 OSS。
      </p>

      <div className="mt-7">
        <button
          type="button"
          disabled={busy}
          onClick={() => folderInputRef.current?.click()}
          className="rounded-xl bg-brand px-5 py-3 text-sm font-bold text-white transition hover:bg-brand-hover focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-brand-focus disabled:cursor-wait disabled:opacity-60"
        >
          {state === 'preparing'
            ? '正在读取文件夹…'
            : prepared
              ? '重新选择 Skill 文件夹'
              : '选择 Skill 文件夹'}
        </button>
        <input
          {...folderPickerAttributes}
          ref={folderInputRef}
          type="file"
          multiple
          className="sr-only"
          onChange={(event) => void chooseFolder(event.target.files)}
        />
        <p className="mt-2 text-xs text-ink-faint">根目录需包含 SKILL.md；压缩后不超过 20 MiB。</p>
      </div>

      {uploadError ? (
        <p
          role="alert"
          className="mt-5 rounded-xl border border-rose-300/60 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:bg-rose-950/30 dark:text-rose-200"
        >
          {uploadError}
        </p>
      ) : null}

      {prepared ? (
        <section className="mt-7 rounded-[1.5rem] border border-line bg-surface-card p-5 shadow-[0_16px_45px_rgb(35_26_54/0.06)] sm:p-7 dark:shadow-none">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-2 border-b border-line pb-5">
            <div>
              <strong className="block text-sm">{prepared.folderName || 'Skill 文件夹'}</strong>
              <span className="mt-1 block text-xs text-ink-faint">
                {prepared.fileCount} 个文件 · {formatFileSize(prepared.sourceBytes)}
              </span>
            </div>
            <span className="rounded-full bg-brand-subtle px-3 py-1 font-mono text-[0.65rem] font-bold text-brand-hover">
              SKILL.md 已读取
            </span>
          </div>

          <div className="grid gap-5">
            <Field label="标题" error={errors.title}>
              <input
                value={title}
                maxLength={SKILL_TITLE_MAX_LENGTH}
                onChange={(event) => setTitle(event.target.value)}
                className={inputClass}
              />
            </Field>

            <Field label="描述" error={errors.description}>
              <textarea
                value={description}
                maxLength={SKILL_DESCRIPTION_MAX_LENGTH}
                rows={4}
                onChange={(event) => setDescription(event.target.value)}
                className={cn(inputClass, 'resize-y leading-6')}
              />
              <p className="mt-1.5 text-right font-mono text-[0.62rem] text-ink-faint">
                {description.length} / {SKILL_DESCRIPTION_MAX_LENGTH}
              </p>
            </Field>

            <Field label="分类" error={errors.category}>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value as SkillCategory)}
                className={inputClass}
              >
                {SKILL_CATEGORIES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </Field>

            <FieldError message={errors.package} />

            {state === 'uploading' && progress ? (
              <div aria-live="polite">
                <div className="mb-2 flex justify-between text-xs text-ink-muted">
                  <span>{progress.phase === 'hashing' ? '正在计算文件摘要' : '正在上传 OSS'}</span>
                  <span>{progress.percent}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-inset">
                  <div
                    className="h-full rounded-full bg-brand transition-[width]"
                    style={{ width: `${progress.percent}%` }}
                  />
                </div>
              </div>
            ) : null}

            {state === 'submitted' ? (
              <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
                已提交管理员首次发布审核。
                <Link href="/skills/mine" className="ml-2 font-bold underline underline-offset-2">
                  查看我的 Skill
                </Link>
              </div>
            ) : (
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void uploadAndSubmit()}
                  className="rounded-xl bg-[#24202e] px-5 py-3 text-sm font-bold text-white transition hover:bg-brand disabled:cursor-wait disabled:opacity-60 dark:bg-white dark:text-[#24202e]"
                >
                  {state === 'uploading'
                    ? '正在上传…'
                    : state === 'submitting'
                      ? '正在提交审核…'
                      : finalizedSessionId
                        ? '重新提交审核'
                        : '上传并提交审核'}
                </button>
                {state === 'uploading' ? (
                  <button
                    type="button"
                    onClick={() => activeUploadRef.current?.abort()}
                    className="rounded-xl border border-line px-5 py-3 text-sm font-semibold text-ink-muted hover:text-ink"
                  >
                    取消
                  </button>
                ) : null}
              </div>
            )}
          </div>
        </section>
      ) : null}
    </main>
  )
}

const inputClass =
  'w-full rounded-xl border border-line bg-surface px-3.5 py-3 text-sm text-ink outline-none transition placeholder:text-ink-faint focus:border-brand focus:ring-3 focus:ring-brand/10 dark:bg-surface-inset'

function Field({
  label,
  error,
  children,
}: Readonly<{ label: string; error?: string | undefined; children: React.ReactNode }>) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold text-ink-muted">{label}</span>
      {children}
      <FieldError message={error} />
    </label>
  )
}

function FieldError({ message }: Readonly<{ message?: string | undefined }>) {
  return message ? (
    <span role="alert" className="mt-1.5 block text-xs leading-5 text-rose-700 dark:text-rose-300">
      {message}
    </span>
  ) : null
}
