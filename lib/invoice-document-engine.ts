/**
 * Unified Invoice Document Engine
 *
 * Single source of truth for all invoice document operations:
 * - Data fetching (IndexedDB + Supabase)
 * - Data normalization
 * - PDF generation (Invoice A4 + Slip 80mm)
 * - Actions (Print, Download, WhatsApp, R2 Upload)
 *
 * Architecture:
 * - UI components call executeInvoiceAction() only
 * - All business logic lives here
 * - No duplicate data preparation
 * - Intelligent generation mode selection
 */

"use client";

import { createClient } from "@/lib/supabase/client";
import { db } from "@/lib/dexie-client";
import { isIndexedDbMode } from "@/lib/utils/db-mode";
import {
	generateInvoicePDF,
	type InvoicePDFData,
} from "@/lib/utils/invoice-pdf";
import {
	generateInvoiceSlipPDF,
	type InvoiceSlipData,
} from "@/lib/utils/invoice-slip-pdf";
import {
	generateWhatsAppBillMessage,
	shareOnWhatsApp,
} from "@/lib/utils/whatsapp-bill";
import {
	getInvoiceStorage,
	saveInvoiceStorage,
} from "@/lib/utils/save-invoice-storage";
import { calculateLineItem } from "@/lib/utils/gst-calculator";
import { uploadInvoicePDFToR2Client } from "@/lib/utils/invoice-r2-client";

// ============================================================================
// TYPES
// ============================================================================

export type DocumentFormat = "invoice" | "slip";
export type DocumentAction = "print" | "download" | "whatsapp" | "r2-upload";

export interface InvoiceDocumentSource {
	invoice: any;
	items?: any[];
	customer?: any;
	store?: any;
	profile?: any;
	storeName?: string;
}

export interface InvoiceDocumentData {
	invoiceNumber: string;
	invoiceDate: string;
	dueDate?: string;
	customerName: string;
	customerEmail: string;
	customerPhone: string;
	customerGSTIN: string;
	customerAddress?: string;
	customerBillingAddress?: string;
	customerCity?: string;
	customerState?: string;
	customerPincode?: string;
	businessName: string;
	businessGSTIN: string;
	businessAddress: string;
	businessPhone: string;
	businessEmail: string;
	logoUrl: string;
	servedBy?: string;
	items: Array<{
		description: string;
		quantity: number;
		unitPrice: number;
		discountPercent: number;
		gstRate: number;
		lineTotal: number;
		gstAmount: number;
		hsnCode?: string;
	}>;
	subtotal: number;
	cgstAmount: number;
	sgstAmount: number;
	igstAmount: number;
	totalAmount: number;
	notes?: string;
	terms?: string;
	isGstInvoice: boolean;
	isB2B?: boolean;
}

export interface ExecuteInvoiceActionOptions {
	invoiceId: string;
	action: DocumentAction;
	format?: DocumentFormat;
	source?: InvoiceDocumentSource; // Optional: if data already loaded
	onProgress?: (message: string) => void;
	onWarning?: (title: string, description: string) => void;
}

// ============================================================================
// DATA FETCHING
// ============================================================================

/**
 * Fetches complete invoice data from IndexedDB or Supabase
 * Handles both modes transparently
 */
