"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { db } from "@/lib/dexie-client"
import { getDatabaseType } from "@/lib/utils/db-mode"
import { createClient } from "@/lib/supabase/client"
import { setCustomerSession } from "@/lib/utils/customer-auth"
import { Button } from "@/components/ui/button"

export default function CustomerVerifyPage() {
  const params = useParams()
  const router = useRouter()
  const token = params.token as string
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying")
  const [message, setMessage] = useState("")
  const isExcel = getDatabaseType() === 'excel'

  useEffect(() => {
    (async () => {
      try {
        // Find customer_auth by token
        let authRecord = null
        if (isExcel) {
          const auths = await db.customer_auth.toArray()
          authRecord = auths.find(a => a.magic_link_token === token)
        } else {
          const supabase = createClient()
          const { data } = await supabase
            .from("customer_auth")
            .select("*")
            .eq("magic_link_token", token)
            .single()
          authRecord = data
        }

        if (!authRecord) {
          throw new Error("Invalid or expired token")
        }

        // Check expiration
        if (authRecord.token_expires_at && new Date(authRecord.token_expires_at) < new Date()) {
          throw new Error("Token has expired")
        }

        // Get customer
        let customer = null
        if (isExcel) {
          customer = await db.customers.get(authRecord.customer_id)
        } else {
          const supabase = createClient()
          const { data } = await supabase
            .from("customers")
            .select("*")
            .eq("id", authRecord.customer_id)
            .single()
          customer = data
        }

        if (!customer) {
          throw new Error("Customer not found")
        }

        // Create customer session
        setCustomerSession({
          customerId: customer.id,
          email: customer.email || "",
          name: customer.name,
          token: token,
        })

        setStatus("success")
        setMessage("Login successful! Redirecting...")
        setTimeout(() => {
          router.push("/customer/dashboard")
        }, 1500)
      } catch (error: any) {
        setStatus("error")
        setMessage(error.message || "Verification failed")
      }
    })()
  }, [token, isExcel, router])

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-muted/40 p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>
            {status === "verifying" && "Verifying..."}
            {status === "success" && "Success!"}
            {status === "error" && "Error"}
          </CardTitle>
          <CardDescription>{message || "Please wait..."}</CardDescription>
        </CardHeader>
        <CardContent>
          {status === "error" && (
            <Button onClick={() => router.push("/auth/customer-login")} className="w-full">
              Back to Login
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

