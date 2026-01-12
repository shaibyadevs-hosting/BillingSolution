"use client"

import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Receipt, Users, Package, BarChart3, Wifi, Shield } from "lucide-react"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

export default function LandingPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const checkAuth = async () => {
      // Check for employee session
      const authType = localStorage.getItem("authType")
      if (authType === "employee") {
        setIsAuthenticated(true)
        setIsLoading(false)
        return
      }

      // Check for Supabase user
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setIsAuthenticated(!!user)
      setIsLoading(false)
    }

    checkAuth()
  }, [])

  const handleGoToDashboard = () => {
    router.push("/dashboard")
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="border-b bg-background">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Receipt className="h-6 w-6" />
            <span className="text-xl font-bold">Billing Solutions</span>
          </div>
          <div className="flex items-center gap-4">
            {!isLoading && (
              <>
                {isAuthenticated ? (
                  <Button onClick={handleGoToDashboard}>Go to Dashboard</Button>
                ) : (
                  <>
                    <Button asChild variant="ghost">
                      <Link href="/auth/login">Admin/Public Login</Link>
                    </Button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <h1 className="mb-6 text-balance text-5xl font-bold tracking-tight lg:text-6xl">
          Smart Billing for Small Businesses
        </h1>
        <p className="mx-auto mb-8 max-w-2xl text-balance text-xl text-muted-foreground">
          Manage products, create GST invoices, track customers, and generate reports. Works offline, syncs
          automatically.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Button asChild size="lg" variant="outline">
            <Link href="/auth/login">Admin/Public Login</Link>
          </Button>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-4">
          <Button asChild size="lg" variant="secondary">
            <Link href="/auth/employee-login">Employee Login</Link>
          </Button>
        </div>
      </section>

      {/* Features Section */}
      <section className="border-t bg-muted/40 py-20">
        <div className="container mx-auto px-4">
          <h2 className="mb-12 text-center text-3xl font-bold">Everything you need to manage your business</h2>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Receipt className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-xl font-semibold">GST Invoicing</h3>
              <p className="text-muted-foreground">
                Create professional GST and Non-GST invoices with automatic tax calculations
              </p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Package className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-xl font-semibold">Product Management</h3>
              <p className="text-muted-foreground">
                Track inventory, manage stock levels, and organize products by category
              </p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Users className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-xl font-semibold">Customer Database</h3>
              <p className="text-muted-foreground">Store customer details, purchase history, and contact information</p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <BarChart3 className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-xl font-semibold">Reports & Analytics</h3>
              <p className="text-muted-foreground">Generate sales reports, tax summaries, and inventory insights</p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Wifi className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-xl font-semibold">Offline First</h3>
              <p className="text-muted-foreground">Work without internet, data syncs automatically when online</p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Shield className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-xl font-semibold">Secure & Private</h3>
              <p className="text-muted-foreground">Your data is encrypted and protected with row-level security</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="mb-4 text-3xl font-bold">Ready to streamline your billing?</h2>
          <p className="mb-8 text-xl text-muted-foreground">
            Join hundreds of small businesses using Billing Solutions
          </p>
          <Button asChild size="lg">
            <Link href="/auth/login">Admin/Public Login</Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-muted/40 py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>&copy; 2025 Billing Solutions. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
