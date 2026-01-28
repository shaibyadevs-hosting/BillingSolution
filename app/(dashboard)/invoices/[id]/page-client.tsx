"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import Link from "next/link";
import { ArrowLeft, Printer, Share2 } from "lucide-react";
import { InvoiceActions } from "@/components/features/invoices/invoice-actions";
import { InvoicePrint } from "@/components/features/invoices/invoice-print";
import { WhatsAppShareButton } from "@/components/features/invoices/whatsapp-share-button";
import { useToast } from "@/hooks/use-toast";
import { useInvoice } from "@/lib/hooks/use-cached-data";
import { db } from "@/lib/dexie-client";
import { isIndexedDbMode } from "@/lib/utils/db-mode";
import {
	executeInvoiceAction,
	prepareInvoiceDocumentData,
} from "@/lib/invoice-document-engine";
import { generateInvoiceSlipPDF } from "@/lib/utils/invoice-slip-pdf";
import { createClient } from "@/lib/supabase/client";
import { getB2BModeStatus } from "@/lib/utils/b2b-mode";
import { Skeleton } from "@/components/ui/skeleton";
import { TableSkeleton } from "@/components/ui/table-skeleton";

export default function InvoiceDetailPageClient() {
	const params = useParams();
	const router = useRouter();
	const { toast } = useToast();
	const invoiceId = params.id as string;
	const {
		data: invoiceData,
		isLoading: loading,
		error,
	} = useInvoice(invoiceId);
	const [settings, setSettings] = useState<any>(null);
	const [storeName, setStoreName] = useState<string>("Business");
	const [isSharingPDF, setIsSharingPDF] = useState(false);
	const [profile, setProfile] = useState<any>(null);
	const [logoUrl, setLogoUrl] = useState<string | null>(null);
	const [isB2BEnabled, setIsB2BEnabled] = useState(false);

	// Extract invoice, items, customer, and employee from the hook data
	const invoice = invoiceData;
	const items = invoiceData?.invoice_items || [];
	const customer = invoiceData?.customers;
	const employee = invoiceData?.employees;

	// Fetch store name for WhatsApp sharing
	useEffect(() => {
		const fetchStoreName = async () => {
			if (!invoice?.store_id) {
				// Try to get from localStorage or use default
				const currentStoreId = localStorage.getItem("currentStoreId");
				if (currentStoreId) {
					const isIndexedDb = isIndexedDbMode();
					if (isIndexedDb) {
						const store = await db.stores.get(currentStoreId);
						if (store?.name) {
							setStoreName(store.name);
						}
					} else {
						const supabase = createClient();
						const { data: store } = await supabase
							.from("stores")
							.select("name")
							.eq("id", currentStoreId)
							.single();
						if (store?.name) {
							setStoreName(store.name);
						}
					}
				}
				return;
			}

			try {
				const isIndexedDb = isIndexedDbMode();
				if (isIndexedDb) {
					const store = await db.stores.get(invoice.store_id);
					if (store?.name) {
						setStoreName(store.name);
					}
				} else {
					const supabase = createClient();
					const { data: store } = await supabase
						.from("stores")
						.select("name")
						.eq("id", invoice.store_id)
						.single();
					if (store?.name) {
						setStoreName(store.name);
					}
				}
			} catch (err) {
				console.warn("[InvoiceDetail] Failed to fetch store name:", err);
			}
		};

		if (invoice) {
			fetchStoreName();
		}
	}, [invoice]);

	useEffect(() => {
		if (error) {
			toast({
				title: "Error",
				description: "Invoice not found",
				variant: "destructive",
			});
		}
	}, [error, toast]);

	// Load B2B mode status
	useEffect(() => {
		const loadB2BStatus = async () => {
			try {
				const b2bEnabled = await getB2BModeStatus();
				setIsB2BEnabled(b2bEnabled);
			} catch (error) {
				console.error("[InvoiceDetail] Failed to load B2B status:", error);
			}
		};
		if (invoiceId) {
			loadB2BStatus();
		}
	}, [invoiceId]);

	// Fetch business settings for printing and sharing
	useEffect(() => {
		const fetchSettings = async () => {
			try {
				const supabase = createClient();

				// Get admin user_id (for both admin and employee)
				// Priority: 1. invoice.user_id (admin_user_id for employee-created invoices)
				//           2. From employee session/store
				//           3. From auth user (for admins)
				const authType = localStorage.getItem("authType");
				let adminUserId: string | null = null;

				// First, try to use invoice.user_id (which is admin_user_id for employees)
				if (invoice?.user_id) {
					adminUserId = invoice.user_id;
				} else if (authType === "employee") {
					// For employees, get admin_user_id from store
					const employeeSession = localStorage.getItem("employeeSession");
					if (employeeSession) {
						try {
							const session = JSON.parse(employeeSession);
							const storeId =
								session.storeId || localStorage.getItem("currentStoreId") || invoice?.store_id;
							if (storeId) {
								const { data: store } = await supabase
									.from("stores")
									.select("admin_user_id")
									.eq("id", storeId)
									.single();
								adminUserId = store?.admin_user_id || null;
							}
						} catch (e) {
							console.warn(
								"[InvoiceDetail] Error parsing employee session:",
								e
							);
						}
					}
				} else {
					// For admin, use their own user_id
					const {
						data: { user },
					} = await supabase.auth.getUser();
					if (user) {
						const { data: profile } = await supabase
							.from("user_profiles")
							.select("role")
							.eq("id", user.id)
							.maybeSingle();

						if (profile?.role === "admin") {
							adminUserId = user.id;
						}
					}
				}

				if (!adminUserId) {
					// Try to get from cache
					const cachedLogo = localStorage.getItem("business_logo_url");
					if (cachedLogo) {
						setLogoUrl(cachedLogo);
					}
					return;
				}

				// Fetch admin's profile (business settings)
				const { data: profile } = await supabase
					.from("user_profiles")
					.select("*")
					.eq("id", adminUserId)
					.maybeSingle();

				if (profile) {
					setSettings(profile);
					setProfile(profile);

					// Cache logo URL in localStorage
					if (profile.logo_url) {
						localStorage.setItem("business_logo_url", profile.logo_url);
						setLogoUrl(profile.logo_url);
					} else {
						// Try to get from cache
						const cachedLogo = localStorage.getItem("business_logo_url");
						if (cachedLogo) {
							setLogoUrl(cachedLogo);
						}
					}
				}
			} catch (err) {
				console.warn("Failed to fetch business settings:", err);
			}
		};
		if (invoiceId && invoice) {
			fetchSettings();
		}
	}, [invoiceId, invoice]);

	if (loading) {
		return (
			<div className="space-y-6 p-4 md:p-6">
				<Skeleton className="h-10 w-64" />
				<div className="grid gap-6 md:grid-cols-2">
					<Card>
						<CardHeader>
							<Skeleton className="h-6 w-32" />
						</CardHeader>
						<CardContent className="space-y-3">
							<Skeleton className="h-4 w-full" />
							<Skeleton className="h-4 w-full" />
							<Skeleton className="h-4 w-3/4" />
						</CardContent>
					</Card>
					<Card>
						<CardHeader>
							<Skeleton className="h-6 w-32" />
						</CardHeader>
						<CardContent className="space-y-3">
							<Skeleton className="h-4 w-full" />
							<Skeleton className="h-4 w-full" />
							<Skeleton className="h-4 w-3/4" />
						</CardContent>
					</Card>
				</div>
				<Card>
					<CardHeader>
						<Skeleton className="h-6 w-40" />
					</CardHeader>
					<CardContent>
						<TableSkeleton rows={5} columns={6} />
					</CardContent>
				</Card>
			</div>
		);
	}

	if (error || !invoice) {
		return (
			<div className="flex items-center justify-center min-h-[400px]">
				<div className="text-center space-y-4">
					<p className="text-destructive">
						{error ? String(error) : "Invoice not found"}
					</p>
					<Button asChild>
						<Link href="/invoices">Back to Invoices</Link>
					</Button>
				</div>
			</div>
		);
	}

	const statusColors: Record<string, string> = {
		draft: "bg-gray-100 text-gray-800",
		sent: "bg-blue-100 text-blue-800",
		paid: "bg-green-100 text-green-800",
		cancelled: "bg-red-100 text-red-800",
	};

	// Share PDF using Web Share API - uses only IndexedDB data (no Supabase)
	const handleSharePDF = async () => {
		if (!invoice || !items || items.length === 0) {
			toast({
				title: "Error",
				description: "Invoice data not available",
				variant: "destructive",
			});
			return;
		}

		setIsSharingPDF(true);

		try {
			// Check if Web Share API is supported
			if (!navigator.share || !navigator.canShare) {
				toast({
					title: "Not Supported",
					description:
						"Web Share API is not supported in this browser. Please download the PDF instead.",
					variant: "destructive",
				});
				setIsSharingPDF(false);
				return;
			}

			// Fetch additional data if needed
			let fullCustomer: any = customer;
			let store: any = null;
			const isIndexedDb = isIndexedDbMode();

			if (invoice.customer_id && !fullCustomer && isIndexedDb) {
				fullCustomer = await db.customers.get(invoice.customer_id);
			}

			if (invoice.store_id && isIndexedDb) {
				store = await db.stores.get(invoice.store_id);
			}

			// Use unified engine to prepare PDF data (eliminates duplication)
			const source = {
				invoice,
				items,
				customer: fullCustomer,
				store,
				profile,
				storeName,
			};

			const pdfData = await prepareInvoiceDocumentData(source);

			// Generate PDF using unified engine (slip format for Web Share)
			const pdfBlob = await generateInvoiceSlipPDF(pdfData, {
				useServerSide: false,
			});

			// Get invoice number and business name for file naming and sharing
			const invoiceNumber = pdfData.invoiceNumber;
			const businessName = pdfData.businessName;

			// Create File object
			const file = new File([pdfBlob], `Invoice-${invoiceNumber}.pdf`, {
				type: "application/pdf",
			});

			// Check if file sharing is supported
			if (!navigator.canShare({ files: [file] })) {
				// Fallback: download the PDF
				const url = URL.createObjectURL(pdfBlob);
				const a = document.createElement("a");
				a.href = url;
				a.download = `Invoice-${invoiceNumber}.pdf`;
				document.body.appendChild(a);
				a.click();
				document.body.removeChild(a);
				URL.revokeObjectURL(url);

				toast({
					title: "PDF Downloaded",
					description:
						"File sharing is not supported. The PDF has been downloaded.",
					duration: 3000,
				});
				setIsSharingPDF(false);
				return;
			}

			// Share using Web Share API
			await navigator.share({
				files: [file],
				title: `Invoice ${invoiceNumber}`,
				text: `Invoice ${invoiceNumber} from ${businessName}. View it here: ${window.location.origin}/i/${invoiceId}`,
			});

			toast({
				title: "Shared Successfully",
				description: "Invoice PDF shared successfully",
				duration: 3000,
			});
		} catch (error: any) {
			// User cancelled or error occurred
			if (error.name !== "AbortError") {
				console.error("[SharePDF] Error:", error);
				toast({
					title: "Error",
					description:
						error.message || "Failed to share PDF. Please try again.",
					variant: "destructive",
				});
			}
		} finally {
			setIsSharingPDF(false);
		}
	};

	return (
		<div className="mx-auto max-w-5xl space-y-4 md:space-y-6 p-4 md:p-6">
			{/* Header */}
			<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
				<div className="flex items-center gap-2 md:gap-4">
					<Link href="/invoices">
						<Button variant="ghost" size="icon">
							<ArrowLeft className="h-4 w-4" />
						</Button>
					</Link>
					<div>
						<h1 className="text-xl sm:text-2xl md:text-3xl font-bold">
							Invoice {invoice.invoice_number}
						</h1>
						<p className="text-xs sm:text-sm text-muted-foreground">
							Created on{" "}
							{new Date(invoice.created_at).toLocaleDateString("en-IN", {
								day: "2-digit",
								month: "short",
								year: "numeric",
							})}{" "}
							at{" "}
							{new Date(invoice.created_at).toLocaleTimeString("en-IN", {
								hour: "2-digit",
								minute: "2-digit",
								second: "2-digit",
								hour12: true,
							})}
						</p>
					</div>
				</div>
				<div className="flex items-center gap-2 w-full sm:w-auto justify-end">
					<Badge className={statusColors[invoice.status]}>
						{invoice.status.toUpperCase()}
					</Badge>
					<Button
						onClick={handleSharePDF}
						disabled={isSharingPDF}
						variant="outline"
						size="sm"
						className="gap-2"
						title="Share PDF using Web Share API"
					>
						<Share2 className="h-4 w-4" />
						<span className="hidden sm:inline">
							{isSharingPDF ? "Sharing..." : "Share PDF"}
						</span>
					</Button>
					<WhatsAppShareButton
						invoice={{
							id: invoice.id,
							invoice_number: invoice.invoice_number,
							invoice_date: invoice.invoice_date,
							total_amount: invoice.total_amount,
							created_by_employee_id: invoice.created_by_employee_id,
							employee_id: invoice.employee_id,
							user_id: invoice.user_id,
							is_gst_invoice: invoice.is_gst_invoice,
							subtotal: invoice.subtotal,
							cgst_amount: invoice.cgst_amount,
							sgst_amount: invoice.sgst_amount,
							igst_amount: invoice.igst_amount,
						}}
						items={items.map((item: any) => ({
							description: item.description,
							quantity: item.quantity,
							unit_price: item.unit_price,
							discount_percent: item.discount_percent,
							gst_rate: item.gst_rate,
							line_total: item.line_total,
							gst_amount: item.gst_amount,
						}))}
						storeName={storeName}
						invoiceLink={`${
							typeof window !== "undefined" ? window.location.origin : ""
						}/i/${invoice.id}`}
						customer={customer}
						profile={profile}
					/>
					<InvoicePrint
						invoiceId={invoiceId}
						invoiceNumber={invoice.invoice_number}
						invoiceData={{
							...invoice,
							invoice_items: items,
							customers: customer,
							profile: settings,
						}}
					/>
					<InvoiceActions
						invoiceId={invoiceId}
						invoiceNumber={invoice.invoice_number}
						invoiceData={{
							...invoice,
							invoice_items: items,
							customers: customer,
							profile: settings,
						}}
					/>
				</div>
			</div>

			{/* Logo and Business Details Section */}
			<div className="flex items-start justify-between gap-4 pb-4 border-b">
				<div className="flex-1">
					{/* Logo in top corner (below header) */}
					{logoUrl && (
						<div className="flex items-center gap-4">
							<img
								src={logoUrl}
								alt="Business Logo"
								className="h-16 w-16 object-contain border rounded-lg p-2 bg-gray-50"
								onError={(e) => {
									e.currentTarget.style.display = "none";
								}}
							/>
							<div>
								<h2 className="text-lg font-semibold">
									{profile?.business_name || storeName || "Business"}
								</h2>
								{profile?.business_address && (
									<p className="text-sm text-muted-foreground">
										{profile.business_address}
									</p>
								)}
							</div>
						</div>
					)}
				</div>
			</div>

			{/* Invoice Details */}
			<div className="grid gap-4 md:gap-6 md:grid-cols-3">
				<Card>
					<CardHeader>
						<CardTitle>Invoice Information</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3">
						<div className="flex justify-between">
							<span className="text-muted-foreground">Invoice Number:</span>
							<span className="font-medium">{invoice.invoice_number}</span>
						</div>
						<div className="flex justify-between">
							<span className="text-muted-foreground">Invoice Date:</span>
							<span className="font-medium">
								{new Date(invoice.invoice_date).toLocaleDateString("en-IN", {
									day: "2-digit",
									month: "short",
									year: "numeric",
								})}
							</span>
						</div>
						<div className="flex justify-between">
							<span className="text-muted-foreground">Invoice Time:</span>
							<span className="font-medium">
								{new Date(invoice.created_at).toLocaleTimeString("en-IN", {
									hour: "2-digit",
									minute: "2-digit",
									second: "2-digit",
									hour12: true,
								})}
							</span>
						</div>
						{invoice.due_date && (
							<div className="flex justify-between">
								<span className="text-muted-foreground">Due Date:</span>
								<span className="font-medium">
									{new Date(invoice.due_date).toLocaleDateString("en-IN", {
										day: "2-digit",
										month: "short",
										year: "numeric",
									})}
								</span>
							</div>
						)}
						<div className="flex justify-between">
							<span className="text-muted-foreground">Type:</span>
							<span className="font-medium">
								{invoice.is_gst_invoice ? "GST Invoice" : "Non-GST Invoice"}
							</span>
						</div>
						<div className="flex justify-between">
							<span className="text-muted-foreground">Status:</span>
							<Badge className={statusColors[invoice.status]}>
								{invoice.status.toUpperCase()}
							</Badge>
						</div>
						{(invoice.created_by_employee_id ||
							invoice.employee_id ||
							invoiceData?.employees) && (
							<div className="flex justify-between pt-2 border-t">
								<span className="text-muted-foreground">Generated By:</span>
								<span className="font-medium">
									{invoiceData?.employees?.name ||
										invoice.created_by_employee_id ||
										invoice.employee_id ||
										"Admin"}
								</span>
							</div>
						)}
						{invoice.payment_method && (
							<div className="flex justify-between">
								<span className="text-muted-foreground">Payment Method:</span>
								<span className="font-medium">{invoice.payment_method}</span>
							</div>
						)}
						{invoice.payment_status && (
							<div className="flex justify-between">
								<span className="text-muted-foreground">Payment Status:</span>
								<span className="font-medium">{invoice.payment_status}</span>
							</div>
						)}
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Customer Information</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3">
						{customer ? (
							<>
								<div className="flex justify-between">
									<span className="text-muted-foreground">Name:</span>
									<span className="font-medium">{customer.name || "N/A"}</span>
								</div>
								<div className="flex justify-between">
									<span className="text-muted-foreground">Phone:</span>
									<span className="font-medium">{customer.phone || "N/A"}</span>
								</div>
								<div className="flex justify-between">
									<span className="text-muted-foreground">Email:</span>
									<span className="font-medium break-all text-right">
										{customer.email || "N/A"}
									</span>
								</div>
								<div className="flex justify-between">
									<span className="text-muted-foreground">
										Billing Address:
									</span>
									<span className="font-medium text-right">
										{customer.billing_address || customer.address || "N/A"}
									</span>
								</div>
								{(isB2BEnabled || customer.gstin) && (
									<div className="flex justify-between">
										<span className="text-muted-foreground">GSTIN:</span>
										<span className="font-medium">
											{customer.gstin || "N/A"}
										</span>
									</div>
								)}
								{customer.city && (
									<div className="flex justify-between">
										<span className="text-muted-foreground">City:</span>
										<span className="font-medium">{customer.city}</span>
									</div>
								)}
								{customer.state && (
									<div className="flex justify-between">
										<span className="text-muted-foreground">State:</span>
										<span className="font-medium">{customer.state}</span>
									</div>
								)}
								{customer.pincode && (
									<div className="flex justify-between">
										<span className="text-muted-foreground">Pincode:</span>
										<span className="font-medium">{customer.pincode}</span>
									</div>
								)}
								{/* Show shipping address if different from billing in B2B mode */}
								{isB2BEnabled &&
									customer.shipping_address &&
									customer.shipping_address !==
										(customer.billing_address || customer.address) && (
										<div className="flex justify-between">
											<span className="text-muted-foreground">
												Shipping Address:
											</span>
											<span className="font-medium text-right">
												{customer.shipping_address}
											</span>
										</div>
									)}
							</>
						) : (
							<div className="text-sm text-muted-foreground">
								<div className="flex justify-between">
									<span>Name:</span>
									<span className="font-medium">Walk-in Customer</span>
								</div>
								<p className="mt-2 text-xs">
									No customer information available
								</p>
							</div>
						)}
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Business Information</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3">
						<div className="flex justify-between">
							<span className="text-muted-foreground">Business Name:</span>
							<span className="font-medium">
								{profile?.business_name || storeName || "Business"}
							</span>
						</div>
						{/* B2B specific fields - always show in B2B mode, conditionally in B2C */}
						{(isB2BEnabled || profile?.business_gstin) && (
							<div className="flex justify-between">
								<span className="text-muted-foreground">GSTIN:</span>
								<span className="font-medium">
									{profile?.business_gstin || (isB2BEnabled ? "N/A" : "")}
								</span>
							</div>
						)}
						{(isB2BEnabled || profile?.business_address) &&
							profile?.business_address && (
								<div className="flex justify-between">
									<span className="text-muted-foreground">Address:</span>
									<span className="font-medium text-right">
										{profile.business_address}
									</span>
								</div>
							)}
						{(isB2BEnabled || profile?.business_phone) &&
							profile?.business_phone && (
								<div className="flex justify-between">
									<span className="text-muted-foreground">Phone:</span>
									<span className="font-medium">{profile.business_phone}</span>
								</div>
							)}
						{(isB2BEnabled || profile?.business_email) &&
							profile?.business_email && (
								<div className="flex justify-between">
									<span className="text-muted-foreground">Email:</span>
									<span className="font-medium break-all text-right">
										{profile.business_email}
									</span>
								</div>
							)}
						{storeName && storeName !== profile?.business_name && (
							<div className="flex justify-between">
								<span className="text-muted-foreground">Store:</span>
								<span className="font-medium">{storeName}</span>
							</div>
						)}
					</CardContent>
				</Card>
			</div>

			{/* Line Items */}
			<Card>
				<CardHeader>
					<CardTitle className="text-lg md:text-xl">
						Line Items ({items?.length || 0} items)
					</CardTitle>
				</CardHeader>
				<CardContent className="p-4 md:p-6">
					<div className="overflow-x-auto -mx-4 md:mx-0">
						<div className="inline-block min-w-full align-middle">
							<Table className="min-w-full">
								<TableHeader>
									<TableRow>
										<TableHead>#</TableHead>
										<TableHead>Description</TableHead>
										<TableHead>Qty</TableHead>
										<TableHead>Unit Price</TableHead>
										<TableHead>Discount %</TableHead>
										{invoice.is_gst_invoice && <TableHead>GST %</TableHead>}
										{invoice.is_gst_invoice && (
											<TableHead>GST Amount</TableHead>
										)}
										<TableHead>Total</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{items?.map((item: any, index: number) => (
										<TableRow key={item.id}>
											<TableCell className="font-medium">{index + 1}</TableCell>
											<TableCell className="font-medium">
												{item.description || "N/A"}
											</TableCell>
											<TableCell>{item.quantity}</TableCell>
											<TableCell>
												<Tooltip>
													<TooltipTrigger asChild>
														<span className="truncate block max-w-[130px] cursor-help">
															₹{item.unit_price.toFixed(2)}
														</span>
													</TooltipTrigger>
													<TooltipContent>
														<p>Unit Price: ₹{item.unit_price.toFixed(2)}</p>
													</TooltipContent>
												</Tooltip>
											</TableCell>
											<TableCell>{item.discount_percent || 0}%</TableCell>
											{invoice.is_gst_invoice && (
												<TableCell>{item.gst_rate || 0}%</TableCell>
											)}
											{invoice.is_gst_invoice && (
												<TableCell>
													<Tooltip>
														<TooltipTrigger asChild>
															<span className="truncate block max-w-[130px] cursor-help">
																₹{(item.gst_amount || 0).toFixed(2)}
															</span>
														</TooltipTrigger>
														<TooltipContent>
															<p>
																GST Amount: ₹{(item.gst_amount || 0).toFixed(2)}
															</p>
														</TooltipContent>
													</Tooltip>
												</TableCell>
											)}
											<TableCell className="font-medium">
												<Tooltip>
													<TooltipTrigger asChild>
														<span className="truncate block max-w-[130px] cursor-help">
															₹{item.line_total.toFixed(2)}
														</span>
													</TooltipTrigger>
													<TooltipContent>
														<p>Line Total: ₹{item.line_total.toFixed(2)}</p>
													</TooltipContent>
												</Tooltip>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Totals */}
			<Card>
				<CardContent className="p-4 md:p-6">
					<div className="ml-auto w-full sm:max-w-sm space-y-2">
						<div className="flex justify-between">
							<span>Subtotal:</span>
							<span className="font-medium">
								₹{invoice.subtotal.toFixed(2)}
							</span>
						</div>
						{invoice.is_gst_invoice && (
							<>
								{invoice.cgst_amount > 0 && (
									<div className="flex justify-between">
										<span>CGST:</span>
										<span className="font-medium">
											₹{invoice.cgst_amount.toFixed(2)}
										</span>
									</div>
								)}
								{invoice.sgst_amount > 0 && (
									<div className="flex justify-between">
										<span>SGST:</span>
										<span className="font-medium">
											₹{invoice.sgst_amount.toFixed(2)}
										</span>
									</div>
								)}
								{invoice.igst_amount > 0 && (
									<div className="flex justify-between">
										<span>IGST:</span>
										<span className="font-medium">
											₹{invoice.igst_amount.toFixed(2)}
										</span>
									</div>
								)}
							</>
						)}
						<div className="flex justify-between border-t pt-2 text-lg font-bold">
							<span>Total:</span>
							<span>₹{invoice.total_amount.toFixed(2)}</span>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Notes and Terms */}
			{(invoice.notes || invoice.terms) && (
				<div className="grid gap-4 md:gap-6 md:grid-cols-2">
					{invoice.notes && (
						<Card>
							<CardHeader>
								<CardTitle>Notes</CardTitle>
							</CardHeader>
							<CardContent>
								<p className="whitespace-pre-wrap">{invoice.notes}</p>
							</CardContent>
						</Card>
					)}
					{invoice.terms && (
						<Card>
							<CardHeader>
								<CardTitle>Terms & Conditions</CardTitle>
							</CardHeader>
							<CardContent>
								<p className="whitespace-pre-wrap">{invoice.terms}</p>
							</CardContent>
						</Card>
					)}
				</div>
			)}
		</div>
	);
}