async function fetchInvoiceData(
	invoiceId: string,
	source?: InvoiceDocumentSource
): Promise<InvoiceDocumentSource> {
	// If source data provided, use it (avoid redundant fetch)
	if (source?.invoice) {
		return source;
	}

	const isIndexedDb = isIndexedDbMode();

	if (isIndexedDb) {
		// Fetch from IndexedDB
		const invoice = await db.invoices.get(invoiceId);
		if (!invoice) {
			throw new Error(`Invoice ${invoiceId} not found in IndexedDB`);
		}

		const items = await db.invoice_items
			.where("invoice_id")
			.equals(invoiceId)
			.toArray();

		const customer = invoice.customer_id
			? await db.customers.get(invoice.customer_id)
			: null;

		const store = invoice.store_id
			? await db.stores.get(invoice.store_id)
			: null;

		// NOTE: Business settings (profile) are stored in Supabase even in IndexedDB mode
		// This is a read-only operation for PDF generation and is acceptable
		// IndexedDB mode uses Supabase for business settings only, not for transactional data
		let profile: any = null;
		try {
			const supabase = createClient();
			const {
				data: { user },
			} = await supabase.auth.getUser();
			if (user) {
				const { data: prof } = await supabase
					.from("user_profiles")
					.select("*")
					.eq("id", user.id)
					.single();
				profile = prof;
			}
		} catch (err) {
			console.warn("[InvoiceDocumentEngine] Failed to fetch profile (read-only business settings):", err);
		}

		return { invoice, items, customer, store, profile };
	} else {
		// Fetch from Supabase
		const supabase = createClient();

		// Fetch invoice and items in parallel
		const [invoiceResult, itemsResult] = await Promise.all([
			supabase
				.from("invoices")
				.select("*, customers(*)")
				.eq("id", invoiceId)
				.single(),
			supabase.from("invoice_items").select("*").eq("invoice_id", invoiceId),
		]);

		if (invoiceResult.error || !invoiceResult.data) {
			throw new Error(
				`Invoice ${invoiceId} not found: ${invoiceResult.error?.message}`
			);
		}

		const invoice = invoiceResult.data;
		const items = itemsResult.data || [];
		const customer = invoice.customers || null;

		// Fetch store if available
		let store: any = null;
		if (invoice.store_id) {
			const { data: storeData } = await supabase
				.from("stores")
				.select("*")
				.eq("id", invoice.store_id)
				.maybeSingle();
			store = storeData;
		}

		// Fetch profile in parallel with store
		// For employees, get admin's profile; for admins, get their own
		let profile: any = null;
		try {
			// Get admin user_id (for employees, this is their admin's id)
			const { getAdminUserIdForInvoices } = await import("@/lib/utils/get-admin-user-id-for-employees");
			const adminUserId = await getAdminUserIdForInvoices();
			
			if (adminUserId) {
				const { data: prof } = await supabase
					.from("user_profiles")
					.select("*")
					.eq("id", adminUserId)
					.maybeSingle();
				profile = prof;
			}
		} catch (err) {
			console.warn("[InvoiceDocumentEngine] Failed to fetch profile:", err);
		}

		return { invoice, items, customer, store, profile };
	}
}

/**
 * Gets served-by name (employee or admin who created invoice)
 */
async function getServedByName(invoice: any): Promise<string | undefined> {
	try {
		const employeeId = invoice.created_by_employee_id || invoice.employee_id;

		if (employeeId) {
			const isIndexedDb = isIndexedDbMode();

			if (isIndexedDb) {
				const employee = await db.employees
					.where("employee_id")
					.equals(employeeId)
					.first();
				if (employee?.name) {
					return employee.name;
				}
			} else {
				const supabase = createClient();
				const { data: employee } = await supabase
					.from("employees")
					.select("name")
					.eq("employee_id", employeeId)
					.single();
				if (employee?.name) {
					return employee.name;
				}
			}
		}

		// If no employee, check if created by admin
		const userId = invoice.user_id;
		if (userId) {
			const supabase = createClient();
			const { data: profile } = await supabase
				.from("user_profiles")
				.select("full_name, business_name")
				.eq("id", userId)
				.single();

			if (profile?.full_name) {
				return profile.full_name;
			}
			if (profile?.business_name) {
				return profile.business_name;
			}

			const {
				data: { user },
			} = await supabase.auth.getUser();
			if (user?.email) {
				return user.email.split("@")[0];
			}
		}

		return undefined;
	} catch (error) {
		console.warn(
			"[InvoiceDocumentEngine] Error fetching served-by name:",
			error
		);
		return undefined;
	}
}

