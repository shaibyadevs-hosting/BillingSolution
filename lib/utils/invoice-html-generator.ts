/**
 * Shared HTML generator for invoice (used by both server and client)
 * Redesigned to match Performa Invoice format
 */
import type { InvoicePDFData } from "./invoice-pdf";

// Helper function to convert number to words (Indian numbering system)
function numberToWords(num: number): string {
	const ones = [
		"", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
		"Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
		"Seventeen", "Eighteen", "Nineteen"
	];
	const tens = [
		"", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"
	];

	if (num === 0) return "Zero";

	function convertHundreds(n: number): string {
		let result = "";
		if (n >= 100) {
			result += ones[Math.floor(n / 100)] + " Hundred ";
			n %= 100;
		}
		if (n >= 20) {
			result += tens[Math.floor(n / 10)] + " ";
			n %= 10;
		}
		if (n > 0) {
			result += ones[n] + " ";
		}
		return result.trim();
	}

	const crores = Math.floor(num / 10000000);
	const lakhs = Math.floor((num % 10000000) / 100000);
	const thousands = Math.floor((num % 100000) / 1000);
	const hundreds = num % 1000;

	let words = "";
	if (crores > 0) words += convertHundreds(crores) + " Crore ";
	if (lakhs > 0) words += convertHundreds(lakhs) + " Lakh ";
	if (thousands > 0) words += convertHundreds(thousands) + " Thousand ";
	if (hundreds > 0) words += convertHundreds(hundreds);

	const paise = Math.round((num % 1) * 100);
	if (paise > 0) {
		words += " and " + convertHundreds(paise) + " Paise";
	}

	return words.trim() + " Rupees Only";
}

