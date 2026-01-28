import { BrowseHeader } from '@/components/browse/browse-header'

export default function BrowseLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg-primary">
      <BrowseHeader />
      {children}
    </div>
  )
}