// ============================================================================
// DATA NORMALIZATION
// ============================================================================

/**
 * Normalizes invoice data from any source into canonical format
 * This is the SINGLE place where item mapping and GST calculations happen
 */
export async function prepareInvoiceDocumentData(
	source: InvoiceDocumentSource
): Promise<InvoiceDocumentData> {
	const { invoice, items = [], customer, store, profile, storeName } = source;

	// Get served-by name (non-blocking, fetch in parallel if needed)
	const servedByPromise = getServedByName(invoice);

	// Normalize invoice fields (handle both snake_case and camelCase)
	const invoiceNumber =
		invoice.invoice_number || invoice.invoiceNumber || "N/A";
	const invoiceDate =
		invoice.invoice_date || invoice.invoiceDate || new Date().toISOString();
	const dueDate = invoice.due_date || invoice.dueDate;
	const isGstInvoice = invoice.is_gst_invoice || invoice.isGstInvoice || false;

	// Normalize customer fields
	const customerName = customer?.name || "";
	const customerEmail = customer?.email || "";
	const customerPhone = customer?.phone || "";
	const customerGSTIN = customer?.gstin || "";
	const customerAddress = customer?.address || customer?.billing_address || "";
	const customerBillingAddress = customer?.billing_address || customer?.address || "";
	const customerCity = customer?.city || "";
	const customerState = customer?.state || "";
	const customerPincode = customer?.pincode || "";

	// Check if B2B mode is enabled
	let isB2B = false;
	try {
		const { getB2BModeStatus } = await import("@/lib/utils/b2b-mode");
		isB2B = await getB2BModeStatus();
	} catch (error) {
		console.warn("[InvoiceDocumentEngine] Failed to check B2B mode:", error);
	}

	// Normalize business fields (store takes precedence over profile)
	const businessName =
		store?.name || storeName || profile?.business_name || "Business";
	const businessGSTIN = store?.gstin || profile?.business_gstin || "";
	const businessAddress = store?.address || profile?.business_address || "";
	const businessPhone = store?.phone || profile?.business_phone || "";
	const businessEmail = profile?.business_email || "";
	let logoUrl = profile?.logo_url || "";

	// Fetch admin's logo if not in profile (for employees)
	// This is CRITICAL for print - must fetch synchronously
	if (!logoUrl && typeof window !== "undefined") {
		try {
			// First check cache
			const cachedLogo = localStorage.getItem("business_logo_url");
			if (cachedLogo) {
				logoUrl = cachedLogo;
			}
		} catch (e) {
			// Ignore localStorage errors
		}
	}
	
	// If still no logo, try to fetch from admin's profile (SYNC - blocking for print)
	// This ensures logo is available when generating PDF
	if (!logoUrl && typeof window !== "undefined") {
		try {
			const { getAdminUserIdForInvoices } = await import("@/lib/utils/get-admin-user-id-for-employees");
			const adminUserId = await getAdminUserIdForInvoices();
			if (adminUserId) {
				const supabase = createClient();
				const { data: adminProfile } = await supabase
					.from("user_profiles")
					.select("logo_url")
					.eq("id", adminUserId)
					.maybeSingle();
				
				if (adminProfile?.logo_url) {
					logoUrl = adminProfile.logo_url;
					// Cache for future use
					try {
						localStorage.setItem("business_logo_url", logoUrl);
					} catch (e) {
						// Ignore localStorage errors
					}
				}
			}
		} catch (e) {
			// Log but don't fail - logo is optional
			console.warn("[InvoiceDocumentEngine] Failed to fetch logo:", e);
		}
	} else if (logoUrl && typeof window !== "undefined") {
		// Cache logo URL in localStorage for faster access
		try {
			localStorage.setItem("business_logo_url", logoUrl);
		} catch (e) {
			// Ignore localStorage errors
		}
	}
	
	// Log logo status for debugging
	if (typeof window !== "undefined") {
		console.log("[InvoiceDocumentEngine] Logo URL:", logoUrl ? "✓ Found" : "✗ Not found");
	}

	// Normalize items - SINGLE SOURCE OF TRUTH for item mapping
	// This logic is NOT duplicated anywhere else
	const normalizedItems = items.map((item: any) => {
		const quantity = Number(item.quantity) || 0;
		const unitPrice = Number(item.unit_price || item.unitPrice) || 0;
		const discountPercent =
			Number(item.discount_percent || item.discountPercent) || 0;
		const gstRate = Number(item.gst_rate || item.gstRate) || 0;

		// Calculate using shared GST calculator (single source of truth)
		const calc = calculateLineItem({
			unitPrice,
			discountPercent,
			gstRate,
			quantity,
		});

		return {
			description: item.description || "",
			quantity,
			unitPrice,
			discountPercent,
			gstRate,
			lineTotal:
				item.line_total ||
				item.lineTotal ||
				calc.taxableAmount + calc.gstAmount,
			gstAmount: item.gst_amount || item.gstAmount || calc.gstAmount,
			hsnCode: item.hsn_code || item.hsnCode || "",
		};
	});

	// Normalize totals
	const subtotal = Number(invoice.subtotal) || 0;
	const cgstAmount = Number(invoice.cgst_amount || invoice.cgstAmount) || 0;
	const sgstAmount = Number(invoice.sgst_amount || invoice.sgstAmount) || 0;
	const igstAmount = Number(invoice.igst_amount || invoice.igstAmount) || 0;
	const totalAmount = Number(invoice.total_amount || invoice.totalAmount) || 0;

	// Wait for served-by name
	const servedBy = await servedByPromise;

	// Debug: Log served-by for troubleshooting
	if (servedBy) {
		console.log("[InvoiceDocumentEngine] Served-by name:", servedBy);
	} else {
		console.warn("[InvoiceDocumentEngine] No served-by name found");
	}

	return {
		invoiceNumber,
		invoiceDate,
		dueDate,
		customerName,
		customerEmail,
		customerPhone,
		customerGSTIN,
		customerAddress,
		customerBillingAddress,
		customerCity,
		customerState,
		customerPincode,
		businessName,
		businessGSTIN,
		businessAddress,
		businessPhone,
		businessEmail,
		logoUrl,
		servedBy,
		items: normalizedItems,
		subtotal,
		cgstAmount,
		sgstAmount,
		igstAmount,
		totalAmount,
		notes: invoice.notes,
		terms: invoice.terms,
		isGstInvoice,
		isB2B,
	};
}

