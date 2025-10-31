"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useRouter } from "next/navigation"
import { db } from "@/lib/dexie-client"
import { getDatabaseType } from "@/lib/utils/db-mode"
import { createClient } from "@/lib/supabase/client"

export default function CustomerLoginPage() {
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const router = useRouter()
  const isExcel = getDatabaseType() === 'excel'

  const handleRequestMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setMessage(null)

    try {
      // Find customer by email
      let customer = null
      if (isExcel) {
        const customers = await db.customers.where("email").equals(email).toArray()
        if (customers.length === 0) {
          throw new Error("No account found with this email")
        }
        customer = customers[0]
      } else {
        const supabase = createClient()
        const { data: customers } = await supabase
          .from("customers")
          .select("*")
          .eq("email", email)
        
        if (!customers || customers.length === 0) {
          throw new Error("No account found with this email")
        }
        customer = customers[0]
      }

      // Generate magic link token
      const token = crypto.randomUUID()
      const expiresAt = new Date(Date.now() + 3600000).toISOString() // 1 hour

      // Store in customer_auth
      if (isExcel) {
        await db.customer_auth.put({
          customer_id: customer.id,
          email: customer.email!,
          phone: customer.phone || null,
          magic_link_token: token,
          token_expires_at: expiresAt,
        })
      } else {
        const supabase = createClient()
        await supabase.from("customer_auth").upsert({
          customer_id: customer.id,
          email: customer.email!,
          phone: customer.phone || null,
          magic_link_token: token,
          token_expires_at: expiresAt,
        })
      }

      // In production, send email here via API route
      // For now, show the link (in production, this would be sent via email)
      const magicLink = `${window.location.origin}/auth/customer-verify/${token}`
      setMessage(`Magic link generated! Click here to login: ${magicLink}`)
      
      // TODO: Send email via API route in production
      console.log("Magic link:", magicLink)
      
    } catch (error: any) {
      setError(error.message || "Failed to send magic link")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-muted/40 p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Customer Login</CardTitle>
          <CardDescription>Enter your email to receive a magic link</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRequestMagicLink} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="customer@example.com"
                autoComplete="email"
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            {message && (
              <div className="p-3 bg-muted rounded-md">
                <p className="text-sm">{message}</p>
                {message.includes("http") && (
                  <a href={message.split(" ").pop()} className="text-sm text-primary underline mt-2 block">
                    Open Login Link
                  </a>
                )}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Sending..." : "Send Magic Link"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

