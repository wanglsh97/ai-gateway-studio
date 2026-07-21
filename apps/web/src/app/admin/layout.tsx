import type { ReactNode } from 'react'

import { AdminAntdProvider } from '../../components/admin/admin-antd-provider'

import './admin.css'

export default function AdminRootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="aigateway-admin-root" data-theme="light">
      <AdminAntdProvider>{children}</AdminAntdProvider>
    </div>
  )
}
