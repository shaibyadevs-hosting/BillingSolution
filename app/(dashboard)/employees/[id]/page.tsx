export async function generateStaticParams() {
  // Return placeholder for static export - actual routes handled at runtime
  return [{ id: 'placeholder' }]
}

import EmployeeDetailPageClient from './page-client'

export default async function EmployeeDetailPage() {
  return <EmployeeDetailPageClient />
}
