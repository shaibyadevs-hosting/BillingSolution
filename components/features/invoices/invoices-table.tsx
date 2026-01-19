"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { MoreHorizontal, Eye, Pencil, Trash2, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isIndexedDbMode } from "@/lib/utils/db-mode";
import { useToast } from "@/hooks/use-toast";
import { useInvalidateQueries } from "@/lib/hooks/use-cached-data";

interface Invoice {
	id: string;
	invoice_number: string;
	invoice_date: string;
	total_amount: number;
	status: "draft" | "sent" | "paid" | "cancelled";
	customers: { name: string } | null;
	employees?: { name: string; employee_id: string } | null;
	created_by_employee_id?: string;
	employee_id?: string;
}

interface InvoicesTableProps {
	invoices: Invoice[];
}

export function InvoicesTable({
	invoices: initialInvoices,
}: InvoicesTableProps) {
	const [invoices, setInvoices] = useState(initialInvoices);
	useEffect(() => {
		console.log(
			"[InvoicesTable] props changed, count =",
			initialInvoices?.length || 0
		);
		setInvoices(initialInvoices || []);
	}, [initialInvoices]);
	const [searchTerm, setSearchTerm] = useState("");
	const [statusFilter, setStatusFilter] = useState<string>("all");
	const router = useRouter();
	const { toast } = useToast();
	const { invalidateInvoices } = useInvalidateQueries();

	const filteredInvoices = invoices.filter((invoice) => {
		const matchesSearch =
			invoice.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
			(invoice.customers?.name || "")
				.toLowerCase()
				.includes(searchTerm.toLowerCase());

		const matchesStatus =
			statusFilter === "all" || invoice.status === statusFilter;

		return matchesSearch && matchesStatus;
	});

	const handleDelete = async (id: string) => {
		if (!confirm("Are you sure you want to delete this invoice?")) return;

		try {
			const isIndexedDb = isIndexedDbMode();

			if (isIndexedDb) {
				// Delete from IndexedDB
				const { storageManager } = await import("@/lib/storage-manager");
				await storageManager.deleteInvoice(id);
			} else {
				// Delete from Supabase - must delete invoice_items first (foreign key constraint)
				const supabase = createClient();
				
				// Delete invoice items first
				const { error: itemsError } = await supabase
					.from("invoice_items")
					.delete()
					.eq("invoice_id", id);
				
				if (itemsError) throw itemsError;
				
				// Then delete invoice
				const { error } = await supabase.from("invoices").delete().eq("id", id);
				if (error) throw error;
			}

			// Invalidate cache for instant UI update
			await invalidateInvoices();
			
			setInvoices(invoices.filter((inv) => inv.id !== id));
			toast({
				title: "Success",
				description: "Invoice deleted successfully",
			});
		} catch (error) {
			toast({
				title: "Error",
				description: "Failed to delete invoice",
				variant: "destructive",
			});
		}
	};

	const getStatusBadge = (status: string) => {
		const variants: Record<
			string,
			"default" | "secondary" | "outline" | "destructive"
		> = {
			draft: "outline",
			sent: "secondary",
			paid: "default",
			cancelled: "destructive",
		};
		return (
			<Badge variant={variants[status] || "outline"} className="capitalize">
				{status}
			</Badge>
		);
	};

	return (
		<Card>
			<CardContent className="p-4 sm:p-6">
				<div className="mb-4 flex flex-col gap-4 sm:flex-row">
					<div className="relative flex-1">
						<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							placeholder="Search by invoice number or customer..."
							value={searchTerm}
							onChange={(e) => setSearchTerm(e.target.value)}
							className="pl-9"
						/>
					</div>
					<Select value={statusFilter} onValueChange={setStatusFilter}>
						<SelectTrigger className="w-full sm:w-[180px]">
							<SelectValue placeholder="Filter by status" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Status</SelectItem>
							<SelectItem value="draft">Draft</SelectItem>
							<SelectItem value="sent">Sent</SelectItem>
							<SelectItem value="paid">Paid</SelectItem>
							<SelectItem value="cancelled">Cancelled</SelectItem>
						</SelectContent>
					</Select>
				</div>

				{filteredInvoices.length === 0 ? (
					<div className="py-12 text-center">
						<p className="text-muted-foreground">No invoices found</p>
						<Button asChild className="mt-4">
							<a href="/invoices/new">Create Your First Invoice</a>
						</Button>
					</div>
				) : (
					<div className="overflow-x-auto -mx-6 px-6">
						<div className="min-w-[700px]">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead className="min-w-[120px]">Invoice #</TableHead>
										<TableHead className="min-w-[150px]">Customer</TableHead>
										<TableHead className="min-w-[120px]">Generated By</TableHead>
										<TableHead className="min-w-[100px]">Date</TableHead>
										<TableHead className="text-right min-w-[120px]">
											Amount
										</TableHead>
										<TableHead className="min-w-[100px]">Status</TableHead>
										<TableHead className="w-[70px]"></TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{filteredInvoices.map((invoice) => (
										<TableRow
											key={invoice.id}
											className="cursor-pointer hover:bg-muted/50 transition-colors"
											onClick={(e) => {
												// Don't navigate if clicking on the dropdown menu
												if (
													(e.target as HTMLElement).closest(
														'[role="menuitem"], button'
													)
												) {
													return;
												}
												router.push(`/invoices/${invoice.id}`);
											}}
										>
											<TableCell className="font-medium">
												<Tooltip>
													<TooltipTrigger asChild>
														<span className="cursor-help">{invoice.invoice_number}</span>
													</TooltipTrigger>
													<TooltipContent>Invoice Number: {invoice.invoice_number}</TooltipContent>
												</Tooltip>
											</TableCell>
											<TableCell>
												<Tooltip>
													<TooltipTrigger asChild>
														<span className="cursor-help">{invoice.customers?.name || "No customer"}</span>
													</TooltipTrigger>
													<TooltipContent>{invoice.customers?.name ? `Customer: ${invoice.customers.name}` : "No customer assigned"}</TooltipContent>
												</Tooltip>
											</TableCell>
											<TableCell>
												<span className="text-sm text-muted-foreground">
													{invoice.employees?.name || invoice.created_by_employee_id || invoice.employee_id || "Admin"}
												</span>
											</TableCell>
											<TableCell>
												<Tooltip>
													<TooltipTrigger asChild>
														<span className="cursor-help">{new Date(invoice.invoice_date).toLocaleDateString()}</span>
													</TooltipTrigger>
													<TooltipContent>Invoice Date: {new Date(invoice.invoice_date).toLocaleDateString()}</TooltipContent>
												</Tooltip>
											</TableCell>
											<TableCell className="text-right">
												<Tooltip>
													<TooltipTrigger asChild>
														<span className="text-sm md:text-base truncate max-w-[120px] inline-block cursor-help">
															₹
															{Number(invoice.total_amount).toLocaleString(
																"en-IN"
															)}
														</span>
													</TooltipTrigger>
													<TooltipContent>
														Amount: ₹
														{Number(invoice.total_amount).toLocaleString(
															"en-IN"
														)}
													</TooltipContent>
												</Tooltip>
											</TableCell>
											<TableCell>
												<Tooltip>
													<TooltipTrigger asChild>
														<span className="cursor-help inline-block">{getStatusBadge(invoice.status)}</span>
													</TooltipTrigger>
													<TooltipContent>Status: {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}</TooltipContent>
												</Tooltip>
											</TableCell>
											<TableCell onClick={(e) => e.stopPropagation()}>
												<DropdownMenu>
													<DropdownMenuTrigger asChild>
														<Button variant="ghost" size="icon">
															<MoreHorizontal className="h-4 w-4" />
														</Button>
													</DropdownMenuTrigger>
													<DropdownMenuContent align="end">
														<DropdownMenuItem
															onClick={() =>
																router.push(`/invoices/${invoice.id}`)
															}
														>
															<Eye className="mr-2 h-4 w-4" />
															View
														</DropdownMenuItem>
														<DropdownMenuItem
															onClick={() =>
																router.push(`/invoices/${invoice.id}/edit`)
															}
														>
															<Pencil className="mr-2 h-4 w-4" />
															Edit
														</DropdownMenuItem>
														<DropdownMenuItem
															onClick={() => handleDelete(invoice.id)}
															className="text-destructive"
														>
															<Trash2 className="mr-2 h-4 w-4" />
															Delete
														</DropdownMenuItem>
													</DropdownMenuContent>
												</DropdownMenu>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
