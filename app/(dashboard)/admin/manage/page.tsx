"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function AdminManagementPage() {
  const router = useRouter()
  
  useEffect(() => {
    // Redirect to secret admin page
    router.push("/admin/ckejwngw242r1/login")
  }, [router])

  return null
}
