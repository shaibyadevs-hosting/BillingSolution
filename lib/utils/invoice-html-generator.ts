/**
 * Shared HTML generator for invoice (used by both server and client)
 */
import type { InvoicePDFData } from "./invoice-pdf";

export function generateInvoiceHTML(data: InvoicePDFData): string {
	const formatDate = (dateStr: string) => {
		return new Date(dateStr).toLocaleDateString("en-IN", {
			day: "2-digit",
			month: "short",
			year: "numeric",
		});
	};

	const formatCurrency = (amount: number) => {
		return `₹${amount.toFixed(2)}`;
	};

	return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice ${data.invoiceNumber}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      color: #1e293b;
      background: #fff;
      padding: 20px;
      line-height: 1.6;
    }
    .invoice-container {
      max-width: 210mm;
      margin: 0 auto;
      background: white;
      padding: 30px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 30px;
      border-bottom: 3px solid #3b82f6;
      padding-bottom: 20px;
    }
    .logo-section {
      flex: 1;
    }
    .logo {
      max-width: 120px;
      max-height: 60px;
      object-fit: contain;
    }
    .business-info {
      flex: 1;
      text-align: right;
    }
    .business-name {
      font-size: 24px;
      font-weight: bold;
      color: #1e293b;
      margin-bottom: 8px;
    }
    .business-details {
      font-size: 11px;
      color: #64748b;
      line-height: 1.8;
    }
    .invoice-title {
      font-size: 36px;
      font-weight: bold;
      color: #3b82f6;
      text-align: center;
      margin: 20px 0;
    }
    .details-section {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30px;
      margin-bottom: 30px;
    }
    .detail-box {
      background: #f8fafc;
      padding: 15px;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
    }
    .detail-label {
      font-size: 11px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 5px;
    }
    .detail-value {
      font-size: 13px;
      color: #1e293b;
      font-weight: 500;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    .items-table thead {
      background: #3b82f6;
      color: white;
    }
    .items-table th {
      padding: 12px;
      text-align: left;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .items-table td {
      padding: 10px 12px;
      border-bottom: 1px solid #e2e8f0;
      font-size: 11px;
    }
    .items-table tbody tr:nth-child(even) {
      background: #f8fafc;
    }
    .text-right {
      text-align: right;
    }
    .text-center {
      text-align: center;
    }
    .totals-section {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 30px;
    }
    .totals-table {
      width: 300px;
    }
    .totals-table td {
      padding: 8px 0;
      font-size: 12px;
    }
    .totals-table td:first-child {
      color: #64748b;
    }
    .totals-table td:last-child {
      text-align: right;
      font-weight: 500;
      color: #1e293b;
    }
    .total-row {
      border-top: 2px solid #3b82f6;
      padding-top: 10px;
      margin-top: 10px;
    }
    .total-row td {
      font-size: 18px;
      font-weight: bold;
      color: #3b82f6;
    }
    .notes-section, .terms-section {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #e2e8f0;
    }
    .section-title {
      font-size: 13px;
      font-weight: bold;
      color: #1e293b;
      margin-bottom: 10px;
    }
    .section-content {
      font-size: 11px;
      color: #64748b;
      line-height: 1.8;
      white-space: pre-line;
    }
    .footer {
      margin-top: 40px;
      text-align: center;
      font-size: 11px;
      color: #64748b;
      padding-top: 20px;
      border-top: 1px solid #e2e8f0;
    }
    .served-by {
      font-size: 10px;
      color: #94a3b8;
      margin-top: 20px;
      text-align: right;
    }
  </style>
</head>
<body>
  <div class="invoice-container">
    <div class="header">
      <div class="logo-section">
        <img src="${
					data.logoUrl ||
					"data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjYwIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxMjAiIGhlaWdodD0iNjAiIGZpbGw9IiMzYjgyZjYiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjE0IiBmaWxsPSIjZmZmIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+TE9HTzwvdGV4dD48L3N2Zz4="
				}" alt="Logo" class="logo" onerror="this.style.display='none'" />
      </div>
      <div class="business-info">
        <div class="business-name">${data.businessName}</div>
        <div class="business-details">
          ${data.businessAddress ? `<div>${data.businessAddress}</div>` : ""}
          ${data.businessPhone ? `<div>Phone: ${data.businessPhone}</div>` : ""}
          ${data.businessEmail ? `<div>Email: ${data.businessEmail}</div>` : ""}
          ${data.businessGSTIN ? `<div>GSTIN: ${data.businessGSTIN}</div>` : ""}
        </div>
      </div>
    </div>

    <div class="invoice-title">INVOICE</div>

    <div class="details-section">
      <div class="detail-box">
        <div class="detail-label">Invoice Details</div>
        <div class="detail-value" style="font-size: 14px; font-weight: bold; margin-bottom: 8px;">
          Invoice #: ${data.invoiceNumber}
        </div>
        <div class="detail-value">Date: ${formatDate(data.invoiceDate)}</div>
        ${
					data.dueDate
						? `<div class="detail-value">Due Date: ${formatDate(
								data.dueDate
						  )}</div>`
						: ""
				}
      </div>
      ${
				data.customerName
					? `
      <div class="detail-box">
        <div class="detail-label">Bill To</div>
        <div class="detail-value" style="font-size: 14px; font-weight: bold; margin-bottom: 8px;">
          ${data.customerName}
        </div>
        ${
					data.customerEmail
						? `<div class="detail-value">${data.customerEmail}</div>`
						: ""
				}
        ${
					data.customerPhone
						? `<div class="detail-value">${data.customerPhone}</div>`
						: ""
				}
        ${
					data.customerGSTIN
						? `<div class="detail-value">GSTIN: ${data.customerGSTIN}</div>`
						: ""
				}
      </div>
      `
					: ""
			}
    </div>

    <table class="items-table">
      <thead>
        <tr>
          <th>Description</th>
          <th class="text-center">Qty</th>
          <th class="text-right">Unit Price</th>
          ${
						data.isGstInvoice
							? `<th class="text-center">GST %</th><th class="text-right">GST Amount</th>`
							: ""
					}
          <th class="text-right">Total</th>
        </tr>
      </thead>
      <tbody>
        ${data.items
					.map(
						(item) => `
        <tr>
          <td>${item.description}</td>
          <td class="text-center">${item.quantity}</td>
          <td class="text-right">${formatCurrency(item.unitPrice)}</td>
          ${
						data.isGstInvoice
							? `
          <td class="text-center">${item.gstRate}%</td>
          <td class="text-right">${formatCurrency(item.gstAmount)}</td>
          `
							: ""
					}
          <td class="text-right">${formatCurrency(item.lineTotal)}</td>
        </tr>
        `
					)
					.join("")}
      </tbody>
    </table>

    <div class="totals-section">
      <table class="totals-table">
        <tr>
          <td>Subtotal:</td>
          <td>${formatCurrency(data.subtotal)}</td>
        </tr>
        ${
					data.isGstInvoice
						? `
        ${
					data.cgstAmount > 0
						? `
        <tr>
          <td>CGST:</td>
          <td>${formatCurrency(data.cgstAmount)}</td>
        </tr>
        `
						: ""
				}
        ${
					data.sgstAmount > 0
						? `
        <tr>
          <td>SGST:</td>
          <td>${formatCurrency(data.sgstAmount)}</td>
        </tr>
        `
						: ""
				}
        ${
					data.igstAmount > 0
						? `
        <tr>
          <td>IGST:</td>
          <td>${formatCurrency(data.igstAmount)}</td>
        </tr>
        `
						: ""
				}
        `
						: ""
				}
        <tr class="total-row">
          <td>Total:</td>
          <td>${formatCurrency(data.totalAmount)}</td>
        </tr>
      </table>
    </div>

    ${
			data.notes
				? `
    <div class="notes-section">
      <div class="section-title">Notes:</div>
      <div class="section-content">${data.notes}</div>
    </div>
    `
				: ""
		}

    ${
			data.terms
				? `
    <div class="terms-section">
      <div class="section-title">Terms & Conditions:</div>
      <div class="section-content">${data.terms}</div>
    </div>
    `
				: ""
		}

    ${
			data.servedBy
				? `
    <div class="served-by">Served by: ${data.servedBy}</div>
    `
				: ""
		}

    <div class="footer">
      Thank you for your business!
    </div>
  </div>
</body>
</html>`;
}
