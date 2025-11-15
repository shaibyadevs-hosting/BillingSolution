export async function generateStaticParams() {
  // Return placeholder for static export - actual routes handled at runtime
  return [{ id: 'placeholder' }]
}

import CustomerDetailPageClient from './page-client'

export default async function CustomerDetailPage() {
  return <CustomerDetailPageClient />
}
