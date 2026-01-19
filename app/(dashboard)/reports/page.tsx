"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Tooltip as UITooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { DollarSign, TrendingUp, Package, Receipt } from "lucide-react";
import { db } from "@/lib/dexie-client";
import { formatCurrency } from "@/lib/utils/format-number";

export default function ReportsPage() {
	const [loading, setLoading] = useState(true);
	const [invoices, setInvoices] = useState<any[]>([]);
	const [products, setProducts] = useState<any[]>([]);

	useEffect(() => {
		(async () => {
			setLoading(true);
			try {
				// Check database mode first
				const { getActiveDbModeAsync } = await import("@/lib/utils/db-mode");
				const dbMode = await getActiveDbModeAsync();
				const isIndexedDb = dbMode === 'indexeddb';

				if (isIndexedDb) {
					// IndexedDB mode - load from Dexie
					const [inv, prod] = await Promise.all([
						db.invoices.toArray(),
						db.products.toArray(),
					]);
					setInvoices(inv || []);
					setProducts(prod || []);
				} else {
					// Supabase mode - load from Supabase
					const supabase = createClient();
					const {
						data: { user },
					} = await supabase.auth.getUser();
					if (!user) {
						// Fallback to IndexedDB if no user
						const [inv, prod] = await Promise.all([
							db.invoices.toArray(),
							db.products.toArray(),
						]);
						setInvoices(inv || []);
						setProducts(prod || []);
					} else {
						const [{ data: inv }, { data: prod }] = await Promise.all([
							supabase.from("invoices").select("*").eq("user_id", user.id),
							supabase.from("products").select("*").eq("user_id", user.id),
						]);
						if (inv) setInvoices(inv);
						if (prod) setProducts(prod);
					}
				}
			} catch (error) {
				console.error("[Reports] Error loading data:", error);
				// Fallback to IndexedDB on error
				try {
					const [inv, prod] = await Promise.all([
						db.invoices.toArray(),
						db.products.toArray(),
					]);
					setInvoices(inv || []);
					setProducts(prod || []);
				} catch (fallbackError) {
					console.error("[Reports] Fallback also failed:", fallbackError);
				}
			} finally {
				setLoading(false);
			}
		})();
	}, []);

	const totalRevenue =
		invoices?.reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0) || 0;
	const paidRevenue =
		invoices
			?.filter((inv) => inv.status === "paid")
			.reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0) || 0;
	const totalGST =
		invoices?.reduce(
			(sum, inv) =>
				sum +
				Number(inv.cgst_amount || 0) +
				Number(inv.sgst_amount || 0) +
				Number(inv.igst_amount || 0),
			0
		) || 0;
	const totalProducts = products?.length || 0;
	const lowStockCount =
		products?.filter((p) => (p.stock_quantity ?? Infinity) <= 10).length || 0;

	if (loading) return <div className="p-6">Loading...</div>;

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-3xl font-bold">Reports & Analytics</h1>
				<p className="text-muted-foreground">
					View your business performance and insights
				</p>
			</div>

			{/* Summary Cards */}
			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
				<Card>
					<CardHeader className="flex flex-row items-center justify-between pb-2">
						<CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
						<DollarSign className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<UITooltip>
							<TooltipTrigger asChild>
								<div className="text-xl md:text-2xl font-bold truncate cursor-help">
									{formatCurrency(totalRevenue)}
								</div>
							</TooltipTrigger>
							<TooltipContent>
								Total Revenue: ₹{totalRevenue.toLocaleString("en-IN")}
							</TooltipContent>
						</UITooltip>
						<p className="text-xs text-muted-foreground">All invoices</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between pb-2">
						<CardTitle className="text-sm font-medium">Paid Revenue</CardTitle>
						<TrendingUp className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<UITooltip>
							<TooltipTrigger asChild>
								<div className="text-xl md:text-2xl font-bold truncate cursor-help">
									{formatCurrency(paidRevenue)}
								</div>
							</TooltipTrigger>
							<TooltipContent>
								Paid Revenue: ₹{paidRevenue.toLocaleString("en-IN")}
							</TooltipContent>
						</UITooltip>
						<p className="text-xs text-muted-foreground">Collected payments</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between pb-2">
						<CardTitle className="text-sm font-medium">Total GST</CardTitle>
						<Receipt className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<UITooltip>
							<TooltipTrigger asChild>
								<div className="text-xl md:text-2xl font-bold truncate cursor-help">
									{formatCurrency(totalGST)}
								</div>
							</TooltipTrigger>
							<TooltipContent>
								Total GST: ₹{totalGST.toLocaleString("en-IN")}
							</TooltipContent>
						</UITooltip>
						<p className="text-xs text-muted-foreground">Tax collected</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between pb-2">
						<CardTitle className="text-sm font-medium">Inventory</CardTitle>
						<Package className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<UITooltip>
							<TooltipTrigger asChild>
								<div className="text-2xl font-bold cursor-help">
									{totalProducts}
								</div>
							</TooltipTrigger>
							<TooltipContent>Total Products: {totalProducts}</TooltipContent>
						</UITooltip>
						<p className="text-xs text-muted-foreground">
							<UITooltip>
								<TooltipTrigger asChild>
									<span className="cursor-help">
										{lowStockCount} low stock items
									</span>
								</TooltipTrigger>
								<TooltipContent>
									Low Stock Items: {lowStockCount}
								</TooltipContent>
							</UITooltip>
						</p>
					</CardContent>
				</Card>
			</div>

			{/* Detailed Reports */}
			<div className="grid gap-6 lg:grid-cols-2">
				<Card>
					<CardHeader>
						<CardTitle>Sales by Status</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="space-y-4">
							{["draft", "sent", "paid", "cancelled"].map((status) => {
								const count =
									invoices?.filter((inv) => inv.status === status).length || 0;
								const amount =
									invoices
										?.filter((inv) => inv.status === status)
										.reduce(
											(sum, inv) => sum + Number(inv.total_amount || 0),
											0
										) || 0;
								return (
									<div
										key={status}
										className="flex items-center justify-between"
									>
										<div>
											<p className="font-medium capitalize">{status}</p>
											<p className="text-sm text-muted-foreground">
												<UITooltip>
													<TooltipTrigger asChild>
														<span className="cursor-help">
															{count} invoices
														</span>
													</TooltipTrigger>
													<TooltipContent>
														{status.charAt(0).toUpperCase() + status.slice(1)}{" "}
														Invoices: {count}
													</TooltipContent>
												</UITooltip>
											</p>
										</div>
										<UITooltip>
											<TooltipTrigger asChild>
												<p className="font-medium text-sm md:text-base truncate max-w-[120px] cursor-help">
													{formatCurrency(amount)}
												</p>
											</TooltipTrigger>
											<TooltipContent>
												{status.charAt(0).toUpperCase() + status.slice(1)}{" "}
												Amount: ₹{amount.toLocaleString("en-IN")}
											</TooltipContent>
										</UITooltip>
									</div>
								);
							})}
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>GST Breakdown</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="space-y-4">
							<div className="flex items-center justify-between">
								<div>
									<p className="font-medium">CGST</p>
									<p className="text-sm text-muted-foreground">Central GST</p>
								</div>
								<UITooltip>
									<TooltipTrigger asChild>
										<p className="font-medium text-sm md:text-base truncate max-w-[120px] cursor-help">
											{formatCurrency(
												invoices?.reduce(
													(sum, inv) => sum + Number(inv.cgst_amount || 0),
													0
												) || 0
											)}
										</p>
									</TooltipTrigger>
									<TooltipContent>
										CGST: {formatCurrency(
											invoices?.reduce(
												(sum, inv) => sum + Number(inv.cgst_amount || 0),
												0
											) || 0
										)}
									</TooltipContent>
								</UITooltip>
							</div>
							<div className="flex items-center justify-between">
								<div>
									<p className="font-medium">SGST</p>
									<p className="text-sm text-muted-foreground">State GST</p>
								</div>
								<UITooltip>
									<TooltipTrigger asChild>
										<p className="font-medium text-sm md:text-base truncate max-w-[120px] cursor-help">
											{formatCurrency(
												invoices?.reduce(
													(sum, inv) => sum + Number(inv.sgst_amount || 0),
													0
												) || 0
											)}
										</p>
									</TooltipTrigger>
									<TooltipContent>
										SGST: {formatCurrency(
											invoices?.reduce(
												(sum, inv) => sum + Number(inv.sgst_amount || 0),
												0
											) || 0
										)}
									</TooltipContent>
								</UITooltip>
							</div>
							<div className="flex items-center justify-between">
								<div>
									<p className="font-medium">IGST</p>
									<p className="text-sm text-muted-foreground">
										Integrated GST
									</p>
								</div>
								<UITooltip>
									<TooltipTrigger asChild>
										<p className="font-medium text-sm md:text-base truncate max-w-[120px] cursor-help">
											{formatCurrency(
												invoices?.reduce(
													(sum, inv) => sum + Number(inv.igst_amount || 0),
													0
												) || 0
											)}
										</p>
									</TooltipTrigger>
									<TooltipContent>
										IGST: {formatCurrency(
											invoices?.reduce(
												(sum, inv) => sum + Number(inv.igst_amount || 0),
												0
											) || 0
										)}
									</TooltipContent>
								</UITooltip>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
