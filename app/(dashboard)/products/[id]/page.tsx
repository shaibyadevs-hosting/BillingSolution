// Required for static export
export async function generateStaticParams() {
  // Return placeholder for static export - actual routes handled at runtime
  return [{ id: 'placeholder' }]
}

import EditProductPageClient from './page-client'

export default function EditProductPage() {
  return <EditProductPageClient />
}
