"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ProductForm } from "@/components/features/products/product-form"
import { createClient } from "@/lib/supabase/client"
import { db } from "@/lib/dexie-client"
import { useToast } from "@/hooks/use-toast"

export default function EditProductPageClient() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const productId = params.id as string
  const [product, setProduct] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setLoading(true)
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          toast({ title: "Error", description: "Please log in to continue", variant: "destructive" })
          router.push("/login")
          return
        }

        const { data: prod, error } = await supabase
          .from("products")
          .select("*")
          .eq("id", productId)
          .eq("user_id", user.id)
          .single()

        if (error || !prod) {
          // Try to load from local IndexedDB
          const localProd = await db.products?.get?.(productId)
          if (localProd) {
            setProduct(localProd)
            setLoading(false)
            return
          }
          toast({ title: "Error", description: "Product not found", variant: "destructive" })
          router.push("/products")
          return
        }

        setProduct(prod)
      } catch (error) {
        console.error("Error fetching product:", error)
        toast({ title: "Error", description: "Failed to load product", variant: "destructive" })
        router.push("/products")
      } finally {
        setLoading(false)
      }
    }
    fetchProduct()
  }, [productId, router, toast])

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Edit Product</h1>
          <p className="text-muted-foreground">Loading product information...</p>
        </div>
      </div>
    )
  }

  if (!product) {
    return null
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

