export async function generateStaticParams() {
  // Return placeholder for static export - actual routes handled at runtime
  return [{ id: 'placeholder' }]
}

import InvoiceDetailPageClient from './page-client'

export default async function InvoiceDetailPage() {
  return <InvoiceDetailPageClient />
}