// ============================================================================
// PDF GENERATION
// ============================================================================

/**
 * Generates PDF based on format and action requirements
 *
 * Rules:
 * - Invoice (A4) → Always client-side (fast, reliable)
 * - Slip (80mm):
 *   - WhatsApp → Server-side if online, client-side if offline
 *   - Print/Download → Client-side (no network needed)
 */
async function generatePDF(
	data: InvoiceDocumentData,
	format: DocumentFormat,
	action: DocumentAction
): Promise<Blob> {
	if (format === "invoice") {
		// Invoice (A4) → Always client-side
		const pdfData: InvoicePDFData = {
			...data,
			businessEmail: data.businessEmail,
			logoUrl: data.logoUrl,
			servedBy: data.servedBy,
		};
		return await generateInvoicePDF(pdfData);
	} else {
		// Slip (80mm)
		const slipData: InvoiceSlipData = {
			...data,
			logoUrl: data.logoUrl,
			servedBy: data.servedBy,
		};

		// Always use client-side generation for reliability
		// Client-side is fast, works offline, and doesn't require server Puppeteer setup
		// The R2 upload will still happen after PDF generation, ensuring proper sequencing
		return await generateInvoiceSlipPDF(slipData, { useServerSide: false });
	}
}

// ============================================================================
// ACTION EXECUTION
// ============================================================================

