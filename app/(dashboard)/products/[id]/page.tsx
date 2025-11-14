// Required for static export
export async function generateStaticParams() {
  return []
}

import { createClient } from "@/lib/supabase/server"
import { ProductForm } from "@/components/features/products/product-form"
import { notFound } from "next/navigation"

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: product } = await supabase.from("products").select("*").eq("id", id).eq("user_id", user!.id).single()

  if (!product) {
    notFound()
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Edit Product</h1>
        <p className="text-muted-foreground">Update product information</p>
      </div>

      <ProductForm product={product} />
    </div>
  )
}
