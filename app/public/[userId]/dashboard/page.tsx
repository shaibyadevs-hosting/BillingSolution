export async function generateStaticParams() {
  // Return placeholder for static export - actual routes handled at runtime
  return [{ userId: 'placeholder' }]
}

import PublicCustomerDashboardClient from './page-client'

export default function PublicCustomerDashboard() {
  return <PublicCustomerDashboardClient />
}
