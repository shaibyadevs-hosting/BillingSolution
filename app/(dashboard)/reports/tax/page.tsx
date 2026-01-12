"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { db } from "@/lib/dexie-client";
import { getActiveDbModeAsync } from "@/lib/utils/db-mode";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Tooltip as UITooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Download } from "lucide-react";

export default function TaxReportPage() {
	const [taxData, setTaxData] = useState<any>(null);
	const [loading, setLoading] = useState(true);
	const supabase = createClient();

	useEffect(() => {
		fetchTaxData();
	}, []);

	const fetchTaxData = async () => {
		try {
			const dbMode = await getActiveDbModeAsync();
			const isIndexedDb = dbMode === 'indexeddb';
			
			let invoices: any[] = [];
			
			if (isIndexedDb) {
				// IndexedDB mode - load from Dexie (works offline)
				invoices = await db.invoices.toArray();
			} else {
				// Supabase mode - load from Supabase
				const {
					data: { user },
				} = await supabase.auth.getUser();
				if (!user) return;

				const { data } = await supabase
					.from("invoices")
					.select("*")
					.eq("user_id", user.id);
				
				invoices = data || [];
			}

			const cgst =
				invoices?.reduce((sum, inv) => sum + Number(inv.cgst_amount || 0), 0) || 0;
			const sgst =
				invoices?.reduce((sum, inv) => sum + Number(inv.sgst_amount || 0), 0) || 0;
			const igst =
				invoices?.reduce((sum, inv) => sum + Number(inv.igst_amount || 0), 0) || 0;
			const totalTax = cgst + sgst + igst;

			setTaxData({
				cgst,
				sgst,
				igst,
				totalTax,
				gstInvoices: invoices?.filter((inv) => inv.is_gst_invoice).length || 0,
				nonGstInvoices:
					invoices?.filter((inv) => !inv.is_gst_invoice).length || 0,
			});
		} catch (error) {
			console.error("Error fetching tax data:", error);
		} finally {
			setLoading(false);
		}
	};

	const exportTaxReport = () => {
		if (!taxData) return;
		const csv = [
			["Tax Type", "Amount"],
			["CGST (Central GST)", taxData.cgst],
			["SGST (State GST)", taxData.sgst],
			["IGST (Integrated GST)", taxData.igst],
			["Total Tax", taxData.totalTax],
			[""],
			["Invoice Type", "Count"],
			["GST Invoices", taxData.gstInvoices],
			["Non-GST Invoices", taxData.nonGstInvoices],
		];
		const csvContent = csv.map((row) => row.join(",")).join("\n");
		const blob = new Blob([csvContent], { type: "text/csv" });
		const url = window.URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `tax-report-${new Date().toISOString().split("T")[0]}.csv`;
		a.click();
	};

	if (loading) return <div>Loading...</div>;
	if (!taxData) return <div>No data available</div>;

	const chartData = [
		{ name: "CGST", value: taxData.cgst },
		{ name: "SGST", value: taxData.sgst },
		{ name: "IGST", value: taxData.igst },
	].filter((item) => item.value > 0);

	const COLORS = ["#3b82f6", "#10b981", "#f59e0b"];

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold">Tax Report</h1>
					<p className="text-muted-foreground">GST breakdown and tax summary</p>
				</div>
				<Button
					onClick={exportTaxReport}
					variant="outline"
					className="gap-2 bg-transparent"
				>
					<Download className="h-4 w-4" />
					Export Report
				</Button>
			</div>

			{/* Tax Summary Cards */}
			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium">
							Total Tax Collected
						</CardTitle>
					</CardHeader>
					<CardContent>
						<UITooltip>
							<TooltipTrigger asChild>
								<div className="text-xl md:text-2xl font-bold truncate cursor-help">
									₹{taxData.totalTax.toLocaleString("en-IN")}
								</div>
							</TooltipTrigger>
							<TooltipContent>
								Total Tax: ₹{taxData.totalTax.toLocaleString("en-IN")}
							</TooltipContent>
						</UITooltip>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium">CGST</CardTitle>
					</CardHeader>
					<CardContent>
						<UITooltip>
							<TooltipTrigger asChild>
								<div className="text-xl md:text-2xl font-bold truncate cursor-help">
									₹{taxData.cgst.toLocaleString("en-IN")}
								</div>
							</TooltipTrigger>
							<TooltipContent>
								CGST: ₹{taxData.cgst.toLocaleString("en-IN")}
							</TooltipContent>
						</UITooltip>
						<p className="text-xs text-muted-foreground mt-1">Central GST</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium">SGST</CardTitle>
					</CardHeader>
					<CardContent>
						<UITooltip>
							<TooltipTrigger asChild>
								<div className="text-xl md:text-2xl font-bold truncate cursor-help">
									₹{taxData.sgst.toLocaleString("en-IN")}
								</div>
							</TooltipTrigger>
							<TooltipContent>
								SGST: ₹{taxData.sgst.toLocaleString("en-IN")}
							</TooltipContent>
						</UITooltip>
						<p className="text-xs text-muted-foreground mt-1">State GST</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium">IGST</CardTitle>
					</CardHeader>
					<CardContent>
						<UITooltip>
							<TooltipTrigger asChild>
								<div className="text-xl md:text-2xl font-bold truncate cursor-help">
									₹{taxData.igst.toLocaleString("en-IN")}
								</div>
							</TooltipTrigger>
							<TooltipContent>
								IGST: ₹{taxData.igst.toLocaleString("en-IN")}
							</TooltipContent>
						</UITooltip>
						<p className="text-xs text-muted-foreground mt-1">Integrated GST</p>
					</CardContent>
				</Card>
			</div>

			{/* Tax Distribution Chart */}
			{chartData.length > 0 && (
				<Card>
					<CardHeader>
						<CardTitle>Tax Distribution</CardTitle>
					</CardHeader>
					<CardContent>
						<ResponsiveContainer width="100%" height={300}>
							<PieChart>
								<Pie
									data={chartData}
									cx="50%"
									cy="50%"
									labelLine={false}
									label={({ name, value }) =>
										`${name}: ₹${value.toLocaleString("en-IN")}`
									}
									outerRadius={100}
									fill="#8884d8"
									dataKey="value"
								>
									{chartData.map((entry, index) => (
										<Cell
											key={`cell-${index}`}
											fill={COLORS[index % COLORS.length]}
										/>
									))}
								</Pie>
								<Tooltip
									formatter={(value) => `₹${value.toLocaleString("en-IN")}`}
								/>
							</PieChart>
						</ResponsiveContainer>
					</CardContent>
				</Card>
			)}

			{/* Invoice Type Summary */}
			<Card>
				<CardHeader>
					<CardTitle>Invoice Summary</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="grid gap-4 md:grid-cols-2">
						<div className="flex items-center justify-between p-4 border rounded-lg">
							<div>
								<p className="font-medium">GST Invoices</p>
								<p className="text-sm text-muted-foreground">
									With tax calculation
								</p>
							</div>
							<UITooltip>
								<TooltipTrigger asChild>
									<p className="text-2xl font-bold cursor-help">
										{taxData.gstInvoices}
									</p>
								</TooltipTrigger>
								<TooltipContent>
									GST Invoices: {taxData.gstInvoices}
								</TooltipContent>
							</UITooltip>
						</div>
						<div className="flex items-center justify-between p-4 border rounded-lg">
							<div>
								<p className="font-medium">Non-GST Invoices</p>
								<p className="text-sm text-muted-foreground">Without tax</p>
							</div>
							<UITooltip>
								<TooltipTrigger asChild>
									<p className="text-2xl font-bold cursor-help">
										{taxData.nonGstInvoices}
									</p>
								</TooltipTrigger>
								<TooltipContent>
									Non-GST Invoices: {taxData.nonGstInvoices}
								</TooltipContent>
							</UITooltip>
						</div>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
