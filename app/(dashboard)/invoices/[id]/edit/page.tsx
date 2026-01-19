export async function generateStaticParams() {
  return [{ id: 'placeholder' }]
}

import InvoiceEditPageClient from './page-client'

export default async function InvoiceEditPage() {
  return <InvoiceEditPageClient />
}