export function generateInvoiceHTML(data: InvoicePDFData & {
	proprietor?: string;
	bankName?: string;
	accountName?: string;
	accountNumber?: string;
	ifscCode?: string;
	invoiceType?: string;
}): string {
	const formatDate = (dateStr: string) => {
		const date = new Date(dateStr);
		return date.toLocaleDateString("en-IN", {
			day: "2-digit",
			month: "2-digit",
			year: "numeric",
		});
	};

	const formatCurrency = (amount: number) => {
		return amount.toLocaleString("en-IN", {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2,
		});
	};

	const invoiceType = data.invoiceType || "Performa Invoice";
	const proprietor = (data as any).proprietor || "";
	const bankName = (data as any).bankName || "";
	const accountName = (data as any).accountName || "";
	const accountNumber = (data as any).accountNumber || "";
	const ifscCode = (data as any).ifscCode || "";

	return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${invoiceType} ${data.invoiceNumber}</title>
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
      font-family: 'Arial', 'Helvetica', sans-serif;
      color: #000;
      background: #fff;
      padding: 15mm;
      line-height: 1.4;
    }
    .invoice-container {
      max-width: 210mm;
      margin: 0 auto;
      background: white;
      border: 2px solid #dc2626;
      padding: 10mm;
      position: relative;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 15px;
      border-bottom: 2px solid #dc2626;
      padding-bottom: 10px;
    }
    .logo-section {
      flex: 0 0 100px;
    }
    .logo {
      max-width: 100px;
      max-height: 80px;
      object-fit: contain;
    }
    .business-info {
      flex: 1;
      text-align: center;
    }
    .business-name {
      font-size: 18px;
      font-weight: bold;
      color: #dc2626;
      margin-bottom: 5px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .business-details {
      font-size: 11px;
      color: #000;
      line-height: 1.6;
    }
    .business-details div {
      margin-bottom: 2px;
    }
    .invoice-title {
      font-size: 20px;
      font-weight: bold;
      color: #dc2626;
      text-align: center;
      margin: 15px 0;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .invoice-header-info {
      display: flex;
      justify-content: space-between;
      margin-bottom: 15px;
      font-size: 12px;
    }
    .invoice-number {
      font-weight: bold;
    }
    .customer-section {
      margin-bottom: 15px;
      font-size: 12px;
    }
    .customer-section div {
      margin-bottom: 3px;
    }
    .customer-label {
      font-weight: bold;
      display: inline-block;
      width: 120px;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 15px;
      font-size: 11px;
      border: 1px solid #000;
    }
    .items-table thead {
      background: #dc2626;
      color: white;
    }
    .items-table th {
      padding: 8px 5px;
      text-align: left;
      font-size: 10px;
      font-weight: bold;
      text-transform: uppercase;
      border: 1px solid #000;
    }
    .items-table th.text-center {
      text-align: center;
    }
    .items-table th.text-right {
      text-align: right;
    }
    .items-table td {
      padding: 6px 5px;
      border: 1px solid #000;
      font-size: 11px;
      vertical-align: top;
    }
    .items-table td.text-center {
      text-align: center;
    }
    .items-table td.text-right {
      text-align: right;
    }
    .description-cell {
      text-align: left;
      line-height: 1.3;
    }
    .total-section {
      margin-top: 15px;
      margin-bottom: 15px;
      font-size: 12px;
    }
    .total-amount {
      text-align: right;
      font-weight: bold;
      margin-bottom: 10px;
    }
    .total-words {
      margin-top: 10px;
      font-size: 11px;
      font-style: italic;
    }
    .footer-section {
      display: flex;
      justify-content: space-between;
      margin-top: 20px;
      font-size: 11px;
    }
    .bank-details {
      flex: 1;
    }
    .bank-details-title {
      font-weight: bold;
      margin-bottom: 5px;
      color: #dc2626;
    }
    .bank-details div {
      margin-bottom: 2px;
    }
    .terms-section {
      margin-top: 10px;
      font-size: 10px;
    }
    .terms-section div {
      margin-bottom: 3px;
    }
    .signature-section {
      text-align: right;
      margin-top: 30px;
      font-size: 11px;
    }
    .signature-line {
      border-top: 1px solid #000;
      width: 200px;
      margin-left: auto;
      margin-top: 40px;
      padding-top: 5px;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="invoice-container">
    <!-- Header with Logo and Business Info -->
    <div class="header">
      <div class="logo-section">
        <img src="${
					data.logoUrl ||
					"data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjgwIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxMDAiIGhlaWdodD0iODAiIGZpbGw9IiNkYzI2MjYiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjEyIiBmaWxsPSIjZmZmIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+TE9HTzwvdGV4dD48L3N2Zz4="
				}" alt="Logo" class="logo" onerror="this.style.display='none'" />
      </div>
      <div class="business-info">
        <div class="business-name">${data.businessName || "BUSINESS NAME"}</div>
        <div class="business-details">
          ${proprietor ? `<div>Proprietor - ${proprietor}</div>` : ""}
          ${data.businessPhone ? `<div>Mo-${data.businessPhone}</div>` : ""}
          ${data.businessGSTIN ? `<div>GST No - ${data.businessGSTIN}</div>` : ""}
          ${data.businessAddress ? `<div>Address - ${data.businessAddress}</div>` : ""}
          ${data.businessEmail ? `<div>Email - ${data.businessEmail}</div>` : ""}
        </div>
      </div>
    </div>

    <!-- Invoice Title -->
    <div class="invoice-title">${invoiceType}</div>

    <!-- Invoice Number and Date -->
    <div class="invoice-header-info">
      <div class="invoice-number">Invoice No. ${data.invoiceNumber}</div>
      <div>Invoice Date: ${formatDate(data.invoiceDate)}</div>
    </div>

    <!-- Customer Information -->
    <div class="customer-section">
      <div><span class="customer-label">Customer Name:</span>${data.customerName || ""}</div>
      <div><span class="customer-label">Address:</span>${data.customerAddress || data.customerBillingAddress || ""}</div>
      <div><span class="customer-label">Phone:</span>${data.customerPhone || ""}</div>
    </div>

    <!-- Items Table -->
    <table class="items-table">
      <thead>
        <tr>
          <th style="width: 5%;">SL.NO.</th>
          <th style="width: 50%;">MACHINERY DESCRIPTION</th>
          <th class="text-center" style="width: 10%;">QTY</th>
          <th class="text-center" style="width: 15%;">GST - HSN</th>
          <th class="text-right" style="width: 20%;">AMOUNT RS.</th>
        </tr>
      </thead>
      <tbody>
        ${data.items
					.map(
						(item, index) => `
        <tr>
          <td class="text-center">${String(index + 1).padStart(2, "0")}</td>
          <td class="description-cell">${item.description || ""}</td>
          <td class="text-center">${item.quantity || ""}</td>
          <td class="text-center">${item.hsnCode || ""}</td>
          <td class="text-right">${formatCurrency(item.lineTotal)}</td>
        </tr>
        `
					)
					.join("")}
        <tr>
          <td colspan="4" class="text-right" style="font-weight: bold; padding: 10px 5px;">Total Amount Rs.</td>
          <td class="text-right" style="font-weight: bold; padding: 10px 5px;">${formatCurrency(data.totalAmount)}</td>
        </tr>
      </tbody>
    </table>

    <!-- Total in Words -->
    <div class="total-words">
      <strong>Total Rupees in Words:</strong> ${numberToWords(data.totalAmount)}
    </div>

    <!-- Footer: Bank Details and Terms -->
    <div class="footer-section">
      <div class="bank-details">
        ${bankName || accountName || accountNumber || ifscCode ? `
        <div class="bank-details-title">Dealer Bank Details</div>
        ${bankName ? `<div>${bankName}</div>` : ""}
        ${accountName ? `<div>A/c. Name - ${accountName}</div>` : ""}
        ${accountNumber ? `<div>Account No.${accountNumber}</div>` : ""}
        ${ifscCode ? `<div>IFSC-${ifscCode}</div>` : ""}
        ` : ""}
        ${data.terms ? `
        <div class="terms-section">
          ${data.terms.split('\n').map(term => `<div>${term}</div>`).join('')}
        </div>
        ` : ""}
      </div>
    </div>

    <!-- Signature -->
    <div class="signature-section">
      <div class="signature-line">
        Authorize Dealer Signature
      </div>
    </div>
  </div>
</body>
</html>`;

}
