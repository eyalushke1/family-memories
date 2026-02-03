import { AdminSidebar } from '@/components/admin/admin-sidebar'
import { AdminAuthGuard } from '@/components/admin/admin-auth-guard'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminAuthGuard>
      <div className="flex min-h-screen bg-bg-primary">
        <AdminSidebar />
        <main className="flex-1 ml-64 p-8">{children}</main>
      </div>
    </AdminAuthGuard>
  )
}
