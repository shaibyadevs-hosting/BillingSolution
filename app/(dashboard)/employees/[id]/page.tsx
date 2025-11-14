import EmployeeDetailPageClient from './page-client'

// Server component wrapper for static export
export const dynamicParams = true

export async function generateStaticParams() {
  return []
}

export default function EmployeeDetailPage() {
  return <EmployeeDetailPageClient />
}
