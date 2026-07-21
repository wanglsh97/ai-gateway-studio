'use client'

import {
  Alert,
  Avatar,
  Button,
  Col,
  DatePicker,
  Drawer,
  Form,
  Input,
  Row,
  Select,
  Space,
  Table,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useEffect, useState } from 'react'

import { AdminApiError, redirectToAdminLogin } from '../../../../lib/admin-auth-client'
import { loadRequestLogDetail, loadRequestLogs } from '../../../../lib/admin-request-logs'
import type {
  RequestLogDetail,
  RequestLogFilters,
  RequestLogListItem,
  RequestLogPage,
} from '../../../../lib/admin-request-logs'

const initialFilters: RequestLogFilters = { page: 1, pageSize: 20 }

interface LogFilterFormValues {
  capability?: string
  status?: string
  model?: string
  requestId?: string
  githubUsername?: string
  githubId?: string
  from?: { toISOString?: () => string }
  to?: { toISOString?: () => string }
}

export default function AdminRequestLogsPage() {
  const [form] = Form.useForm<LogFilterFormValues>()
  const [filters, setFilters] = useState<RequestLogFilters>(initialFilters)
  const [result, setResult] = useState<RequestLogPage | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<RequestLogDetail | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    void loadRequestLogs(filters)
      .then((page) => {
        if (active) setResult(page)
      })
      .catch((caught: unknown) => {
        if (!active) return
        if (caught instanceof AdminApiError && caught.status === 401) {
          redirectToAdminLogin()
          return
        }
        setError(caught instanceof Error ? caught.message : '请求日志加载失败')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [filters])

  function applyFilters(values: LogFilterFormValues) {
    const next: RequestLogFilters = {
      page: 1,
      pageSize: 20,
    }
    if (values.capability) next.capability = values.capability
    if (values.status) next.status = values.status
    if (values.model) next.model = values.model
    if (values.requestId) next.requestId = values.requestId
    if (values.githubUsername) next.githubUsername = values.githubUsername
    if (values.githubId) next.githubId = values.githubId
    if (values.from?.toISOString) next.from = values.from.toISOString()
    if (values.to?.toISOString) next.to = values.to.toISOString()
    setFilters(next)
  }

  async function openDetail(requestId: string) {
    setDetailOpen(true)
    setDetailLoading(true)
    setDetailError('')
    setDetail(null)
    try {
      setDetail(await loadRequestLogDetail(requestId))
    } catch (caught) {
      if (caught instanceof AdminApiError && caught.status === 401) {
        redirectToAdminLogin()
        return
      }
      setDetailError(caught instanceof Error ? caught.message : '详情加载失败')
    } finally {
      setDetailLoading(false)
    }
  }

  function closeDetail() {
    setDetailOpen(false)
    setDetail(null)
    setDetailError('')
  }

  const columns: ColumnsType<RequestLogListItem> = [
    {
      title: '时间',
      dataIndex: 'createdAt',
      width: 170,
      render: (value: string) => new Date(value).toLocaleString('zh-CN'),
    },
    {
      title: 'Request ID',
      dataIndex: 'requestId',
      width: 280,
      render: (value: string) => (
        <Space size={4}>
          <Typography.Link code onClick={() => openDetail(value)}>
            {value.slice(0, 8)}…
          </Typography.Link>
          <Typography.Text copyable={{ text: value }} />
        </Space>
      ),
    },
    {
      title: '用户',
      key: 'user',
      width: 180,
      render: (_, row) => (
        <Space>
          <Avatar size="small">{row.user.githubUsername.slice(0, 2).toUpperCase()}</Avatar>
          <div>
            <div>@{row.user.githubUsername}</div>
            <Typography.Text type="secondary" style={{ fontSize: 11 }}>
              {row.user.githubId}
            </Typography.Text>
          </div>
        </Space>
      ),
    },
    { title: '能力', dataIndex: 'capability', width: 90 },
    { title: '模型', dataIndex: 'modelAlias', width: 100 },
    { title: '状态', dataIndex: 'status', width: 100 },
    {
      title: '耗时',
      dataIndex: 'durationMs',
      width: 90,
      render: (value: number | null) => (value === null ? '—' : `${value} ms`),
    },
    {
      title: 'Token',
      key: 'tokens',
      width: 80,
      render: (_, row) => row.billing?.totalTokens ?? '—',
    },
    {
      title: '费用',
      key: 'cost',
      width: 120,
      render: (_, row) =>
        row.billing?.estimatedCostCny ? `¥${row.billing.estimatedCostCny}` : '—',
    },
  ]

  return (
    <div>
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        请求日志
      </Typography.Title>

      <Form
        form={form}
        layout="vertical"
        initialValues={initialFilters}
        onFinish={applyFilters}
        style={{ marginBottom: 16 }}
      >
        <Row gutter={16}>
          <Col xs={24} sm={12} md={6}>
            <Form.Item label="能力" name="capability">
              <Select allowClear placeholder="全部" options={CAPABILITY_OPTIONS} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Form.Item label="状态" name="status">
              <Select allowClear placeholder="全部" options={STATUS_OPTIONS} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Form.Item label="模型" name="model">
              <Select allowClear placeholder="全部" options={MODEL_OPTIONS} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Form.Item label="Request ID" name="requestId">
              <Input placeholder="UUID" allowClear />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Form.Item label="GitHub username" name="githubUsername">
              <Input placeholder="octocat" allowClear />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Form.Item label="GitHub ID" name="githubId">
              <Input placeholder="数字 ID" allowClear />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Form.Item label="开始时间" name="from">
              <DatePicker showTime style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Form.Item label="结束时间" name="to">
              <DatePicker showTime style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Form.Item label=" ">
              <Space>
                <Button type="primary" htmlType="submit">
                  筛选
                </Button>
                <Button
                  onClick={() => {
                    form.resetFields()
                    setFilters(initialFilters)
                  }}
                >
                  重置
                </Button>
              </Space>
            </Form.Item>
          </Col>
        </Row>
      </Form>

      {error ? <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} /> : null}

      <Table
        rowKey="requestId"
        size="small"
        loading={loading}
        columns={columns}
        dataSource={result?.items ?? []}
        scroll={{ x: 1100 }}
        locale={{ emptyText: '暂无匹配记录' }}
        pagination={{
          current: result?.page ?? filters.page ?? 1,
          pageSize: result?.pageSize ?? filters.pageSize ?? 20,
          total: result?.total ?? 0,
          showTotal: (total) => `共 ${total} 条`,
          onChange: (page) => setFilters((current) => ({ ...current, page })),
        }}
      />

      <Drawer
        title="请求详情"
        size={720}
        open={detailOpen}
        onClose={closeDetail}
        destroyOnHidden
      >
        {detailLoading ? (
          <Typography.Text type="secondary">正在加载详情…</Typography.Text>
        ) : detailError ? (
          <Alert type="error" showIcon title={detailError} />
        ) : detail ? (
          <DetailContent detail={detail} />
        ) : null}
      </Drawer>
    </div>
  )
}

