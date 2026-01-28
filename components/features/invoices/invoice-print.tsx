"use client";

import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	executeInvoiceAction,
	type InvoiceDocumentSource,
} from "@/lib/invoice-document-engine";

interface InvoicePrintProps {
	invoiceId: string;
	invoiceNumber: string;
	invoiceData?: any; // Optional: pass invoice data if already loaded
}

export function InvoicePrint({
	invoiceId,
	invoiceNumber,
	invoiceData,
}: InvoicePrintProps) {
	const { toast } = useToast();
	const [isGenerating, setIsGenerating] = useState(false);
	const [format, setFormat] = useState<"invoice" | "slip">("invoice");

	const handlePrint = async (selectedFormat?: "invoice" | "slip") => {
		const currentFormat = selectedFormat || format;
		setIsGenerating(true);
		try {
			// Prepare source data if provided
			const source: InvoiceDocumentSource | undefined = invoiceData
				? {
						invoice: invoiceData,
						items: invoiceData.invoice_items || invoiceData.items || [],
						customer: invoiceData.customers || invoiceData.customer || null,
						profile: invoiceData.profile || null,
					}
				: undefined;

			// Use unified document engine
			await executeInvoiceAction({
				invoiceId,
				action: "print",
				format: currentFormat,
				source,
				onProgress: (message) => {
					console.log(`[InvoicePrint] ${message}`);
				},
			});

			toast({
				title: "Success",
				description: `Invoice PDF (${currentFormat.toUpperCase()}) generated. Opening in new window...`,
			});
		} catch (error: any) {
			console.error("[InvoicePrint] Print process error:", error);
			toast({
				title: "Error",
				description:
					error?.message ||
					"Failed to generate invoice PDF. Check console for details.",
				variant: "destructive",
			});
		} finally {
			setIsGenerating(false);
		}
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="outline" disabled={isGenerating} className="gap-2">
					<Printer className="h-4 w-4" />
					{isGenerating ? "Generating..." : "Print Invoice"}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<DropdownMenuItem
					onClick={() => {
						handlePrint("invoice");
					}}
				>
					Print Invoice
				</DropdownMenuItem>
				<DropdownMenuItem
					onClick={() => {
						handlePrint("slip");
					}}
				>
					Print Slip
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
