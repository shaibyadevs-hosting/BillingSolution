// Server component wrapper for static export
export async function generateStaticParams() {
  return []
}

import EditCustomerPageClient from './page-client'

export default function EditCustomerPage() {
  return <EditCustomerPageClient />
}
