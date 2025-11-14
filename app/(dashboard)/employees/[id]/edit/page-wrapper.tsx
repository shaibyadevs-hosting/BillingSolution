// Server component wrapper for static export
export async function generateStaticParams() {
  return []
}

import EditEmployeePageClient from './page-client'

export default function EditEmployeePageWrapper() {
  return <EditEmployeePageClient />
}

