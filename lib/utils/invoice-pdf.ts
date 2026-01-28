"use client";

/**
 * Generate a beautiful, high-quality A4 invoice PDF using HTML-to-PDF conversion
 * Always uses client-side jsPDF/html2canvas for fast, reliable generation
 */
import type { InvoiceData } from "./pdf-generator";
import { generateInvoicePDFClient } from "./invoice-pdf-client";

export interface InvoicePDFData extends InvoiceData {
	businessEmail?: string;
	logoUrl?: string;
	servedBy?: string; // Employee or admin name who generated the invoice
}

export async function generateInvoicePDF(data: InvoicePDFData): Promise<Blob> {
	// Always use client-side generation - it's faster and more reliable
	// No network latency, works offline, and avoids server costs
	return await generateInvoicePDFClient(data);
}
