import CustomerVerifyPageClient from './page-client'

// Server component wrapper for static export
export async function generateStaticParams() {
  return []
}

export default function CustomerVerifyPage() {
  return <CustomerVerifyPageClient />
}