/**
 * Main entry point for all invoice document actions
 *
 * UI components should ONLY call this function
 *
 * @returns For "whatsapp" action, returns { success: boolean } to indicate if WhatsApp opened
 */
export async function executeInvoiceAction(
	options: ExecuteInvoiceActionOptions
): Promise<{ success: boolean } | void> {
	const {
		invoiceId,
		action,
		format = "invoice",
		source,
		onProgress,
		onWarning,
	} = options;

	try {
		// Step 1: Fetch invoice data (if not provided)
		onProgress?.("Loading invoice data...");
		const invoiceSource = await fetchInvoiceData(invoiceId, source);

		// Step 2: Normalize data (SINGLE SOURCE OF TRUTH)
		onProgress?.("Preparing document...");
		const documentData = await prepareInvoiceDocumentData(invoiceSource);

		// Step 3: Execute action
		switch (action) {
			case "print":
				await handlePrint(documentData, format);
				break;
			case "download":
				await handleDownload(documentData, format);
				break;
			case "whatsapp":
				// WhatsApp action returns success status for redirect control
				return await handleWhatsApp(
					documentData,
					invoiceId,
					format,
					onProgress,
					onWarning
				);
			case "r2-upload":
				await handleR2Upload(documentData, invoiceId, format);
				break;
		}
	} catch (error) {
		console.error("[InvoiceDocumentEngine] Error:", error);
		throw error;
	}
}

/**
 * Handles print action
 */
async function handlePrint(
	data: InvoiceDocumentData,
	format: DocumentFormat
): Promise<void> {
	const pdfBlob = await generatePDF(data, format, "print");
	const fileName =
		format === "invoice"
			? `Invoice-${data.invoiceNumber}.pdf`
			: `Invoice-Slip-${data.invoiceNumber}.pdf`;

	// Open PDF in new window for printing
	const url = URL.createObjectURL(pdfBlob);
	const printWindow = window.open(url, "_blank");

	if (!printWindow) {
		// Popup blocked - fallback to download
		const downloadLink = document.createElement("a");
		downloadLink.href = url;
		downloadLink.download = fileName;
		document.body.appendChild(downloadLink);
		downloadLink.click();
		document.body.removeChild(downloadLink);
		URL.revokeObjectURL(url);
		return;
	}

	// Wait for window to load, then trigger print
	printWindow.onload = () => {
		// Minimal delay to ensure PDF is rendered
		setTimeout(() => {
			printWindow.print();
			// Cleanup after print dialog is shown
			setTimeout(() => {
				URL.revokeObjectURL(url);
			}, 500);
		}, 300);
	};
}

/**
 * Handles download action
 */
async function handleDownload(
	data: InvoiceDocumentData,
	format: DocumentFormat
): Promise<void> {
	const pdfBlob = await generatePDF(data, format, "download");
	const fileName =
		format === "invoice"
			? `Invoice-${data.invoiceNumber}.pdf`
			: `Invoice-Slip-${data.invoiceNumber}.pdf`;

	const url = URL.createObjectURL(pdfBlob);
	const a = document.createElement("a");
	a.href = url;
	a.download = fileName;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}

/**
 * Handles WhatsApp sharing with STRICT SEQUENCING
 *
 * Flow (NON-NEGOTIABLE):
 * 1. Check for existing R2 URL (await properly)
 * 2. If no existing URL:
 *    - Generate PDF
 *    - Upload PDF to R2
 *    - Wait for upload success
 *    - Save metadata
 * 3. Generate WhatsApp message WITH R2 URL (required)
 * 4. Open WhatsApp (synchronously to preserve user gesture)
 * 5. Return success status for redirect control
 *
 * ❌ WhatsApp NEVER opens before R2 upload completes
 * ❌ WhatsApp message NEVER contains fallback links
 * ❌ If upload fails, show error and do NOT open WhatsApp
 * ❌ Navigation must happen AFTER this function completes
 *
 * @returns { success: boolean } - true if WhatsApp opened successfully
 */
