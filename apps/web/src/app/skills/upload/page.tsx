'use client'

import { createAIGatewayClient } from '@aigateway/sdk'
import type { SkillUploadProgress } from '@aigateway/sdk'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'

import { ProtectedUserPage } from '../../../components/protected-user-page'
import { useAuthenticationFailure } from '../../../components/use-authentication-failure'
import { cn } from '../../../lib/cn'
import {
  formatFileSize,
  SKILL_CATEGORIES,
  SKILL_DESCRIPTION_MAX_LENGTH,
  SKILL_TITLE_MAX_LENGTH,
  validateSkillIconFile,
  validateSkillMetadata,
  validateSkillPackageFile,
  type SkillCategory,
} from './skill-upload-form'

const client = createAIGatewayClient()

type PackageState =
  'idle' | 'ready' | 'hashing' | 'uploading' | 'validating' | 'valid' | 'invalid' | 'cancelled'

export default function SkillUploadPage() {
  return (
    <ProtectedUserPage>
      <SkillUploadWorkbench />
    </ProtectedUserPage>
  )
}

function SkillUploadWorkbench() {
  const handleAuthenticationFailure = useAuthenticationFailure()
  const packageInputRef = useRef<HTMLInputElement | null>(null)
  const iconInputRef = useRef<HTMLInputElement | null>(null)
  const activeUploadRef = useRef<AbortController | null>(null)
  const [name, setName] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<SkillCategory>('development')
  const [icon, setIcon] = useState<File | null>(null)
  const [iconPreview, setIconPreview] = useState('')
  const [packageFile, setPackageFile] = useState<File | null>(null)
  const [packageState, setPackageState] = useState<PackageState>('idle')
  const [progress, setProgress] = useState<SkillUploadProgress | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [uploadError, setUploadError] = useState('')
  const [finalizedAt, setFinalizedAt] = useState('')

  useEffect(() => {
    if (!icon) {
      setIconPreview('')
      return
    }
    const url = URL.createObjectURL(icon)
    setIconPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [icon])

  useEffect(() => () => activeUploadRef.current?.abort(), [])

  const metadataComplete = useMemo(
    () => Object.keys(validateSkillMetadata({ name, title, description, category })).length === 0,
    [category, description, name, title],
  )
  const busy = ['hashing', 'uploading', 'validating'].includes(packageState)

  function choosePackage(file: File | undefined) {
    if (!file) return
    const error = validateSkillPackageFile(file)
    setPackageFile(error ? null : file)
    setPackageState(error ? 'invalid' : 'ready')
    setProgress(null)
    setFinalizedAt('')
    setUploadError(error ?? '')
  }

  function chooseIcon(file: File | undefined) {
    if (!file) return
    const error = validateSkillIconFile(file)
    if (error) {
      setErrors((current) => ({ ...current, icon: error }))
      setIcon(null)
      return
    }
    setErrors((current) => omit(current, 'icon'))
    setIcon(file)
  }

  async function upload() {
    const metadataErrors = validateSkillMetadata({ name, title, description, category })
    if (!packageFile) metadataErrors.package = '请先选择 Skill ZIP 资源包'
    setErrors(metadataErrors)
    if (Object.keys(metadataErrors).length > 0 || !packageFile) return

    const controller = new AbortController()
    activeUploadRef.current = controller
    setUploadError('')
    setFinalizedAt('')
    try {
      const finalized = await client.agent.skills.uploadPackage(packageFile, {
        signal: controller.signal,
        maxRetries: 2,
        onProgress: (next) => {
          setProgress(next)
          setPackageState(
            next.phase === 'hashing'
              ? 'hashing'
              : next.phase === 'uploading'
                ? 'uploading'
                : 'validating',
          )
        },
      })
      setPackageState('valid')
      setFinalizedAt(finalized.finalizedAt)
    } catch (cause) {
      if (controller.signal.aborted) {
        setPackageState('cancelled')
        setUploadError('上传已取消，资源包仍保留在本页，可直接重试。')
      } else if (!handleAuthenticationFailure(cause)) {
        setPackageState('invalid')
        setUploadError(cause instanceof Error ? cause.message : '资源包上传校验失败')
      }
    } finally {
      if (activeUploadRef.current === controller) activeUploadRef.current = null
    }
  }

  return (
    <main className="mx-auto max-w-[76rem] px-4 py-8 sm:px-6 md:px-10 md:py-14">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link
            href="/skills"
            className="font-mono text-[0.65rem] font-bold tracking-[0.14em] text-brand hover:text-brand-hover"
          >
            ← SKILL 市场
          </Link>
          <h1 className="mt-3 text-[clamp(2.1rem,4vw,3.8rem)] leading-none font-extrabold tracking-[-0.045em]">
            上传传统 Skill
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-ink-muted">
            市场资料与资源包分开管理。ZIP 须在根目录包含
            <code className="mx-1 rounded bg-surface-inset px-1.5 py-0.5 font-mono text-xs">
              SKILL.md
            </code>
            ，首次公开前将进入管理员审核。
          </p>
        </div>
        <span className="rounded-full border border-line bg-surface-card px-3 py-1.5 font-mono text-[0.62rem] tracking-wider text-ink-faint">
          PRIVATE OSS · MAX 20 MiB
        </span>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="rounded-[1.6rem] border border-line bg-surface-card/78 p-5 shadow-[0_18px_50px_rgb(35_26_54/0.06)] sm:p-7 dark:bg-white/[0.035] dark:shadow-none">
          <div className="grid gap-6">
            <div className="grid gap-5 sm:grid-cols-[7rem_minmax(0,1fr)]">
              <div>
                <span className="mb-2 block text-xs font-semibold text-ink-muted">图标</span>
                <button
                  type="button"
                  onClick={() => iconInputRef.current?.click()}
                  className="group grid aspect-square w-full place-items-center overflow-hidden rounded-[1.35rem] border border-dashed border-line bg-surface-inset text-2xl font-black text-brand transition hover:border-brand hover:bg-brand-subtle focus-visible:outline-3 focus-visible:outline-brand-focus"
                >
                  {iconPreview ? (
                    <img
                      src={iconPreview}
                      alt="Skill 图标预览"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span>{title.trim().slice(0, 2).toUpperCase() || 'SK'}</span>
                  )}
                </button>
                <input
                  ref={iconInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  onChange={(event) => chooseIcon(event.target.files?.[0])}
                />
                <p className="mt-2 text-[0.66rem] leading-4 text-ink-faint">
                  PNG / JPEG / WebP，2 MiB
                </p>
                <FieldError message={errors.icon} />
              </div>

              <div className="grid gap-5">
                <Field label="全局名称" error={errors.name}>
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value.toLowerCase())}
                    placeholder="csv-cleaner"
                    spellCheck={false}
                    className={inputClass}
                  />
                  <p className="mt-1.5 text-[0.68rem] text-ink-faint">
                    首次发布后不可修改，仅支持小写字母、数字和连字符。
                  </p>
                </Field>
                <Field label="市场标题" error={errors.title}>
                  <input
                    value={title}
                    maxLength={SKILL_TITLE_MAX_LENGTH}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="让用户一眼看懂这个 Skill"
                    className={inputClass}
                  />
                </Field>
              </div>
            </div>

            <Field label="简介" error={errors.description}>
              <textarea
                value={description}
                maxLength={SKILL_DESCRIPTION_MAX_LENGTH}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="说明它解决什么问题、适合什么输入，以及会生成什么结果。"
                rows={4}
                className={cn(inputClass, 'resize-y leading-6')}
              />
              <p className="mt-1.5 text-right font-mono text-[0.62rem] text-ink-faint">
                {description.length} / {SKILL_DESCRIPTION_MAX_LENGTH}
              </p>
            </Field>

            <Field label="平台分类" error={errors.category}>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {SKILL_CATEGORIES.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    aria-pressed={category === item.value}
                    onClick={() => setCategory(item.value)}
                    className={cn(
                      'rounded-xl border px-3 py-2.5 text-sm font-semibold transition focus-visible:outline-3 focus-visible:outline-brand-focus',
                      category === item.value
                        ? 'border-brand bg-brand-subtle text-brand-hover'
                        : 'border-line bg-surface text-ink-muted hover:border-brand/45 hover:text-ink',
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </Field>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-ink-muted">传统资源包</span>
                {packageFile ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => packageInputRef.current?.click()}
                    className="text-xs font-semibold text-brand hover:text-brand-hover disabled:opacity-50"
                  >
                    更换
                  </button>
                ) : null}
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => packageInputRef.current?.click()}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault()
                  choosePackage(event.dataTransfer.files[0])
                }}
                className={cn(
                  'relative w-full overflow-hidden rounded-[1.35rem] border border-dashed p-5 text-left transition focus-visible:outline-3 focus-visible:outline-brand-focus disabled:cursor-wait',
                  packageFile
                    ? 'border-brand/45 bg-brand-subtle/55'
                    : 'border-line bg-[radial-gradient(circle_at_1px_1px,rgb(112_87_232/0.16)_1px,transparent_0)] bg-[size:16px_16px] hover:border-brand',
                )}
              >
                <div className="relative flex items-center gap-4 rounded-xl bg-surface-card/90 p-4 shadow-sm dark:bg-surface-overlay/90">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#24202e] font-mono text-[0.68rem] font-bold text-[#b8f3e0]">
                    ZIP
                  </span>
                  <span className="min-w-0">
                    <strong className="block truncate text-sm">
                      {packageFile?.name ?? '拖入资源包，或点击选择'}
                    </strong>
                    <span className="mt-1 block text-xs text-ink-faint">
                      {packageFile
                        ? `${formatFileSize(packageFile.size)} · 等待上传`
                        : '根目录 SKILL.md · 最多 2,000 个文件'}
                    </span>
                  </span>
                </div>
              </button>
              <input
                ref={packageInputRef}
                type="file"
                accept=".zip,application/zip"
                className="sr-only"
                onChange={(event) => choosePackage(event.target.files?.[0])}
              />
              <FieldError message={errors.package ?? uploadError} />
            </div>
          </div>
        </section>

        <aside className="rounded-[1.6rem] border border-line bg-[#24202e] p-5 text-white shadow-[0_18px_50px_rgb(35_26_54/0.14)] sm:p-6 lg:sticky lg:top-6 dark:bg-[#191522]">
          <p className="font-mono text-[0.62rem] font-bold tracking-[0.14em] text-[#b8f3e0]">
            PACKAGE MANIFEST
          </p>
          <h2 className="mt-3 text-xl font-bold tracking-tight">发布前检查</h2>
          <div className="mt-7 grid gap-1">
            <StatusRow
              index="01"
              title="市场资料"
              detail={metadataComplete ? '必填项已完成' : '补全名称、标题、简介和分类'}
              state={metadataComplete ? 'done' : 'waiting'}
            />
            <StatusRow
              index="02"
              title="直传私有 OSS"
              detail={packageStatusDetail(packageState, progress, packageFile)}
              state={
                packageState === 'uploading' || packageState === 'hashing'
                  ? 'active'
                  : ['validating', 'valid'].includes(packageState)
                    ? 'done'
                    : packageState === 'invalid' || packageState === 'cancelled'
                      ? 'error'
                      : 'waiting'
              }
            />
            <StatusRow
              index="03"
              title="服务端校验"
              detail={
                packageState === 'valid'
                  ? `已于 ${formatTime(finalizedAt)} 完成大小与 SHA-256 校验`
                  : packageState === 'validating'
                    ? '正在核对对象元数据与上传会话'
                    : packageState === 'invalid'
                      ? '校验未通过，请修正后重试'
                      : '上传完成后自动开始'
              }
              state={
                packageState === 'validating'
                  ? 'active'
                  : packageState === 'valid'
                    ? 'done'
                    : packageState === 'invalid'
                      ? 'error'
                      : 'waiting'
              }
              last
            />
          </div>

          {progress && (packageState === 'hashing' || packageState === 'uploading') ? (
            <div className="mt-6">
              <div className="mb-2 flex justify-between font-mono text-[0.62rem] text-white/55">
                <span>
                  {progress.phase === 'hashing' ? 'SHA-256' : `PUT · TRY ${progress.attempt}`}
                </span>
                <span>{progress.percent}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-[#b8f3e0] transition-[width]"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
            </div>
          ) : null}

          <div className="mt-7 grid gap-2">
            {busy ? (
              <button
                type="button"
                onClick={() => activeUploadRef.current?.abort()}
                className="rounded-xl border border-white/20 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10"
              >
                取消上传
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void upload()}
                className="rounded-xl bg-[#b8f3e0] px-4 py-3 text-sm font-extrabold text-[#24202e] transition hover:bg-white focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#b8f3e0]"
              >
                {packageState === 'valid'
                  ? '重新上传资源包'
                  : packageState === 'invalid' || packageState === 'cancelled'
                    ? '重试上传与校验'
                    : '上传并校验'}
              </button>
            )}
            <p className="text-center text-[0.65rem] leading-5 text-white/45">
              资源包不会经由 Web API 转发；浏览器使用短时单对象签名直传。
            </p>
          </div>
        </aside>
      </div>
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

