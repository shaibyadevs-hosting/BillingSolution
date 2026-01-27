"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
	MessageCircle,
	WifiOff,
	Copy,
	Check,
	ExternalLink,
	Settings,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
// DORMANT: R2 imports kept for future fallback
// import { getInvoiceStorage } from "@/lib/utils/save-invoice-storage";
// import { executeInvoiceAction } from "@/lib/invoice-document-engine";
// import { R2UploadErrorModal } from "@/components/features/invoices/r2-upload-error-modal";
import { uploadInvoicePDFToSupabase } from "@/lib/utils/invoice-supabase-client";
// DORMANT: Slip functionality removed - using A4 invoice instead
// import { generateInvoiceSlipPDF } from "@/lib/utils/invoice-slip-pdf";
import { generateInvoicePDF } from "@/lib/utils/invoice-pdf";
import { prepareInvoiceDocumentData } from "@/lib/invoice-document-engine";
import { generateWhatsAppBillMessage, shareOnWhatsApp } from "@/lib/utils/whatsapp-bill";
import { createClient } from "@/lib/supabase/client";
import { RLSErrorModal } from "@/components/features/customers/rls-error-modal";

interface WhatsAppShareButtonProps {
	invoice: {
		id: string;
		invoice_number: string;
		invoice_date: string;
		total_amount: number;
		created_by_employee_id?: string;
		employee_id?: string;
		user_id?: string;
		is_gst_invoice?: boolean;
		subtotal?: number;
		cgst_amount?: number;
		sgst_amount?: number;
		igst_amount?: number;
	};
	items: Array<{
		description: string;
		quantity: number;
		unit_price: number;
		discount_percent?: number;
		gst_rate?: number;
		line_total?: number;
		gst_amount?: number;
	}>;
	storeName: string;
	invoiceLink: string;
	customer?: {
		name?: string;
		email?: string;
		phone?: string;
		gstin?: string;
	};
	profile?: {
		business_name?: string;
		business_gstin?: string;
		business_address?: string;
		business_phone?: string;
		business_email?: string;
		logo_url?: string;
	};
}

