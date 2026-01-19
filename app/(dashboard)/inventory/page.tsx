"use client";

import { useEffect, useMemo, useState } from "react";
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
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { createClient } from "@/lib/supabase/client";
import { db } from "@/lib/dexie-client";
import { getActiveDbModeAsync } from "@/lib/utils/db-mode";
import { formatLargeNumber, formatFullNumber } from "@/lib/utils/number-formatter";
import {
	AlertCircle,
	Boxes,
	Layers,
	PiggyBank,
	TrendingUp,
	Search,
	Filter,
} from "lucide-react";
import { useUserRole } from "@/lib/hooks/use-user-role";
import { useRouter } from "next/navigation";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

interface InventoryProduct {
	id: string;
	name: string;
	sku?: string | null;
	category?: string | null;
	stock_quantity?: number | null;
	price?: number | null;
	cost_price?: number | null;
	unit?: string | null;
	gst_rate?: number | null;
	updated_at?: string | null;
}

export default function InventoryPage() {
	const [products, setProducts] = useState<InventoryProduct[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [searchTerm, setSearchTerm] = useState("");
	const [categoryFilter, setCategoryFilter] = useState<string>("all");
	const [stockFilter, setStockFilter] = useState<string>("all");
	const { isEmployee, isLoading: roleLoading } = useUserRole();
	const router = useRouter();

	// Redirect employees away from inventory page
	useEffect(() => {
		if (!roleLoading && isEmployee) {
			router.push("/dashboard");
		}
	}, [isEmployee, roleLoading, router]);

	useEffect(() => {
		let isActive = true;
		const loadProducts = async () => {
			try {
				setLoading(true);
				setError(null);
				
				// Check database mode first
				const dbMode = await getActiveDbModeAsync();
				const isIndexedDb = dbMode === 'indexeddb';
				
				if (isIndexedDb) {
					const list = await db.products.toArray();
					console.log(
						"[InventoryPage] Loaded products from IndexedDB:",
						list.length
					);
					if (!isActive) return;
					setProducts(list as InventoryProduct[]);
				} else {
					const supabase = createClient();
					const {
						data: { user },
					} = await supabase.auth.getUser();
					if (!user) {
						if (isActive) setProducts([]);
						return;
					}
					const { data, error: fetchError } = await supabase
						.from("products")
						.select("*")
						.eq("user_id", user.id)
						.order("updated_at", { ascending: false });
					if (fetchError) throw fetchError;
					console.log(
						"[InventoryPage] Loaded products from Supabase:",
						data?.length || 0
					);
					if (isActive) setProducts((data || []) as InventoryProduct[]);
				}
			} catch (err: any) {
				console.error("[InventoryPage] Failed to load products", err);
				if (isActive) setError(err.message || "Failed to load inventory data");
			} finally {
				if (isActive) setLoading(false);
			}
		};

		loadProducts();
		return () => {
			isActive = false;
		};
	}, []);

	const {
		totalProducts,
		totalUnits,
		totalValue,
		estimatedProfit,
		lowStockProducts,
		outOfStockProducts,
		topValuedProducts,
		categoryBreakdown,
	} = useMemo(() => {
		const safeProducts = products || [];
		const totals = safeProducts.reduce(
			(acc, product) => {
				const qty = Number(product.stock_quantity || 0);
				const price = Number(product.price || 0);
				const cost = Number(product.cost_price || 0);
				acc.totalUnits += qty;
				acc.totalValue += qty * price;
				acc.estimatedProfit += qty * Math.max(price - cost, 0);
				return acc;
			},
			{ totalUnits: 0, totalValue: 0, estimatedProfit: 0 }
		);

		const lowStock = safeProducts.filter((product) => {
			const qty = Number(product.stock_quantity ?? 0);
			return qty > 0 && qty <= 10;
		});
		const outOfStock = safeProducts.filter(
			(product) => Number(product.stock_quantity ?? 0) === 0
		);

		const topValued = [...safeProducts]
			.sort((a, b) => {
				const valueA = Number(a.stock_quantity || 0) * Number(a.price || 0);
				const valueB = Number(b.stock_quantity || 0) * Number(b.price || 0);
				return valueB - valueA;
			})
			.slice(0, 6);

		const categoriesMap = new Map<
			string,
			{ units: number; products: number; value: number; lowStock: number }
		>();

		safeProducts.forEach((product) => {
			const key = product.category?.trim() || "Uncategorized";
			const entry = categoriesMap.get(key) || {
				units: 0,
				products: 0,
				value: 0,
				lowStock: 0,
			};
			entry.products += 1;
			const qty = Number(product.stock_quantity || 0);
			entry.units += qty;
			entry.value += qty * Number(product.price || 0);
			if (qty <= 10) entry.lowStock += 1;
			categoriesMap.set(key, entry);
		});

		const categoryList = Array.from(categoriesMap.entries()).map(
			([category, stats]) => ({
				category,
				...stats,
			})
		);

		return {
			totalProducts: safeProducts.length,
			totalUnits: totals.totalUnits,
			totalValue: totals.totalValue,
			estimatedProfit: totals.estimatedProfit,
			lowStockProducts: lowStock,
			outOfStockProducts: outOfStock,
			topValuedProducts: topValued,
			categoryBreakdown: categoryList,
		};
	}, [products]);

	const formatCurrency = (value: number) =>
		`₹${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

	// Filter products based on search term, category, and stock status
	const filteredProducts = useMemo(() => {
		let filtered = products;

		// Apply search term filter
		if (searchTerm) {
			const lowerCaseSearchTerm = searchTerm.toLowerCase();
			filtered = filtered.filter(
				(product) =>
					product.name.toLowerCase().includes(lowerCaseSearchTerm) ||
					product.sku?.toLowerCase().includes(lowerCaseSearchTerm) ||
					product.category?.toLowerCase().includes(lowerCaseSearchTerm)
			);
		}

		// Apply category filter
		if (categoryFilter !== "all") {
			filtered = filtered.filter(
				(product) => product.category === categoryFilter
			);
		}

		// Apply stock status filter
		if (stockFilter !== "all") {
			filtered = filtered.filter((product) => {
				const qty = Number(product.stock_quantity || 0);
				if (stockFilter === "in_stock") return qty > 0;
				if (stockFilter === "low_stock") return qty > 0 && qty <= 10;
				if (stockFilter === "out_of_stock") return qty === 0;
				return true;
			});
		}

		return filtered;
	}, [products, searchTerm, categoryFilter, stockFilter]);

	// Get available categories for filter dropdown
	const availableCategories = useMemo(() => {
		const categories = new Set<string>();
		products.forEach((p) => {
			if (p.category) categories.add(p.category);
		});
		return Array.from(categories).sort();
	}, [products]);

	if (loading) {
		return (
			<div className="flex min-h-[400px] items-center justify-center">
				<div className="text-center space-y-2">
					<div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
					<p className="text-sm text-muted-foreground">
						Loading inventory insights...
					</p>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="flex min-h-[300px] items-center justify-center">
				<div className="rounded-lg border border-destructive/40 bg-destructive/10 px-6 py-4 text-center">
					<p className="text-sm font-medium text-destructive">
						Unable to load inventory
					</p>
					<p className="text-xs text-muted-foreground mt-1">{error}</p>
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-6 px-4 md:px-6 py-4 md:py-6">
			<div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
				<div>
					<h1 className="text-2xl md:text-3xl font-bold">Inventory Overview</h1>
					<p className="text-sm md:text-base text-muted-foreground">
						Monitor stock levels, inventory value, and category health at a
						glance.
					</p>
				</div>
				<Badge variant="secondary" className="w-fit">
					{loading ? "Loading..." : "Inventory"}
				</Badge>
			</div>

			{/* Summary cards */}
			<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
				<Card>
					<CardHeader className="pb-2 flex flex-row items-center justify-between">
						<CardTitle className="text-sm font-medium">
							Total Products
						</CardTitle>
						<Boxes className="h-5 w-5 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<Tooltip>
							<TooltipTrigger asChild>
								<div className="text-3xl font-bold cursor-help">
									{totalProducts}
								</div>
							</TooltipTrigger>
							<TooltipContent>
								Total Products: {totalProducts} unique listing
								{totalProducts !== 1 ? "s" : ""}
							</TooltipContent>
						</Tooltip>
						<p className="text-xs text-muted-foreground mt-1">
							Unique listings being tracked
						</p>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="pb-2 flex flex-row items-center justify-between">
						<CardTitle className="text-sm font-medium">
							Units In Stock
						</CardTitle>
						<Layers className="h-5 w-5 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<Tooltip>
							<TooltipTrigger asChild>
								<div className="text-3xl font-bold cursor-help">
									{totalUnits.toLocaleString("en-IN")}
								</div>
							</TooltipTrigger>
							<TooltipContent>
								Total Units: {totalUnits.toLocaleString("en-IN")} across all
								warehouses
							</TooltipContent>
						</Tooltip>
						<p className="text-xs text-muted-foreground mt-1">
							Across all warehouses
						</p>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="pb-2 flex flex-row items-center justify-between">
						<CardTitle className="text-sm font-medium">
							Inventory Value
						</CardTitle>
						<TrendingUp className="h-5 w-5 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<Tooltip>
							<TooltipTrigger asChild>
								<div className="text-xl md:text-2xl font-bold truncate cursor-help">
									{formatCurrency(totalValue)}
								</div>
							</TooltipTrigger>
							<TooltipContent>
								Total Value: {formatCurrency(totalValue)}
							</TooltipContent>
						</Tooltip>
						<p className="text-xs text-muted-foreground mt-1">
							Potential sales value
						</p>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="pb-2 flex flex-row items-center justify-between">
						<CardTitle className="text-sm font-medium">
							Projected Profit
						</CardTitle>
						<PiggyBank className="h-5 w-5 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<Tooltip>
							<TooltipTrigger asChild>
								<div className="text-xl md:text-2xl font-bold truncate cursor-help">
									{formatCurrency(estimatedProfit)}
								</div>
							</TooltipTrigger>
							<TooltipContent>
								Projected Profit: {formatCurrency(estimatedProfit)}
							</TooltipContent>
						</Tooltip>
						<p className="text-xs text-muted-foreground mt-1">
							Based on cost vs. sale price
						</p>
					</CardContent>
				</Card>
			</div>

			{/* Alerts */}
			<div className="grid gap-4 lg:grid-cols-2">
				<Card
					className={
						lowStockProducts.length ? "border-yellow-200 bg-yellow-50/50" : ""
					}
				>
					<CardHeader className="flex flex-row items-center justify-between">
						<CardTitle className="flex items-center gap-2">
							<AlertCircle className="h-5 w-5 text-yellow-600" />
							Low Stock ({lowStockProducts.length})
						</CardTitle>
						{lowStockProducts.length > 0 && (
							<Badge variant="outline" className="bg-white text-yellow-700">
								Reorder soon
							</Badge>
						)}
					</CardHeader>
					<CardContent>
						{lowStockProducts.length === 0 ? (
							<p className="text-sm text-muted-foreground">
								All products have healthy inventory levels.
							</p>
						) : (
							<div className="space-y-3">
								{lowStockProducts.map((product) => (
									<div
										key={product.id}
										className="flex items-center justify-between rounded-lg border border-yellow-100 bg-white px-3 py-2"
									>
										<div>
											<p className="text-sm font-medium">{product.name}</p>
											<p className="text-xs text-muted-foreground">
												SKU: {product.sku || "N/A"} •{" "}
												{product.category || "Uncategorized"}
											</p>
										</div>
										<Tooltip>
											<TooltipTrigger asChild>
												<Badge
													variant="secondary"
													className="border-yellow-200 text-yellow-700 cursor-help"
												>
													{product.unit === "piece"
														? `${Math.round(
															Number(product.stock_quantity || 0)
														)} ${product.unit || "units"}`
														: `${Number(
															product.stock_quantity || 0
														).toLocaleString("en-IN")} ${product.unit || "units"
														}`}
												</Badge>
											</TooltipTrigger>
											<TooltipContent>
												{product.unit === "piece"
													? `Stock: ${Math.round(
														Number(product.stock_quantity || 0)
													)} ${product.unit || "units"}`
													: `Stock: ${Number(
														product.stock_quantity || 0
													).toLocaleString("en-IN")} ${product.unit || "units"
													}`}
											</TooltipContent>
										</Tooltip>
									</div>
								))}
							</div>
						)}
					</CardContent>
				</Card>

				<Card
					className={
						outOfStockProducts.length
							? "border-destructive/40 bg-destructive/5"
							: ""
					}
				>
					<CardHeader className="flex flex-row items-center justify-between">
						<CardTitle className="flex items-center gap-2">
							<AlertCircle className="h-5 w-5 text-red-600" />
							Out of Stock (
							<Tooltip>
								<TooltipTrigger asChild>
									<span className="cursor-help">
										{outOfStockProducts.length}
									</span>
								</TooltipTrigger>
								<TooltipContent>
									{outOfStockProducts.length} product
									{outOfStockProducts.length !== 1 ? "s" : ""} out of stock
								</TooltipContent>
							</Tooltip>
							)
						</CardTitle>
						{outOfStockProducts.length > 0 && (
							<Badge
								variant="destructive"
								className="border border-destructive/20"
							>
								Needs replenishment
							</Badge>
						)}
					</CardHeader>
					<CardContent>
						{outOfStockProducts.length === 0 ? (
							<p className="text-sm text-muted-foreground">
								No items are completely out of stock.
							</p>
						) : (
							<div className="space-y-3">
								{outOfStockProducts.map((product) => (
									<div
										key={product.id}
										className="flex items-center justify-between rounded-lg border border-destructive/30 bg-background px-3 py-2"
									>
										<div>
											<p className="text-sm font-medium">{product.name}</p>
											<p className="text-xs text-muted-foreground">
												SKU: {product.sku || "N/A"} •{" "}
												{product.category || "Uncategorized"}
											</p>
										</div>
										<Badge
											variant="outline"
											className="border-destructive/40 text-destructive"
										>
											Out of stock
										</Badge>
									</div>
								))}
							</div>
						)}
					</CardContent>
				</Card>
			</div>

			{/* Category breakdown */}
			<Card>
				<CardHeader>
					<CardTitle>Category Performance</CardTitle>
				</CardHeader>
				<CardContent>
					{categoryBreakdown.length === 0 ? (
						<p className="text-sm text-muted-foreground">
							No products have been added yet.
						</p>
					) : (
						<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
							{categoryBreakdown.map((category) => (
								<div
									key={category.category}
									className="rounded-lg border bg-card p-4 shadow-sm"
								>
									<div className="flex items-center justify-between">
										<p className="text-sm font-semibold">{category.category}</p>
										<Tooltip>
											<TooltipTrigger asChild>
												<Badge variant="outline" className="cursor-help">
													{category.products} items
												</Badge>
											</TooltipTrigger>
											<TooltipContent>
												{category.products} product
												{category.products !== 1 ? "s" : ""} in{" "}
												{category.category}
											</TooltipContent>
										</Tooltip>
									</div>
									<div className="mt-3 space-y-2 text-xs text-muted-foreground">
										<div className="flex justify-between">
											<span>Units in stock</span>
											<Tooltip>
												<TooltipTrigger asChild>
													<span className="font-medium text-foreground cursor-help">
														{formatLargeNumber(category.units)}
													</span>
												</TooltipTrigger>
												<TooltipContent>
													Units in stock: {formatFullNumber(category.units)}
												</TooltipContent>
											</Tooltip>
										</div>
										<div className="flex justify-between">
											<span>Inventory value</span>
											<Tooltip>
												<TooltipTrigger asChild>
													<span className="font-medium text-foreground truncate text-sm max-w-[120px] text-right cursor-help">
														{formatCurrency(category.value)}
													</span>
												</TooltipTrigger>
												<TooltipContent>
													Value: {formatCurrency(category.value)}
												</TooltipContent>
											</Tooltip>
										</div>
										<div className="flex justify-between">
											<span>Low stock</span>
											<Tooltip>
												<TooltipTrigger asChild>
													<span className="font-medium text-foreground cursor-help">
														{category.lowStock}
													</span>
												</TooltipTrigger>
												<TooltipContent>
													Low stock items: {category.lowStock}
												</TooltipContent>
											</Tooltip>
										</div>
									</div>
								</div>
							))}
						</div>
					)}
				</CardContent>
			</Card>

			{/* Top products */}
			<Card>
				<CardHeader>
					<CardTitle>High Value Inventory</CardTitle>
				</CardHeader>
				<CardContent>
					{topValuedProducts.length === 0 ? (
						<p className="text-sm text-muted-foreground">
							Add products to see insights.
						</p>
					) : (
						<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
							{topValuedProducts.map((product) => {
								const qty = Number(product.stock_quantity || 0);
								const value = qty * Number(product.price || 0);
								return (
									<div
										key={product.id}
										className="rounded-lg border bg-card p-4"
									>
										<div className="flex items-start justify-between gap-2">
											<div>
												<p className="text-sm font-semibold leading-tight">
													{product.name}
												</p>
												<p className="text-xs text-muted-foreground">
													SKU: {product.sku || "N/A"}
												</p>
											</div>
											<Badge variant="secondary">
												{product.category || "Uncategorized"}
											</Badge>
										</div>
										<div className="mt-3 space-y-2 text-xs text-muted-foreground">
											<div className="flex justify-between">
												<span>Stock</span>
												<Tooltip>
													<TooltipTrigger asChild>
														<span className="font-medium text-foreground cursor-help">
															{qty} {product.unit || "units"}
														</span>
													</TooltipTrigger>
													<TooltipContent>
														Stock: {qty} {product.unit || "units"}
													</TooltipContent>
												</Tooltip>
											</div>
											<div className="flex justify-between">
												<span>Value</span>
												<Tooltip>
													<TooltipTrigger asChild>
														<span className="font-medium text-foreground truncate text-sm max-w-[120px] text-right cursor-help">
															{formatCurrency(value)}
														</span>
													</TooltipTrigger>
													<TooltipContent>
														Value: {formatCurrency(value)}
													</TooltipContent>
												</Tooltip>
											</div>
											{product.gst_rate != null && (
												<div className="flex justify-between">
													<span>GST Rate</span>
													<span className="font-medium text-foreground">
														{product.gst_rate}%
													</span>
												</div>
											)}
										</div>
									</div>
								);
							})}
						</div>
					)}
				</CardContent>
			</Card>

			{/* Tabular view */}
			<Card>
				<CardHeader>
					<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
						<CardTitle>Complete Inventory Listing</CardTitle>
						<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
							<div className="relative flex-1 sm:max-w-xs">
								<Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
								<Input
									placeholder="Search products..."
									value={searchTerm}
									onChange={(e) => setSearchTerm(e.target.value)}
									className="pl-8"
								/>
							</div>
							<Select value={categoryFilter} onValueChange={setCategoryFilter}>
								<SelectTrigger className="w-full sm:w-[180px]">
									<Filter className="mr-2 h-4 w-4" />
									<SelectValue placeholder="All Categories" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All Categories</SelectItem>
									{availableCategories.map((cat) => (
										<SelectItem key={cat} value={cat}>
											{cat}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<Select value={stockFilter} onValueChange={setStockFilter}>
								<SelectTrigger className="w-full sm:w-[180px]">
									<SelectValue placeholder="All Stock" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All Stock</SelectItem>
									<SelectItem value="in_stock">In Stock</SelectItem>
									<SelectItem value="low_stock">Low Stock</SelectItem>
									<SelectItem value="out_of_stock">Out of Stock</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>
					{products.length > 0 && (
						<p className="text-sm text-muted-foreground mt-2">
							Showing {filteredProducts.length} of {products.length} products
						</p>
					)}
				</CardHeader>
				<CardContent>
					{products.length === 0 ? (
						<p className="text-sm text-muted-foreground">
							No products available yet.
						</p>
					) : (
						<div className="overflow-x-auto -mx-6 px-6">
							<div className="min-w-[1000px]">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead className="min-w-[180px]">Name</TableHead>
											<TableHead className="min-w-[100px]">SKU</TableHead>
											<TableHead className="min-w-[120px]">Category</TableHead>
											<TableHead className="text-right min-w-[100px]">
												Stock
											</TableHead>
											<TableHead className="text-right min-w-[80px]">
												Unit
											</TableHead>
											<TableHead className="text-right min-w-[100px]">
												Price
											</TableHead>
											<TableHead className="text-right min-w-[100px]">
												Cost
											</TableHead>
											<TableHead className="text-right min-w-[130px]">
												Inventory Value
											</TableHead>
											<TableHead className="text-center min-w-[120px]">
												Status
											</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{loading ? (
											Array.from({ length: 5 }).map((_, i) => (
												<TableRow key={i}>
													<TableCell><Skeleton className="h-4 w-full" /></TableCell>
													<TableCell><Skeleton className="h-4 w-full" /></TableCell>
													<TableCell><Skeleton className="h-4 w-full" /></TableCell>
													<TableCell><Skeleton className="h-4 w-full" /></TableCell>
													<TableCell><Skeleton className="h-4 w-full" /></TableCell>
													<TableCell><Skeleton className="h-4 w-full" /></TableCell>
													<TableCell><Skeleton className="h-4 w-full" /></TableCell>
													<TableCell><Skeleton className="h-4 w-full" /></TableCell>
													<TableCell><Skeleton className="h-4 w-full" /></TableCell>
												</TableRow>
											))
										) : filteredProducts.length === 0 ? (
											<TableRow>
												<TableCell
													colSpan={9}
													className="text-center py-8 text-muted-foreground"
												>
													No products found matching your filters.
												</TableCell>
											</TableRow>
										) : (
											filteredProducts.map((product) => {
												const qty = Number(product.stock_quantity || 0);
												const status =
													qty === 0 ? "out" : qty <= 10 ? "low" : "healthy";
												return (
													<TableRow key={product.id}>
														<TableCell className="font-medium">
															{product.name}
														</TableCell>
														<TableCell className="text-xs text-muted-foreground">
															{product.sku || "—"}
														</TableCell>
														<TableCell className="text-xs text-muted-foreground">
															{product.category || "Uncategorized"}
														</TableCell>
														<TableCell className="text-right">
															<Tooltip>
																<TooltipTrigger asChild>
																	<span className="truncate block max-w-[100px] cursor-help ml-auto">
																		{qty.toLocaleString("en-IN")}
																	</span>
																</TooltipTrigger>
																<TooltipContent>
																	Stock: {qty.toLocaleString("en-IN")}{" "}
																	{product.unit || "units"}
																</TooltipContent>
															</Tooltip>
														</TableCell>
														<TableCell className="text-right">
															{product.unit || "units"}
														</TableCell>
														<TableCell className="text-right">
															<Tooltip>
																<TooltipTrigger asChild>
																	<span className="text-sm md:text-base truncate max-w-[100px] inline-block cursor-help">
																		{formatCurrency(Number(product.price || 0))}
																	</span>
																</TooltipTrigger>
																<TooltipContent>
																	Price:{" "}
																	{formatCurrency(Number(product.price || 0))}
																</TooltipContent>
															</Tooltip>
														</TableCell>
														<TableCell className="text-right">
															<Tooltip>
																<TooltipTrigger asChild>
																	<span className="text-sm md:text-base truncate max-w-[100px] inline-block cursor-help">
																		{product.cost_price != null
																			? formatCurrency(
																				Number(product.cost_price)
																			)
																			: "—"}
																	</span>
																</TooltipTrigger>
																<TooltipContent>
																	Cost:{" "}
																	{product.cost_price != null
																		? formatCurrency(Number(product.cost_price))
																		: "N/A"}
																</TooltipContent>
															</Tooltip>
														</TableCell>
														<TableCell className="text-right">
															<Tooltip>
																<TooltipTrigger asChild>
																	<span className="text-sm md:text-base truncate max-w-[120px] inline-block cursor-help">
																		{formatCurrency(
																			qty * Number(product.price || 0)
																		)}
																	</span>
																</TooltipTrigger>
																<TooltipContent>
																	Stock Value:{" "}
																	{formatCurrency(
																		qty * Number(product.price || 0)
																	)}
																</TooltipContent>
															</Tooltip>
														</TableCell>
														<TableCell className="text-center">
															<Tooltip>
																<TooltipTrigger asChild>
																	<Badge
																		variant={
																			status === "out"
																				? "destructive"
																				: status === "low"
																					? "secondary"
																					: "default"
																		}
																		className="cursor-help"
																	>
																		{status === "out"
																			? "Out of stock"
																			: status === "low"
																				? "Low stock"
																				: "In stock"}
																	</Badge>
																</TooltipTrigger>
																<TooltipContent>
																	Status:{" "}
																	{status === "out"
																		? "Out of stock - needs immediate replenishment"
																		: status === "low"
																			? "Low stock - consider reordering soon"
																			: "Adequate stock levels"}
																</TooltipContent>
															</Tooltip>
														</TableCell>
													</TableRow>
												);
											})
										)}
									</TableBody>
								</Table>
							</div>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
