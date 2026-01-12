"use client";

import { useState, useEffect } from "react";
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
import { Input } from "@/components/ui/input";
import {
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	Legend,
	ResponsiveContainer,
	LineChart,
	Line,
} from "recharts";
import { Download } from "lucide-react";

export default function SalesReportPage() {
	const [startDate, setStartDate] = useState("");
	const [endDate, setEndDate] = useState("");
	const [salesData, setSalesData] = useState<any[]>([]);
	const [loading, setLoading] = useState(false);
	const supabase = createClient();

	useEffect(() => {
		// Set default date range (last 30 days)
		const end = new Date();
		const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
		setEndDate(end.toISOString().split("T")[0]);
		setStartDate(start.toISOString().split("T")[0]);
	}, []);

	useEffect(() => {
		if (startDate && endDate) {
			fetchSalesData();
		}
	}, [startDate, endDate]);

	const fetchSalesData = async () => {
		setLoading(true);
		try {
			const dbMode = await getActiveDbModeAsync();
			const isIndexedDb = dbMode === 'indexeddb';
			
			let invoices: any[] = [];
			
			if (isIndexedDb) {
				// IndexedDB mode - load from Dexie (works offline)
				const allInvoices = await db.invoices.toArray();
				// Filter by date range
				invoices = allInvoices.filter((inv) => {
					const invDate = inv.invoice_date;
					return invDate >= startDate && invDate <= endDate;
				});
			} else {
				// Supabase mode - load from Supabase
				const {
					data: { user },
				} = await supabase.auth.getUser();
				if (!user) return;

				const { data } = await supabase
					.from("invoices")
					.select("*")
					.eq("user_id", user.id)
					.gte("invoice_date", startDate)
					.lte("invoice_date", endDate);
				
				invoices = data || [];
			}

			// Group by date
			const grouped: Record<string, number> = {};
			invoices?.forEach((inv) => {
				const date = inv.invoice_date;
				grouped[date] = (grouped[date] || 0) + Number(inv.total_amount || 0);
			});

			const chartData = Object.entries(grouped)
				.map(([date, amount]) => ({
					date: new Date(date).toLocaleDateString("en-IN"),
					amount: Number(amount),
				}))
				.sort(
					(a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
				);

			setSalesData(chartData);
		} catch (error) {
			console.error("Error fetching sales data:", error);
		} finally {
			setLoading(false);
		}
	};

	const totalSales = salesData.reduce((sum, item) => sum + item.amount, 0);
	const avgDaily = salesData.length > 0 ? totalSales / salesData.length : 0;

	const exportToExcel = () => {
		const csv = [
			["Date", "Sales Amount"],
			...salesData.map((item) => [item.date, item.amount]),
			["Total", totalSales],
		];
		const csvContent = csv.map((row) => row.join(",")).join("\n");
		const blob = new Blob([csvContent], { type: "text/csv" });
		const url = window.URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `sales-report-${startDate}-to-${endDate}.csv`;
		a.click();
	};

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-3xl font-bold">Sales Report</h1>
				<p className="text-muted-foreground">
					Track your sales performance over time
				</p>
			</div>

			{/* Date Range Filter */}
			<Card>
				<CardHeader>
					<CardTitle>Filter by Date Range</CardTitle>
				</CardHeader>
				<CardContent className="flex gap-4 flex-wrap">
					<div className="flex-1 min-w-[200px]">
						<label className="text-sm font-medium">Start Date</label>
						<Input
							type="date"
							value={startDate}
							onChange={(e) => setStartDate(e.target.value)}
							className="mt-1"
						/>
					</div>
					<div className="flex-1 min-w-[200px]">
						<label className="text-sm font-medium">End Date</label>
						<Input
							type="date"
							value={endDate}
							onChange={(e) => setEndDate(e.target.value)}
							className="mt-1"
						/>
					</div>
					<div className="flex items-end">
						<Button
							onClick={exportToExcel}
							variant="outline"
							className="gap-2 bg-transparent"
						>
							<Download className="h-4 w-4" />
							Export CSV
						</Button>
					</div>
				</CardContent>
			</Card>

			{/* Summary Cards */}
			<div className="grid gap-4 md:grid-cols-2">
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium">Total Sales</CardTitle>
					</CardHeader>
					<CardContent>
						<UITooltip>
							<TooltipTrigger asChild>
								<div className="text-xl md:text-2xl font-bold truncate cursor-help">
									₹{totalSales.toLocaleString("en-IN")}
								</div>
							</TooltipTrigger>
							<TooltipContent>
								Total Sales: ₹{totalSales.toLocaleString("en-IN")}
							</TooltipContent>
						</UITooltip>
						<p className="text-xs text-muted-foreground mt-1">
							{salesData.length} days of data
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium">
							Average Daily Sales
						</CardTitle>
					</CardHeader>
					<CardContent>
						<UITooltip>
							<TooltipTrigger asChild>
								<div className="text-xl md:text-2xl font-bold truncate cursor-help">
									₹{avgDaily.toLocaleString("en-IN")}
								</div>
							</TooltipTrigger>
							<TooltipContent>
								Avg Daily Sales: ₹{avgDaily.toLocaleString("en-IN")}
							</TooltipContent>
						</UITooltip>
						<p className="text-xs text-muted-foreground mt-1">
							Per day average
						</p>
					</CardContent>
				</Card>
			</div>

			{/* Sales Chart */}
			<Card>
				<CardHeader>
					<CardTitle>Sales Trend</CardTitle>
				</CardHeader>
				<CardContent>
					{loading ? (
						<div className="h-[400px] flex items-center justify-center">
							Loading...
						</div>
					) : salesData.length > 0 ? (
						<ResponsiveContainer width="100%" height={400}>
							<LineChart data={salesData}>
								<CartesianGrid strokeDasharray="3 3" />
								<XAxis dataKey="date" />
								<YAxis />
								<Tooltip
									formatter={(value) => `₹${value.toLocaleString("en-IN")}`}
								/>
								<Legend />
								<Line
									type="monotone"
									dataKey="amount"
									stroke="#3b82f6"
									name="Daily Sales"
								/>
							</LineChart>
						</ResponsiveContainer>
					) : (
						<div className="h-[400px] flex items-center justify-center text-muted-foreground">
							No sales data available for this period
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