export function WhatsAppShareButton({
	invoice,
	items,
	storeName,
	invoiceLink,
	customer,
	profile,
}: WhatsAppShareButtonProps) {
	const { toast } = useToast();
	const [isOnline, setIsOnline] = useState(true);
	const [isSharing, setIsSharing] = useState(false);
	const [isSharingSupabase, setIsSharingSupabase] = useState(false);
	const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
	const [showLinkModal, setShowLinkModal] = useState(false);
	const [linkCopied, setLinkCopied] = useState(false);
	// DORMANT: R2 error modal state removed
	// const [showErrorModal, setShowErrorModal] = useState(false);
	// const [uploadError, setUploadError] = useState<string | null>(null);
	const [showStorageRLSErrorModal, setShowStorageRLSErrorModal] = useState(false);
	const [storageRLSErrorDetails, setStorageRLSErrorDetails] = useState<any>(null);
	const shareTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	// DORMANT: Server-side toggle removed - Supabase flow uses client-side only
	// const [useServerSide, setUseServerSide] = useState(() => {
	// 	if (typeof window !== "undefined") {
	// 		const saved = localStorage.getItem("whatsapp-pdf-use-server-side");
	// 		return saved !== null ? saved === "true" : true;
	// 	}
	// 	return true;
	// });
	// const [showSettings, setShowSettings] = useState(false);

	useEffect(() => {
		// Check initial online status
		setIsOnline(navigator.onLine);

		// Listen for online/offline events
		const handleOnline = () => setIsOnline(true);
		const handleOffline = () => setIsOnline(false);

		window.addEventListener("online", handleOnline);
		window.addEventListener("offline", handleOffline);

		return () => {
			window.removeEventListener("online", handleOnline);
			window.removeEventListener("offline", handleOffline);
		};
	}, []);

	// PRIMARY: Supabase Storage WhatsApp share handler
	// R2 flow is now dormant (kept for future fallback)
	const handleShare = async () => {
		// Prevent double-clicks and multiple simultaneous shares
		if (isSharing || isSharingSupabase || shareTimeoutRef.current) {
			console.warn("[WhatsAppShare] Share already in progress, ignoring duplicate click");
			return;
		}
		
		// Set debounce timeout
		if (shareTimeoutRef.current) {
			clearTimeout(shareTimeoutRef.current);
		}
		shareTimeoutRef.current = setTimeout(() => {
			shareTimeoutRef.current = null;
		}, 3000); // 3 second debounce

		if (!isOnline) {
			toast({
				title: "Internet Required",
				description:
					"Internet connection is required to share invoice on WhatsApp",
				variant: "destructive",
			});
			return;
		}

		setIsSharing(true);

		try {
			// Step 1: Prepare invoice document data
			const source = {
				invoice,
				items,
				customer,
				profile,
				storeName,
			};

			const pdfData = await prepareInvoiceDocumentData(source);

			// Step 2: Generate PDF (client-side for consistency)
			toast({
				title: "Generating PDF...",
				description: "Please wait while we generate your invoice PDF",
				duration: 2000,
			});

			// DORMANT: Slip removed - using A4 invoice PDF instead
			// const pdfBlob = await generateInvoiceSlipPDF(pdfData, {
			// 	useServerSide: false, // Use client-side for consistency
			// });
			const pdfBlob = await generateInvoicePDF(pdfData);

			// Step 3: Get userId (admin's ID for employees)
			const supabase = createClient();
			const authType = localStorage.getItem("authType");
			let userId: string | null = null;

			if (authType === "employee") {
				const empSession = localStorage.getItem("employeeSession");
				if (empSession) {
					const session = JSON.parse(empSession);
					const sessionStoreId = session.storeId;
					if (sessionStoreId) {
						const { data: store } = await supabase
							.from("stores")
							.select("admin_user_id")
							.eq("id", sessionStoreId)
							.single();
						if (store?.admin_user_id) {
							userId = store.admin_user_id;
						}
					}
				}
			} else {
				const { data: { user } } = await supabase.auth.getUser();
				if (user) userId = user.id;
			}

			if (!userId) {
				throw new Error("Could not determine user ID. Please ensure you're logged in.");
			}

			// Step 4: Upload to Supabase Storage
			toast({
				title: "Uploading to Supabase...",
				description: "Uploading PDF to cloud storage",
				duration: 2000,
			});

			const uploadResult = await uploadInvoicePDFToSupabase(
				pdfBlob,
				userId,
				invoice.id,
				invoice.invoice_number
			);

			if (!uploadResult.success || !uploadResult.publicUrl) {
				// Check if it's an RLS error from the API response
				const errorMessage = uploadResult.error || "Failed to upload PDF to Supabase";
				const isRLSError = errorMessage.toLowerCase().includes("row-level security") ||
								   errorMessage.toLowerCase().includes("policy") ||
								   errorMessage.toLowerCase().includes("rls");

				// If the error response includes errorDetails, use it
				if (isRLSError && (uploadResult as any).errorDetails) {
					setStorageRLSErrorDetails({
						errorCode: (uploadResult as any).errorDetails.errorCode || "STORAGE_RLS_ERROR",
						errorMessage: errorMessage,
						policyName: "Storage bucket RLS policy",
						bucket: (uploadResult as any).errorDetails.bucket || "invoice-pdfs",
						storagePath: (uploadResult as any).errorDetails.storagePath,
						userId,
						diagnostics: (uploadResult as any).errorDetails.diagnostics,
						attemptedValues: {
							user_id: userId,
							storage_path: (uploadResult as any).errorDetails.storagePath,
						},
					});
					setShowStorageRLSErrorModal(true);
				}
				
				throw new Error(errorMessage);
			}

			// Step 5: Generate WhatsApp message with Supabase URL
			const whatsappMessage = generateWhatsAppBillMessage({
				storeName: pdfData.businessName || storeName,
				invoiceNumber: invoice.invoice_number,
				invoiceDate: invoice.invoice_date,
				items: items.map((item) => ({
					name: item.description,
					quantity: item.quantity,
					unitPrice: item.unit_price,
				})),
				totalAmount: invoice.total_amount,
				pdfR2Url: uploadResult.publicUrl, // Reuse same key for compatibility
			});

			// Step 6: Open WhatsApp ONCE after upload completes (inside click handler to preserve user gesture)
			toast({
				title: "Opening WhatsApp...",
				description: "PDF uploaded successfully",
				duration: 1000,
			});

			const shareResult = await shareOnWhatsApp(whatsappMessage);

			if (!shareResult.success) {
				throw new Error("Failed to open WhatsApp. Please check your popup blocker settings.");
			}

			toast({
				title: "✅ WhatsApp Opened",
				description: "PDF uploaded to Supabase and WhatsApp opened with PDF link.",
				duration: 3000,
			});
		} catch (error) {
			console.error("[WhatsAppShare] Error:", error);
			const errorMessage =
				error instanceof Error
					? error.message
					: "Failed to prepare WhatsApp message. Please try again.";

			// Check if RLS modal is already shown
			const isRLSError = errorMessage.toLowerCase().includes("row-level security") ||
							   errorMessage.toLowerCase().includes("policy") ||
							   errorMessage.toLowerCase().includes("rls");

			if (!isRLSError || !showStorageRLSErrorModal) {
				toast({
					title: "Error",
					description: errorMessage,
					variant: "destructive",
					duration: 5000,
				});
			}
		} finally {
			setIsSharing(false);
			if (shareTimeoutRef.current) {
				clearTimeout(shareTimeoutRef.current);
				shareTimeoutRef.current = null;
			}
		}
	};

	// DORMANT: R2 retry handler removed
	// const handleRetryUpload = () => {
	// 	handleShare();
	// };

	// DORMANT: R2 WhatsApp share handler (kept for future fallback)
	// NOTE: This function is inactive - Supabase is now primary
	// To reactivate: uncomment and update handleShare to call this instead
	const handleShareSupabase_DORMANT = async () => {
		// Prevent double-clicks
		if (isSharingSupabase) {
			console.warn("[WhatsAppShareSupabase] Share already in progress, ignoring duplicate click");
			return;
		}

		if (!isOnline) {
			toast({
				title: "Internet Required",
				description: "Internet connection is required to share invoice on WhatsApp",
				variant: "destructive",
			});
			return;
		}

		setIsSharingSupabase(true);

		try {
			// Step 1: Prepare invoice document data
			const source = {
				invoice,
				items,
				customer,
				profile,
				storeName,
			};

			const pdfData = await prepareInvoiceDocumentData(source);

			// Step 2: Generate PDF
			toast({
				title: "Generating PDF...",
				description: "Please wait while we generate your invoice PDF",
				duration: 2000,
			});

			// DORMANT: Slip removed - using A4 invoice PDF instead
			// const pdfBlob = await generateInvoiceSlipPDF(pdfData, {
			// 	useServerSide: false, // Use client-side for consistency
			// });
			const pdfBlob = await generateInvoicePDF(pdfData);

			// Step 3: Get userId (admin's ID for employees)
			const supabase = createClient();
			const authType = localStorage.getItem("authType");
			let userId: string | null = null;

			if (authType === "employee") {
				const empSession = localStorage.getItem("employeeSession");
				if (empSession) {
					const session = JSON.parse(empSession);
					const sessionStoreId = session.storeId;
					if (sessionStoreId) {
						const { data: store } = await supabase
							.from("stores")
							.select("admin_user_id")
							.eq("id", sessionStoreId)
							.single();
						if (store?.admin_user_id) {
							userId = store.admin_user_id;
						}
					}
				}
			} else {
				const { data: { user } } = await supabase.auth.getUser();
				if (user) userId = user.id;
			}

			if (!userId) {
				throw new Error("Could not determine user ID. Please ensure you're logged in.");
			}

			// Step 4: Upload to Supabase Storage
			toast({
				title: "Uploading to Supabase...",
				description: "Uploading PDF to cloud storage",
				duration: 2000,
			});

			const uploadResult = await uploadInvoicePDFToSupabase(
				pdfBlob,
				userId,
				invoice.id,
				invoice.invoice_number
			);

			if (!uploadResult.success || !uploadResult.publicUrl) {
				// Check if it's an RLS error from the API response
				const errorMessage = uploadResult.error || "Failed to upload PDF to Supabase";
				const isRLSError = errorMessage.toLowerCase().includes("row-level security") ||
								   errorMessage.toLowerCase().includes("policy") ||
								   errorMessage.toLowerCase().includes("rls");

				// If the error response includes errorDetails, use it
				if (isRLSError && (uploadResult as any).errorDetails) {
					setStorageRLSErrorDetails({
						errorCode: (uploadResult as any).errorDetails.errorCode || "STORAGE_RLS_ERROR",
						errorMessage: errorMessage,
						policyName: "Storage bucket RLS policy",
						bucket: (uploadResult as any).errorDetails.bucket || "invoice-pdfs",
						storagePath: (uploadResult as any).errorDetails.storagePath,
						userId,
						diagnostics: (uploadResult as any).errorDetails.diagnostics,
						attemptedValues: {
							user_id: userId,
							storage_path: (uploadResult as any).errorDetails.storagePath,
						},
					});
					setShowStorageRLSErrorModal(true);
				}
				
				throw new Error(errorMessage);
			}

			// Step 5: Generate WhatsApp message with Supabase URL
			const whatsappMessage = generateWhatsAppBillMessage({
				storeName: pdfData.businessName || storeName,
				invoiceNumber: invoice.invoice_number,
				invoiceDate: invoice.invoice_date,
				items: items.map((item) => ({
					name: item.description,
					quantity: item.quantity,
					unitPrice: item.unit_price,
				})),
				totalAmount: invoice.total_amount,
				pdfR2Url: uploadResult.publicUrl, // Reuse same key for compatibility
			});

			// Step 6: Open WhatsApp immediately (inside click handler to preserve user gesture)
			const shareResult = await shareOnWhatsApp(whatsappMessage);

			if (!shareResult.success) {
				throw new Error("Failed to open WhatsApp. Please check your popup blocker settings.");
			}

			toast({
				title: "✅ WhatsApp Opened",
				description: "PDF uploaded to Supabase and WhatsApp opened with PDF link.",
				duration: 3000,
			});
		} catch (error) {
			console.error("[WhatsAppShareSupabase] Error:", error);
			const errorMessage =
				error instanceof Error
					? error.message
					: "Failed to prepare WhatsApp message. Please try again.";

			// Check if RLS modal is already shown
			const isRLSError = errorMessage.toLowerCase().includes("row-level security") ||
							   errorMessage.toLowerCase().includes("policy") ||
							   errorMessage.toLowerCase().includes("rls");

			if (!isRLSError || !showStorageRLSErrorModal) {
				toast({
					title: "Error",
					description: errorMessage,
					variant: "destructive",
					duration: 5000,
				});
			}
		} finally {
			setIsSharingSupabase(false);
		}
	};

	const handleCopyLink = async () => {
		if (uploadedUrl) {
			try {
				await navigator.clipboard.writeText(uploadedUrl);
				setLinkCopied(true);
				toast({
					title: "Link Copied!",
					description: "PDF link has been copied to clipboard.",
					duration: 2000,
				});
				setTimeout(() => setLinkCopied(false), 2000);
			} catch (err) {
				toast({
					title: "Copy Failed",
					description: "Failed to copy link. Please copy manually.",
					variant: "destructive",
				});
			}
		}
	};

	const handleOpenLink = () => {
		if (uploadedUrl) {
			window.open(uploadedUrl, "_blank", "noopener,noreferrer");
		}
	};

	return (
		<>
			{/* DORMANT: R2 error modal removed - Supabase uses RLS error modal */}
			<RLSErrorModal
				open={showStorageRLSErrorModal}
				onOpenChange={setShowStorageRLSErrorModal}
				errorDetails={storageRLSErrorDetails || {}}
				onRetry={() => {
					setShowStorageRLSErrorModal(false);
					handleShare();
				}}
			/>
			<div className="flex items-center gap-2">
				<Button
					onClick={handleShare}
					disabled={!isOnline || isSharing || isSharingSupabase}
					variant="outline"
					className="gap-2"
					title={
						!isOnline
							? "Internet required to share invoice"
							: "Share invoice on WhatsApp"
					}
				>
					{!isOnline ? (
						<>
							<WifiOff className="h-4 w-4" />
							<span>Offline</span>
						</>
					) : (
						<>
							<MessageCircle className="h-4 w-4" />
							<span>
								{isSharing ? "Opening..." : "Share on WhatsApp"}
							</span>
						</>
					)}
				</Button>
				{/* DORMANT: R2 button removed - Supabase is now primary */}
				{/* Settings button removed - no longer needed without R2 toggle */}
			</div>

			<Dialog open={showLinkModal} onOpenChange={setShowLinkModal}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>PDF Uploaded Successfully!</DialogTitle>
						<DialogDescription>
							Your invoice PDF has been uploaded to cloud storage. The link has
							been copied to your clipboard.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4">
						<div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
							<code className="flex-1 text-xs break-all">{uploadedUrl}</code>
						</div>
						<div className="flex items-center gap-2 text-sm text-muted-foreground">
							{linkCopied && (
								<span className="flex items-center gap-1 text-green-600">
									<Check className="h-4 w-4" />
									Copied!
								</span>
							)}
						</div>
					</div>
					<DialogFooter className="flex-col sm:flex-row gap-2">
						<Button
							variant="outline"
							onClick={handleCopyLink}
							className="w-full sm:w-auto"
						>
							<Copy className="h-4 w-4 mr-2" />
							{linkCopied ? "Copied!" : "Copy Link"}
						</Button>
						<Button onClick={handleOpenLink} className="w-full sm:w-auto">
							<ExternalLink className="h-4 w-4 mr-2" />
							Open PDF
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* DORMANT: Settings dialog removed - no longer needed without R2 toggle */}
		</>
	);
}
