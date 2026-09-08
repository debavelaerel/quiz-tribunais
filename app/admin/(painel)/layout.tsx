import AdminNav from '@/components/admin/AdminNav'

export default function PainelLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <AdminNav />
      <main className="min-w-0 flex-1 px-9 pb-16 pt-8">{children}</main>
    </div>
  )
}
