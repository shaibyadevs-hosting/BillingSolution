"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Lock, ArrowLeft } from "lucide-react"
import Link from "next/link"

const ADMIN_PIN = "1234"
const PIN_SESSION_KEY = "admin_pin_auth"
const PIN_SESSION_DURATION = 30 * 60 * 1000 // 30 minutes

export default function SecretAdminLoginPage() {
  const router = useRouter()
  const [pin, setPin] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    // Check if already authenticated
    const pinAuth = sessionStorage.getItem(PIN_SESSION_KEY)
    if (pinAuth) {
      const { timestamp } = JSON.parse(pinAuth)
      const now = Date.now()
      if (now - timestamp < PIN_SESSION_DURATION) {
        router.push("/admin/ckejwngw242r1")
        return
      } else {
        sessionStorage.removeItem(PIN_SESSION_KEY)
      }
    }
  }, [router])

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (pin.trim() !== ADMIN_PIN) {
      setError("Invalid PIN. Please enter the correct 4-digit PIN.")
      return
    }

    // Store PIN auth with timestamp
    sessionStorage.setItem(PIN_SESSION_KEY, JSON.stringify({
      authenticated: true,
      timestamp: Date.now()
    }))

    router.push("/admin/ckejwngw242r1")
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-muted/40 p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2 mb-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/")}
              className="h-8 w-8"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Lock className="h-5 w-5 text-primary" />
            <div className="flex-1">
              <CardTitle className="text-2xl font-bold">Admin Access</CardTitle>
              <CardDescription>Enter PIN to access admin management</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pin">Security PIN</Label>
              <Input
                id="pin"
                type="password"
                inputMode="numeric"
                maxLength={4}
                placeholder="Enter 4-digit PIN"
                required
                value={pin}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, "").slice(0, 4)
                  setPin(value)
                  if (error) setError(null)
                }}
                disabled={isLoading}
                className="text-center text-2xl tracking-widest font-mono"
              />
            </div>
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Verifying..." : "Access Admin Panel"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
