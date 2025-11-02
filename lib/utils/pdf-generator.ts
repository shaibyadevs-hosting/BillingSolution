import jsPDF from "jspdf"
import "jspdf-autotable"

export interface InvoiceData {
  invoiceNumber: string
  invoiceDate: string
  dueDate?: string
  customerName?: string
  customerEmail?: string
  customerPhone?: string
  customerGSTIN?: string
  businessName: string
  businessGSTIN?: string
  businessAddress?: string
  businessPhone?: string
  items: Array<{
    description: string
    quantity: number
    unitPrice: number
    discountPercent: number
    gstRate: number
    lineTotal: number
    gstAmount: number
  }>
  subtotal: number
  cgstAmount: number
  sgstAmount: number
  igstAmount: number
  totalAmount: number
  notes?: string
  terms?: string
  isGstInvoice: boolean
}

export function generateInvoicePDF(data: InvoiceData): void {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  let yPosition = 10

  // Header
  doc.setFontSize(20)
  doc.text("INVOICE", pageWidth / 2, yPosition, { align: "center" })
  yPosition += 10

  // Business Info
  doc.setFontSize(10)
  doc.text(`${data.businessName}`, 10, yPosition)
  yPosition += 5
  if (data.businessGSTIN) {
    doc.text(`GSTIN: ${data.businessGSTIN}`, 10, yPosition)
    yPosition += 5
  }
  if (data.businessAddress) {
    doc.text(`Address: ${data.businessAddress}`, 10, yPosition)
    yPosition += 5
  }
  if (data.businessPhone) {
    doc.text(`Phone: ${data.businessPhone}`, 10, yPosition)
    yPosition += 5
  }

  yPosition += 5

  // Invoice Details
  doc.setFontSize(9)
  doc.text(`Invoice #: ${data.invoiceNumber}`, 10, yPosition)
  doc.text(`Date: ${new Date(data.invoiceDate).toLocaleDateString()}`, pageWidth / 2, yPosition)
  yPosition += 5
  if (data.dueDate) {
    doc.text(`Due Date: ${new Date(data.dueDate).toLocaleDateString()}`, pageWidth / 2, yPosition)
    yPosition += 5
  }

  yPosition += 5

  // Customer Info
  if (data.customerName) {
    doc.setFontSize(10)
    doc.text("Bill To:", 10, yPosition)
    yPosition += 5
    doc.setFontSize(9)
    doc.text(data.customerName, 10, yPosition)
    yPosition += 4
    if (data.customerEmail) {
      doc.text(`Email: ${data.customerEmail}`, 10, yPosition)
      yPosition += 4
    }
    if (data.customerPhone) {
      doc.text(`Phone: ${data.customerPhone}`, 10, yPosition)
      yPosition += 4
    }
    if (data.customerGSTIN) {
      doc.text(`GSTIN: ${data.customerGSTIN}`, 10, yPosition)
      yPosition += 4
    }
  }

  yPosition += 5

  // Items Table
  const tableColumns = data.isGstInvoice
    ? ["Description", "Qty", "Unit Price", "Discount %", "GST %", "GST Amount", "Total"]
    : ["Description", "Qty", "Unit Price", "Discount %", "Total"]

  const tableData = data.items.map((item) => {
    // Ensure all numeric values are defined and numbers
    const unitPrice = Number(item.unitPrice) || 0
    const discountPercent = Number(item.discountPercent) || 0
    const gstRate = Number(item.gstRate) || 0
    const gstAmount = Number(item.gstAmount) || 0
    const lineTotal = Number(item.lineTotal) || 0
    const quantity = Number(item.quantity) || 0
    
    return data.isGstInvoice
      ? [
          item.description || '',
          quantity.toString(),
          `₹${unitPrice.toFixed(2)}`,
          `${discountPercent}%`,
          `${gstRate}%`,
          `₹${gstAmount.toFixed(2)}`,
          `₹${lineTotal.toFixed(2)}`,
        ]
      : [
          item.description || '',
          quantity.toString(),
          `₹${unitPrice.toFixed(2)}`,
          `${discountPercent}%`,
          `₹${lineTotal.toFixed(2)}`,
        ]
  })
  ;(doc as any).autoTable({
    columns: tableColumns,
    body: tableData,
    startY: yPosition,
    theme: "grid",
    headStyles: { fillColor: [41, 128, 185], textColor: 255 },
    bodyStyles: { textColor: 0 },
    alternateRowStyles: { fillColor: [245, 245, 245] },
  })

  yPosition = (doc as any).lastAutoTable.finalY + 10

  // Totals
  doc.setFontSize(10)
  const totalX = pageWidth - 60

  doc.text("Subtotal:", totalX, yPosition)
  doc.text(`₹${data.subtotal.toFixed(2)}`, pageWidth - 10, yPosition, { align: "right" })
  yPosition += 6

  if (data.isGstInvoice) {
    if (data.cgstAmount > 0) {
      doc.text("CGST:", totalX, yPosition)
      doc.text(`₹${data.cgstAmount.toFixed(2)}`, pageWidth - 10, yPosition, { align: "right" })
      yPosition += 6
    }
    if (data.sgstAmount > 0) {
      doc.text("SGST:", totalX, yPosition)
      doc.text(`₹${data.sgstAmount.toFixed(2)}`, pageWidth - 10, yPosition, { align: "right" })
      yPosition += 6
    }
    if (data.igstAmount > 0) {
      doc.text("IGST:", totalX, yPosition)
      doc.text(`₹${data.igstAmount.toFixed(2)}`, pageWidth - 10, yPosition, { align: "right" })
      yPosition += 6
    }
  }

  doc.setFontSize(12)
  doc.setFont(undefined, "bold")
  doc.text("Total:", totalX, yPosition)
  doc.text(`₹${data.totalAmount.toFixed(2)}`, pageWidth - 10, yPosition, { align: "right" })

  yPosition += 10

  // Notes and Terms
  if (data.notes || data.terms) {
    doc.setFontSize(9)
    doc.setFont(undefined, "normal")
    if (data.notes) {
      doc.text("Notes:", 10, yPosition)
      yPosition += 4
      const notesLines = doc.splitTextToSize(data.notes, pageWidth - 20)
      doc.text(notesLines, 10, yPosition)
      yPosition += notesLines.length * 4 + 5
    }
    if (data.terms) {
      doc.text("Terms & Conditions:", 10, yPosition)
      yPosition += 4
      const termsLines = doc.splitTextToSize(data.terms, pageWidth - 20)
      doc.text(termsLines, 10, yPosition)
    }
  }

  // Download
  doc.save(`Invoice_${data.invoiceNumber}.pdf`)
}
