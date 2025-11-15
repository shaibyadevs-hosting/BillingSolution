export async function generateStaticParams() {
  // Return placeholder for static export - actual routes handled at runtime
  return [{ id: 'placeholder' }]
}

import EditCustomerPageClient from './page-client'

export default async function EditCustomerPage() {
  return <EditCustomerPageClient />
}
