// Server component wrapper for static export
export async function generateStaticParams() {
  return []
}

import EmployeeDetailPageClient from './page-client'

export default function EmployeeDetailPage() {
  return <EmployeeDetailPageClient />
}