function StatusRow({
  index,
  title,
  detail,
  state,
  last = false,
}: Readonly<{
  index: string
  title: string
  detail: string
  state: 'waiting' | 'active' | 'done' | 'error'
  last?: boolean
}>) {
  return (
    <div className="grid grid-cols-[2rem_1fr] gap-3">
      <div className="flex flex-col items-center">
        <span
          className={cn(
            'grid size-8 place-items-center rounded-full border font-mono text-[0.58rem] font-bold',
            state === 'done'
              ? 'border-[#b8f3e0] bg-[#b8f3e0] text-[#24202e]'
              : state === 'active'
                ? 'animate-pulse border-white bg-white text-[#24202e]'
                : state === 'error'
                  ? 'border-rose-300 bg-rose-300/15 text-rose-200'
                  : 'border-white/15 text-white/35',
          )}
        >
          {state === 'done' ? '✓' : index}
        </span>
        {!last ? <span className="my-1 h-8 w-px bg-white/12" /> : null}
      </div>
      <div className="pt-1">
        <strong className="block text-sm">{title}</strong>
        <span className="mt-1 block text-xs leading-5 text-white/45">{detail}</span>
      </div>
    </div>
  )
}

function packageStatusDetail(
  state: PackageState,
  progress: SkillUploadProgress | null,
  file: File | null,
): string {
  if (state === 'hashing') return '正在计算本地 SHA-256'
  if (state === 'uploading') return `正在上传 · ${progress?.percent ?? 0}%`
  if (state === 'validating' || state === 'valid') return '私有对象上传完成'
  if (state === 'cancelled') return '本次上传已取消'
  if (state === 'invalid') return '等待修正资源包'
  return file ? `${formatFileSize(file.size)} · 已就绪` : '选择 ZIP 资源包'
}

function formatTime(value: string): string {
  if (!value) return '刚刚'
  return new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit' }).format(
    new Date(value),
  )
}

function omit(value: Record<string, string>, key: string): Record<string, string> {
  return Object.fromEntries(Object.entries(value).filter(([entry]) => entry !== key))
}