function DetailContent({ detail }: { detail: RequestLogDetail }) {
  const fields: Array<[string, unknown]> = [
    ['Request ID', detail.requestId],
    ['GitHub username', `@${detail.user.githubUsername}`],
    ['GitHub ID', detail.user.githubId],
    ['平台用户 ID', detail.user.id],
    ['昵称', detail.user.displayName],
    ['邮箱（仅管理员详情）', detail.user.email],
    ['状态', detail.status],
    ['能力', detail.capability],
    ['模型 alias', detail.modelAlias],
    ['Provider', detail.provider],
    ['Resolved model', detail.resolvedModel],
    ['Provider request ID', detail.providerRequestId],
    ['耗时', detail.durationMs === null ? null : `${detail.durationMs} ms`],
  ]

  return (
    <Space orientation="vertical" size="large" style={{ width: '100%' }}>
      <Row gutter={[16, 8]}>
        {fields.map(([label, value]) => (
          <Col key={label} xs={24} sm={12}>
            <Typography.Text type="secondary">{label}</Typography.Text>
            <div>
              <Typography.Text>{value === null || value === undefined ? '—' : String(value)}</Typography.Text>
            </div>
          </Col>
        ))}
      </Row>
      <JsonSection title="完整 Prompt / Messages" value={detail.prompt} />
      <JsonSection title="Usage / Cost" value={detail.billing} />
      <JsonSection
        title="Failover"
        value={{ from: detail.failoverFrom, to: detail.failoverTo, reason: detail.failoverReason }}
      />
      <JsonSection
        title="完整错误"
        value={{
          code: detail.errorCode,
          message: detail.errorMessage,
          details: detail.errorDetails,
        }}
      />
      {detail.imageTask ? <JsonSection title="图片任务" value={detail.imageTask} /> : null}
      <JsonSection title="Metadata" value={detail.metadata} />
    </Space>
  )
}

function JsonSection({ title, value }: { title: string; value: unknown }) {
  return (
    <div>
      <Typography.Title level={5}>{title}</Typography.Title>
      <pre
        style={{
          margin: 0,
          padding: 12,
          background: '#f5f5f5',
          borderRadius: 6,
          fontSize: 12,
          overflow: 'auto',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {JSON.stringify(value, null, 2) ?? 'null'}
      </pre>
    </div>
  )
}

const CAPABILITY_OPTIONS = [
  { value: 'chat', label: 'Chat' },
  { value: 'image', label: '文生图' },
  { value: 'prompt', label: 'Prompt' },
]

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'succeeded', label: 'Succeeded' },
  { value: 'failed', label: 'Failed' },
  { value: 'cancelled', label: 'Cancelled' },
]

const MODEL_OPTIONS = ['qwen', 'glm', 'deepseek', 'kimi', 'wanxiang', 'cogview'].map((model) => ({
  value: model,
  label: model,
}))
