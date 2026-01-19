/**
 * Generate WhatsApp-friendly mini bill message
 */
export interface MiniBillData {
  storeName: string
  invoiceNumber: string
  invoiceDate: string
  items: Array<{
    name: string
    quantity: number
    unitPrice: number
  }>
  totalAmount: number
  pdfR2Url: string // REQUIRED: Cloudflare R2 URL for PDF (no fallback)
}

export function generateWhatsAppBillMessage(data: MiniBillData): string {
  const { storeName, invoiceNumber, invoiceDate, items, totalAmount, pdfR2Url } = data

  // Validate that pdfR2Url is provided (required)
  if (!pdfR2Url || pdfR2Url.trim() === '') {
    throw new Error('pdfR2Url is required for WhatsApp message generation')
  }

  // Format date
  const date = new Date(invoiceDate)
  const formattedDate = date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })

  // Build items list
  const itemsList = items
    .map((item, index) => {
      const lineTotal = item.quantity * item.unitPrice
      return `${index + 1}. ${item.name}\n   Qty: ${item.quantity} × ₹${item.unitPrice.toFixed(2)} = ₹${lineTotal.toFixed(2)}`
    })
    .join('\n\n')

  // Build message - ALWAYS use R2 URL (no fallback)
  const message = `📋 *Invoice Receipt*

🏪 *${storeName}*

━━━━━━━━━━━━━━━━━━━━
📄 Invoice #${invoiceNumber}
📅 Date: ${formattedDate}
━━━━━━━━━━━━━━━━━━━━

*Items:*
${itemsList}

━━━━━━━━━━━━━━━━━━━━
💰 *Total: ₹${totalAmount.toFixed(2)}*
━━━━━━━━━━━━━━━━━━━━

📄 Download Invoice PDF:
${pdfR2Url}

Thank you for your business! 🙏`

  return message
}

// Global flag to prevent multiple WhatsApp windows
let whatsappWindowOpen = false
let whatsappWindow: Window | null = null
let lastWhatsAppUrl: string | null = null
let lastOpenTime: number = 0

/**
 * Share invoice on WhatsApp - OPTIMIZED: Opens immediately to preserve user gesture
 * 
 * CRITICAL: Opens WhatsApp synchronously to preserve user gesture context.
 * Uses a global flag to prevent multiple windows from opening.
 * 
 * @returns Object with success status
 */
export async function shareOnWhatsApp(
  message: string
): Promise<{ success: boolean }> {
  // Only run on client side
  if (typeof window === 'undefined') {
    console.error('[WhatsAppShare] Cannot run on server side')
    return { success: false }
  }

  const encodedMessage = encodeURIComponent(message)
  const whatsappUrl = `https://wa.me/?text=${encodedMessage}`
  
  // Prevent duplicate opens: Check if same URL was opened recently (within 3 seconds)
  const now = Date.now()
  if (lastWhatsAppUrl === whatsappUrl && (now - lastOpenTime) < 3000) {
    console.warn('[WhatsAppShare] Duplicate WhatsApp open detected and prevented')
    return { success: true } // Return success to avoid error, but don't open again
  }
  
  // Also check if window is already open
  if (whatsappWindowOpen && whatsappWindow && !whatsappWindow.closed) {
    console.warn('[WhatsAppShare] WhatsApp window already open, preventing duplicate')
    return { success: true }
  }

  // Prevent multiple WhatsApp windows
  if (whatsappWindowOpen && whatsappWindow && !whatsappWindow.closed) {
    console.warn('[WhatsAppShare] WhatsApp window already open, closing previous window')
    try {
      whatsappWindow.close()
      whatsappWindow = null
      whatsappWindowOpen = false
    } catch (e) {
      // Ignore close errors
    }
  }

  try {
    // Set flags BEFORE opening to prevent race conditions
    lastWhatsAppUrl = whatsappUrl
    lastOpenTime = now
    whatsappWindowOpen = true
    
    // Method 1: PRIMARY - window.open (synchronous to preserve user gesture)
    whatsappWindow = window.open(whatsappUrl, '_blank', 'noopener,noreferrer')
    
    // Validate immediately - check if window opened successfully
    if (whatsappWindow !== null && typeof whatsappWindow !== 'undefined' && whatsappWindow.closed === false) {
      console.log('[WhatsAppShare] window.open succeeded - WhatsApp opened')
      
      // Reset flag after window closes (check after 2 seconds)
      setTimeout(() => {
        if (whatsappWindow && whatsappWindow.closed) {
          whatsappWindowOpen = false
          whatsappWindow = null
          lastWhatsAppUrl = null
        }
      }, 2000)
      
      return { success: true }
    }
    
    // If window.open returned null/undefined, it was blocked
    // CRITICAL: Reset flag BEFORE trying fallback to prevent double-open
    whatsappWindowOpen = false
    
    // Method 2: FALLBACK - Create and click link (only if window.open was blocked)
    console.warn('[WhatsAppShare] window.open was blocked, trying link method...')
    try {
      const link = document.createElement('a')
      link.href = whatsappUrl
      link.target = '_blank'
      link.rel = 'noopener noreferrer'
      link.style.display = 'none'
      document.body.appendChild(link)
      
      // Set flag before clicking to prevent race conditions
      whatsappWindowOpen = true
      link.click()
      console.log('[WhatsAppShare] Link clicked successfully')
      
      // Clean up after a short delay (non-blocking)
      setTimeout(() => {
        if (document.body.contains(link)) {
          document.body.removeChild(link)
        }
      }, 1000)
      
      // Reset flag after delay
      setTimeout(() => {
        whatsappWindowOpen = false
        lastWhatsAppUrl = null
      }, 2000)
      
      return { success: true }
    } catch (linkError) {
      console.error('[WhatsAppShare] Link method failed:', linkError)
      whatsappWindowOpen = false
      lastWhatsAppUrl = null
      return { success: false }
    }
  } catch (error) {
    console.error('[WhatsAppShare] Failed to open WhatsApp:', error)
    whatsappWindowOpen = false
    lastWhatsAppUrl = null
    return { success: false }
  }
}
