export async function generateStaticParams() {
  // Return placeholder for static export - actual routes handled at runtime
  return [{ token: 'placeholder' }]
}

import CustomerVerifyPageClient from './page-client'

export default function CustomerVerifyPage() {
  return <CustomerVerifyPageClient />
}