async function handleWhatsApp(
	data: InvoiceDocumentData,
	invoiceId: string,
	format: DocumentFormat,
	onProgress?: (message: string) => void,
	onWarning?: (title: string, description: string) => void
): Promise<{ success: boolean }> {
	try {
		// Step 1: Check for existing valid R2 URL
		onProgress?.("Checking for existing PDF...");
		let pdfR2Url: string | undefined;

		const existingStorage = await getInvoiceStorage(invoiceId);
		if (existingStorage?.public_url) {
			const expiresAt = new Date(existingStorage.expires_at).getTime();
			const now = Date.now();
			if (expiresAt > now) {
				pdfR2Url = existingStorage.public_url;
				onProgress?.("Found existing PDF link");
			}
		}

		// Step 2: If no existing URL, generate PDF and upload to R2 (NON-BLOCKING)
		if (!pdfR2Url) {
			onProgress?.("Generating PDF...");
			// Generate PDF (slip format for WhatsApp)
			const pdfBlob = await generatePDF(data, format, "whatsapp");

		// Get admin ID for upload (for employees, this is their store's admin_user_id)
		const { getAdminUserIdForInvoices } = await import(
			"@/lib/utils/get-admin-user-id-for-employees"
		);
		const adminUserId = await getAdminUserIdForInvoices();

		if (!adminUserId) {
			const authType = typeof window !== 'undefined' ? localStorage.getItem("authType") : null;
			const errorMsg =
				authType === "employee"
					? "Could not determine admin user. Please ensure you're assigned to a store."
					: "Could not determine admin user. Please ensure you're logged in.";
			throw new Error(errorMsg);
		}

		// Start upload and wait for completion (with extended timeout for production)
		// Production environments (Vercel) may have cold starts, so we allow more time
		onProgress?.("Uploading PDF to cloud storage...");
		const uploadPromise = uploadInvoicePDFToR2Client(
			pdfBlob,
			adminUserId,
			invoiceId,
			data.invoiceNumber
		)
				.then((uploadResult) => {
					// Log upload result for debugging
					console.log("[InvoiceDocumentEngine] R2 Upload Result:", {
						success: uploadResult.success,
						hasPublicUrl: !!uploadResult.publicUrl,
						error: uploadResult.error,
						objectKey: uploadResult.objectKey,
					});

					if (uploadResult.success && uploadResult.publicUrl) {
						// Save metadata in background
						if (uploadResult.expiresAt) {
							saveInvoiceStorage({
								invoice_id: invoiceId,
								r2_object_key: uploadResult.objectKey || "",
								public_url: uploadResult.publicUrl,
								expires_at: uploadResult.expiresAt,
							}).catch((err) => {
								console.error(
									"[InvoiceDocumentEngine] Failed to save metadata:",
									err
								);
							});
						}
						return uploadResult.publicUrl;
					} else {
						// Log the error for debugging
						const errorMessage = uploadResult.error || "R2 upload failed";
						console.error("[InvoiceDocumentEngine] R2 Upload failed:", {
							error: errorMessage,
							invoiceId,
							invoiceNumber: data.invoiceNumber,
						});

						throw new Error(errorMessage);
					}
				})
				.catch((err) => {
					console.error(
						"[InvoiceDocumentEngine] Upload promise rejected:",
						err
					);
					throw err; // Re-throw to be caught by outer try-catch
				});

			// Wait for upload with extended timeout (20 seconds total: 10s initial + 10s extra)
			// This accounts for Vercel cold starts and network latency
			try {
				const initialTimeout = 10000; // 10 seconds initial wait
				const extendedTimeout = 10000; // 10 more seconds if needed (total 20 seconds)

				// First attempt: wait 10 seconds
				const initialTimeoutPromise = new Promise<string | undefined>(
					(resolve) => {
						setTimeout(() => resolve(undefined), initialTimeout);
					}
				);

				pdfR2Url = await Promise.race([uploadPromise, initialTimeoutPromise]);

				if (pdfR2Url) {
					onProgress?.("PDF uploaded successfully");
				} else {
					// If not ready in 10s, wait 10 more seconds
					onProgress?.("Still uploading PDF... Please wait...");
					const extendedTimeoutPromise = new Promise<string | undefined>(
						(resolve) => {
							setTimeout(() => resolve(undefined), extendedTimeout);
						}
					);

					pdfR2Url = await Promise.race([
						uploadPromise,
						extendedTimeoutPromise,
					]);

					if (pdfR2Url) {
						onProgress?.("PDF uploaded successfully");
					} else {
						// Upload still in progress after 20 seconds - throw error instead of falling back
						console.warn(
							"[InvoiceDocumentEngine] R2 upload took longer than 20 seconds"
						);
						const timeoutError = new Error(
							"PDF upload timeout: Upload took longer than 20 seconds. Please check your internet connection and try again."
						);
						throw timeoutError;
					}
				}
			} catch (err: any) {
				// If upload fails with an error, throw it to prevent fallback
				console.error("[InvoiceDocumentEngine] R2 upload error:", err);
				const errorMessage =
					err?.message || "Unknown error occurred during PDF upload";
				throw new Error(errorMessage);
			}
		}

		// Step 5: Validate that we have R2 URL (required - no fallback)
		if (!pdfR2Url) {
			throw new Error(
				"PDF upload failed: No valid PDF URL available. Please try again."
			);
		}

		// Step 6: Generate WhatsApp message with R2 URL (required - no fallback)
		const finalPdfUrl = pdfR2Url;

		// Build WhatsApp message manually to support fallback
		const formatDate = (dateStr: string) => {
			return new Date(dateStr).toLocaleDateString("en-IN", {
				day: "2-digit",
				month: "2-digit",
				year: "numeric",
			});
		};

		const itemsList = data.items
			.map((item, index) => {
				const lineTotal = item.quantity * item.unitPrice;
				return `${index + 1}. ${item.description}\n   Qty: ${
					item.quantity
				} × ₹${item.unitPrice.toFixed(2)} = ₹${lineTotal.toFixed(2)}`;
			})
			.join("\n\n");

		const whatsappMessage = `📋 *Invoice Receipt*

🏪 *${data.businessName}*

━━━━━━━━━━━━━━━━━━━━
📄 Invoice #${data.invoiceNumber}
📅 Date: ${formatDate(data.invoiceDate)}
━━━━━━━━━━━━━━━━━━━━

*Items:*
${itemsList}

━━━━━━━━━━━━━━━━━━━━
💰 *Total: ₹${data.totalAmount.toFixed(2)}*
━━━━━━━━━━━━━━━━━━━━

📄 Download Invoice PDF:
${finalPdfUrl}

Thank you for your business! 🙏`;

		// Step 6: Open WhatsApp (ONLY after all steps complete)
		// CRITICAL: This must happen synchronously to preserve user gesture
		// Navigation/redirect must happen AFTER this completes
		onProgress?.("Opening WhatsApp...");
		const shareResult = await shareOnWhatsApp(whatsappMessage);

		if (!shareResult.success) {
			throw new Error(
				"Failed to open WhatsApp. Please check your popup blocker settings."
			);
		}

		// Return success status so caller can control redirect timing
		return shareResult;
	} catch (error) {
		console.error("[InvoiceDocumentEngine] WhatsApp share error:", error);
		// Re-throw to allow UI to show error toast
		throw error;
	}
}

/**
 * Handles R2 upload (background operation)
 */
async function handleR2Upload(
	data: InvoiceDocumentData,
	invoiceId: string,
	format: DocumentFormat
): Promise<void> {
	// This is typically called from background API, not directly from UI
	// But kept here for completeness
	const pdfBlob = await generatePDF(data, format, "r2-upload");

	// Upload logic is handled by API route
	// This function exists for potential future direct calls
	throw new Error("R2 upload should be handled by API route");
}
