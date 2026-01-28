/**
 * Shared HTML generator for invoice (used by both server and client)
 */
import type { InvoicePDFData } from "./invoice-pdf";

export function generateInvoiceHTML(data: InvoicePDFData): string {
	const formatDate = (dateStr: string) => {
		const date = new Date(dateStr);
		return date.toLocaleDateString("en-IN", {
			day: "2-digit",
			month: "short",
			year: "numeric",
		});
	};

	const formatCurrency = (amount: number) => {
		return `₹${amount.toLocaleString("en-IN", {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2,
		})}`;
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
    @page {
      size: A4;
      margin: 0;
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
    }
    .logo-section {
      flex: 0 0 120px;
    }
    .logo {
      max-width: 120px;
      max-height: 80px;
      object-fit: contain;
    }
    .business-info {
      flex: 1;
      text-align: right;
    }
    .business-name {
      font-size: 20px;
      font-weight: bold;
      color: #1e293b;
      margin-bottom: 8px;
      text-transform: uppercase;
    }
    .business-details {
      font-size: 11px;
      color: #64748b;
      line-height: 1.8;
    }
    .invoice-title {
      font-size: 28px;
      font-weight: bold;
      color: #1e293b;
      text-align: center;
      margin: 20px 0;
      text-transform: uppercase;
      letter-spacing: 1px;
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
      border-radius: 4px;
      border: 1px solid #e2e8f0;
    }
    .detail-label {
      font-size: 10px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
      font-weight: 600;
    }
    .detail-value {
      font-size: 13px;
      color: #1e293b;
      font-weight: 500;
      margin-bottom: 4px;
    }
    .detail-value.bold {
      font-size: 14px;
      font-weight: bold;
      margin-bottom: 8px;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
      font-size: 11px;
      page-break-inside: auto;
    }
    .items-table thead {
      background: #1e293b;
      color: white;
      display: table-header-group;
    }
    .items-table tbody {
      display: table-row-group;
    }
    .items-table th {
      padding: 10px 8px;
      text-align: left;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .items-table th.text-center {
      text-align: center;
    }
    .items-table th.text-right {
      text-align: right;
    }
    .items-table td {
      padding: 8px;
      border-bottom: 1px solid #e2e8f0;
      font-size: 11px;
    }
    .items-table tbody tr {
      page-break-inside: avoid;
      page-break-after: auto;
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
      page-break-inside: avoid;
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
      text-align: left;
    }
    .totals-table td:last-child {
      text-align: right;
      font-weight: 500;
      color: #1e293b;
    }
    .total-row {
      border-top: 2px solid #1e293b;
      padding-top: 10px;
      margin-top: 10px;
      page-break-inside: avoid;
    }
    .total-row td {
      font-size: 18px;
      font-weight: bold;
      color: #1e293b;
    }
    .payment-section {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #e2e8f0;
      page-break-inside: avoid;
    }
    /* Ensure critical sections stay together */
    .items-wrapper {
      page-break-inside: auto;
    }
    .totals-wrapper {
      page-break-inside: avoid;
      page-break-before: auto;
    }
    .qr-section {
      flex: 0 0 150px;
    }
    .qr-placeholder {
      width: 120px;
      height: 120px;
      background: #000;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 8pt;
      text-align: center;
      padding: 10px;
      margin-bottom: 8px;
    }
    .qr-label {
      font-size: 9pt;
      text-align: center;
      color: #64748b;
    }
    .thank-you {
      flex: 1;
      text-align: right;
      font-size: 13px;
      color: #1e293b;
      font-weight: 500;
      padding-top: 40px;
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
					"data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjgwIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxMjAiIGhlaWdodD0iODAiIGZpbGw9IiMxZTI5M2IiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjE0IiBmaWxsPSIjZmZmIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+TE9HTzwvdGV4dD48L3N2Zz4="
				}" alt="Logo" class="logo" onerror="this.style.display='none'" />
      </div>
      <div class="business-info">
        <div class="business-name">${data.businessName || "BUSINESS NAME"}</div>
        <div class="business-details">
          ${data.businessAddress ? `<div>${data.businessAddress}</div>` : ""}
          ${(data.isB2B || data.businessGSTIN) ? `<div>GSTIN: ${data.businessGSTIN || "N/A"}</div>` : ""}
          ${(data.isB2B && data.businessPhone) ? `<div>Phone: ${data.businessPhone}</div>` : ""}
          ${(data.isB2B && data.businessEmail) ? `<div>Email: ${data.businessEmail}</div>` : ""}
        </div>
      </div>
    </div>

    <div class="invoice-title">${data.isB2B ? "TAX INVOICE (B2B)" : "TAX INVOICE (B2C)"}</div>

    <div class="details-section">
      ${data.customerName ? `
      <div class="detail-box">
        <div class="detail-label">Bill To:</div>
        <div class="detail-value bold">${data.customerName}</div>
        ${(data.isB2B && data.customerBillingAddress) || data.customerAddress ? `<div class="detail-value">${data.customerBillingAddress || data.customerAddress}</div>` : ""}
        ${(data.isB2B && data.customerCity) ? `<div class="detail-value">${data.customerCity}${data.customerState ? `, ${data.customerState}` : ""}${data.customerPincode ? ` - ${data.customerPincode}` : ""}</div>` : ""}
        ${data.customerEmail ? `<div class="detail-value">Email: ${data.customerEmail}</div>` : ""}
        ${data.customerPhone ? `<div class="detail-value">Phone: ${data.customerPhone}</div>` : ""}
        ${(data.isB2B || data.customerGSTIN) ? `<div class="detail-value">GSTIN: ${data.customerGSTIN || "N/A"}</div>` : ""}
        ${!data.isB2B ? `<div class="detail-value" style="margin-top: 8px; font-size: 10px; color: #94a3b8;">(Consumer - Unregistered)</div>` : ""}
      </div>
      ` : `
      <div class="detail-box">
        <div class="detail-label">Bill To:</div>
        <div class="detail-value" style="color: #94a3b8;">Not specified</div>
      </div>
      `}
      <div class="detail-box">
        <div class="detail-label">Invoice Details</div>
        <div class="detail-value bold">Invoice No: ${data.invoiceNumber}</div>
        <div class="detail-value">Date: ${formatDate(data.invoiceDate)}</div>
        ${data.dueDate ? `<div class="detail-value">Due Date: ${formatDate(data.dueDate)}</div>` : ""}
      </div>
    </div>

    <div class="items-wrapper">
      <table class="items-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Item Description</th>
            <th class="text-center">HSN</th>
            <th class="text-center">Qty</th>
            <th class="text-right">Rate</th>
            <th class="text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${data.items
					.map(
						(item, index) => `
          <tr>
            <td>${index + 1}</td>
            <td>${item.description}</td>
            <td class="text-center">${item.hsnCode || "-"}</td>
            <td class="text-center">${item.quantity}</td>
            <td class="text-right">${formatCurrency(item.unitPrice)}</td>
            <td class="text-right">${formatCurrency(item.lineTotal)}</td>
          </tr>
          `
					)
					.join("")}
        </tbody>
      </table>
    </div>

    <div class="totals-wrapper">
    <div class="totals-section">
      <table class="totals-table">
        <tr>
          <td>Sub Total:</td>
          <td>${formatCurrency(data.subtotal)}</td>
        </tr>
        ${
					data.isGstInvoice
						? `
        ${
					data.cgstAmount > 0
						? (() => {
							// Calculate GST percentage from items (average or first item's rate)
							const avgGstRate = data.items.length > 0 
								? Math.round(data.items.reduce((sum, item) => sum + item.gstRate, 0) / data.items.length)
								: 0;
							const gstPercent = avgGstRate > 0 ? ` (${Math.round(avgGstRate / 2)}%)` : '';
							return `
        <tr>
          <td>CGST${gstPercent}:</td>
          <td>${formatCurrency(data.cgstAmount)}</td>
        </tr>
        `;
						})()
						: ""
				}
        ${
					data.sgstAmount > 0
						? (() => {
							// Calculate GST percentage from items (average or first item's rate)
							const avgGstRate = data.items.length > 0 
								? Math.round(data.items.reduce((sum, item) => sum + item.gstRate, 0) / data.items.length)
								: 0;
							const gstPercent = avgGstRate > 0 ? ` (${Math.round(avgGstRate / 2)}%)` : '';
							return `
        <tr>
          <td>SGST${gstPercent}:</td>
          <td>${formatCurrency(data.sgstAmount)}</td>
        </tr>
        `;
						})()
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
          <td>GRAND TOTAL:</td>
          <td>${formatCurrency(data.totalAmount)}</td>
        </tr>
      </table>
    </div>
    </div>

    <div class="payment-section">
      <div class="qr-section">
        <div class="qr-placeholder">
          [ UPI QR Code ]
        </div>
        <div class="qr-label">Scan to Pay</div>
      </div>
      <div class="thank-you">
        Thank you for your business!
      </div>
    </div>

    ${
			data.servedBy
				? `
    <div class="served-by">Served by: ${data.servedBy}</div>
    `
				: ""
		}
  </div>
</body>
</html>`;

}
