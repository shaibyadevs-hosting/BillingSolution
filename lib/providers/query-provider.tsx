"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ReactNode, useState } from "react"

export function QueryProvider({ children }: { children: ReactNode }) {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        // Cache data for 5 minutes (data is considered fresh for 5 minutes)
                        staleTime: 5 * 60 * 1000,
                        // Keep unused data in cache for 30 minutes (longer for better navigation experience)
                        gcTime: 30 * 60 * 1000,
                        // Retry failed requests once
                        retry: 1,
                        // Only refetch on window focus if data is stale (not always)
                        refetchOnWindowFocus: false,
                        // Don't refetch on mount if data exists in cache
                        refetchOnMount: false,
                        // Don't refetch on reconnect if data exists
                        refetchOnReconnect: false,
                    },
                },
            })
    )

    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
