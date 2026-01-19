"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	DollarSign,
	Receipt,
	Users,
	Package,
	TrendingUp,
	AlertCircle,
	UserCog,
	Boxes,
	Shield,
	LogOut,
	Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import Link from "next/link";
import { useEffect, useState } from "react";
import { db } from "@/lib/dexie-client";
import { createClient } from "@/lib/supabase/client";
import { getActiveDbModeAsync } from "@/lib/utils/db-mode";
import { useUserRole } from "@/lib/hooks/use-user-role";
import { clearLicense, getStoredLicense } from "@/lib/utils/license-manager";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";

export default function DashboardPage() {
	const [localStats, setLocalStats] = useState<any>(null);
	const [sbStats, setSbStats] = useState<any>(null);
	const [loading, setLoading] = useState(true);
	const [licenseInfo, setLicenseInfo] = useState<any>(null);
	const [clearingLicense, setClearingLicense] = useState(false);
	const { isAdmin, isEmployee, isLoading: roleLoading } = useUserRole();
	const router = useRouter();
	const { toast } = useToast();

	// Don't redirect employees anymore - show invoice form on dashboard instead

	useEffect(() => {
		(async () => {
			// Check database mode first
			const dbType = await getActiveDbModeAsync();
			
			// Local (IndexedDB) mode
			if (dbType !== "supabase") {
				try {
					setLoading(true);
					const [products, customers, invoices] = await Promise.all([
						db.products.toArray(),
						db.customers.toArray(),
						db.invoices.toArray(),
					]);
					setLocalStats({
						totalRevenue: (invoices || []).reduce(
							(s: number, i: any) => s + Number(i.total_amount || i.total || 0),
							0
						),
						productsCount: products?.length || 0,
						customersCount: customers?.length || 0,
						invoicesCount: invoices?.length || 0,
						recentInvoices: (invoices || []).slice(-5).reverse(),
						lowStockProducts: (products || []).filter(
							(p: any) =>
								p.stock_quantity !== undefined && Number(p.stock_quantity) <= 10
						),
					});
				} finally {
					setLoading(false);
				}
			} else {
				// Supabase mode
				setLoading(true);
				const supabase = createClient();
				const authType = localStorage.getItem("authType");
				let userId: string | null = null;
				let storeId: string | null = null;

				// Get the correct user_id (admin_user_id for employees, user.id for admins)
				if (authType === "employee") {
					const empSession = localStorage.getItem("employeeSession");
					if (empSession) {
						try {
							const session = JSON.parse(empSession);
							storeId = session.storeId || localStorage.getItem("currentStoreId");
							if (storeId) {
								const { data: store } = await supabase
									.from("stores")
									.select("admin_user_id")
									.eq("id", storeId)
									.single();
								if (store?.admin_user_id) {
									userId = store.admin_user_id;
								}
							}
						} catch (e) {
							console.warn("[Dashboard] Error parsing employee session:", e);
						}
					}
				} else {
					const {
						data: { user },
					} = await supabase.auth.getUser();
					if (user) {
						userId = user.id;
					}
				}

				if (!userId) {
					console.warn("[Dashboard] Could not determine user ID");
					setSbStats({
						totalRevenue: 0,
						productsCount: 0,
						customersCount: 0,
						invoicesCount: 0,
						recentInvoices: [],
						lowStockProducts: [],
					});
					setLoading(false);
					return;
				}

				// Build queries with proper filters for employees (store-scoped)
				// Products: user_id = admin_user_id AND (store_id = employee.store_id OR store_id IS NULL)
				let productsQuery = supabase
					.from("products")
					.select("*", { count: "exact", head: true })
					.eq("user_id", userId);
				if (storeId) {
					productsQuery = productsQuery.or(`store_id.is.null,store_id.eq.${storeId}`);
				}

				// Customers: user_id = admin_user_id AND (store_id = employee.store_id OR store_id IS NULL)
				let customersQuery = supabase
					.from("customers")
					.select("*", { count: "exact", head: true })
					.eq("user_id", userId);
				if (storeId) {
					customersQuery = customersQuery.or(`store_id.is.null,store_id.eq.${storeId}`);
				}

				// Invoices: user_id = admin_user_id AND (store_id = employee.store_id OR store_id IS NULL)
				let invoicesQuery = supabase
					.from("invoices")
					.select("*", { count: "exact", head: true })
					.eq("user_id", userId);
				if (storeId) {
					invoicesQuery = invoicesQuery.or(`store_id.is.null,store_id.eq.${storeId}`);
				}

				// Execute count queries
				const [
					{ count: productsCount },
					{ count: customersCount },
					{ count: invoicesCount },
				] = await Promise.all([
					productsQuery,
					customersQuery,
					invoicesQuery,
				]);

				// Fetch invoices for revenue calculation (all invoices, not just paid)
				let invoicesForRevenueQuery = supabase
					.from("invoices")
					.select("total_amount")
					.eq("user_id", userId);
				if (storeId) {
					invoicesForRevenueQuery = invoicesForRevenueQuery.or(`store_id.is.null,store_id.eq.${storeId}`);
				}
				const { data: invoices } = await invoicesForRevenueQuery;

				const totalRevenue =
					invoices?.reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0) || 0;

				// Fetch recent invoices
				let recentInvoicesQuery = supabase
					.from("invoices")
					.select("id, invoice_number, total_amount, status, created_at, customers(name)")
					.eq("user_id", userId)
					.order("created_at", { ascending: false })
					.limit(5);
				if (storeId) {
					recentInvoicesQuery = recentInvoicesQuery.or(`store_id.is.null,store_id.eq.${storeId}`);
				}
				const { data: recentInvoices } = await recentInvoicesQuery;

				// Fetch low stock products
				let lowStockQuery = supabase
					.from("products")
					.select("id, name, stock_quantity")
					.eq("user_id", userId)
					.lte("stock_quantity", 10)
					.limit(5);
				if (storeId) {
					lowStockQuery = lowStockQuery.or(`store_id.is.null,store_id.eq.${storeId}`);
				}
				const { data: lowStockProducts } = await lowStockQuery;

				setSbStats({
					totalRevenue,
					productsCount: productsCount || 0,
					customersCount: customersCount || 0,
					invoicesCount: invoicesCount || 0,
					recentInvoices: recentInvoices || [],
					lowStockProducts: lowStockProducts || [],
				});
				setLoading(false);
			}
		})();
	}, []);

	// Fetch license info for admins
	useEffect(() => {
		if (isAdmin) {
			const fetchLicenseInfo = async () => {
				try {
					const license = await getStoredLicense();
					setLicenseInfo(license);
				} catch (error) {
					console.error("Error fetching license info:", error);
				}
			};
			fetchLicenseInfo();
		}
	}, [isAdmin]);

	const handleClearLicense = async () => {
		if (
			!confirm(
				"Are you sure you want to reset the license?\n\nThis will:\n- Remove all license data from this computer\n- Reset this PC to a completely new installation state\n- Require you to activate with a license key again\n\nThis action cannot be undone."
			)
		) {
			return;
		}

		setClearingLicense(true);
		try {
			console.log("[Dashboard] Clearing license...");

			const result = await clearLicense();

			if (result.success) {
				console.log("[Dashboard] License cleared successfully");

				// Also clear any cached license data in localStorage (if any)
				try {
					if (typeof window !== "undefined" && window.localStorage) {
						const keysToRemove: string[] = [];
						for (let i = 0; i < window.localStorage.length; i++) {
							const key = window.localStorage.key(i);
							if (
								key &&
								(key.toLowerCase().includes("license") ||
									key.toLowerCase().includes("activation"))
							) {
								keysToRemove.push(key);
							}
						}
						keysToRemove.forEach((key) => {
							window.localStorage.removeItem(key);
							console.log("[Dashboard] Removed localStorage key:", key);
						});
					}
				} catch (localStorageError) {
					console.warn(
						"[Dashboard] Error clearing localStorage:",
						localStorageError
					);
				}

				toast({
					title: "License Reset",
					description:
						"License has been removed. Redirecting to license page...",
				});
				setLicenseInfo(null);

				// Redirect to license page
				setTimeout(() => {
					router.push("/license");
				}, 1500);
			} else {
				console.error("[Dashboard] Failed to clear license:", result.error);
				toast({
					title: "Failed to reset license",
					description: result.error || "An error occurred",
					variant: "destructive",
				});
			}
		} catch (error: any) {
			console.error("[Dashboard] Error clearing license:", error);
			toast({
				title: "Error",
				description: error.message || "An unexpected error occurred",
				variant: "destructive",
			});
		} finally {
			setClearingLicense(false);
		}
	};

	const stats = dbType === "supabase" ? sbStats : localStats;

	if (loading || !stats) {
		return (
			<div className="flex items-center justify-center min-h-[400px] px-4">
				<div className="text-center space-y-2">
					<div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
					<p className="text-sm text-muted-foreground">Loading dashboard...</p>
				</div>
			</div>
		);
	}

	const {
		totalRevenue = 0,
		invoicesCount = 0,
		productsCount = 0,
		customersCount = 0,
		recentInvoices = [],
		lowStockProducts = [],
	} = stats;

	return (
		<div className="space-y-4 md:space-y-6">
			<div>
				<h1 className="text-2xl md:text-3xl font-bold">Dashboard</h1>
				<p className="text-sm md:text-base text-muted-foreground mt-1">
					Welcome back! Here's an overview of your business.
				</p>
			</div>

			{/* Quick Actions - Moved to top for better visibility */}
			<Card>
				<CardHeader>
					<CardTitle>Quick Actions</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
						{(isEmployee || isAdmin) && (
							<Button asChild className="h-auto flex-col gap-2 py-4">
								<Link href="/invoices/new">
									<Receipt className="h-6 w-6" />
									<span>Create Invoice</span>
								</Link>
							</Button>
						)}
						{isAdmin && (
							<Button
								asChild
								variant="outline"
								className="h-auto flex-col gap-2 py-4 bg-transparent"
							>
								<Link href="/employees">
									<UserCog className="h-6 w-6" />
									<span>Manage Employees</span>
								</Link>
							</Button>
						)}
						{isAdmin && (
							<Button
								asChild
								variant="outline"
								className="h-auto flex-col gap-2 py-4 bg-transparent"
							>
								<Link href="/inventory">
									<Boxes className="h-6 w-6" />
									<span>Inventory Overview</span>
								</Link>
							</Button>
						)}
						<Button
							asChild
							variant="outline"
							className="h-auto flex-col gap-2 py-4 bg-transparent"
						>
							<Link href="/products/new">
								<Package className="h-6 w-6" />
								<span>Add Product</span>
							</Link>
						</Button>
						<Button
							asChild
							variant="outline"
							className="h-auto flex-col gap-2 py-4 bg-transparent"
						>
							<Link href="/customers/new">
								<Users className="h-6 w-6" />
								<span>Add Customer</span>
							</Link>
						</Button>
						<Button
							asChild
							variant="outline"
							className="h-auto flex-col gap-2 py-4 bg-transparent"
						>
							<Link href="/reports">
								<TrendingUp className="h-6 w-6" />
								<span>View Reports</span>
							</Link>
						</Button>
					</div>
				</CardContent>
			</Card>

			{/* Stats and Quick Actions */}
			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
				<Card>
					<CardHeader className="flex flex-row items-center justify-between pb-2">
						<CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
						<DollarSign className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<Tooltip>
							<TooltipTrigger asChild>
								<div className="text-xl md:text-2xl font-bold truncate cursor-help">
									₹{totalRevenue.toLocaleString("en-IN")}
								</div>
							</TooltipTrigger>
							<TooltipContent>
								Total Revenue: ₹{totalRevenue.toLocaleString("en-IN")}
							</TooltipContent>
						</Tooltip>
						<p className="text-xs text-muted-foreground">Total from all invoices</p>
					</CardContent>
				</Card>
				<Card
					className="cursor-pointer hover:bg-muted/50 transition-colors"
					onClick={() => router.push("/invoices")}
				>
					<CardHeader className="flex flex-row items-center justify-between pb-2">
						<CardTitle className="text-sm font-medium">
							Total Invoices
						</CardTitle>
						<Receipt className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<Tooltip>
							<TooltipTrigger asChild>
								<div className="text-2xl font-bold cursor-help">
									{invoicesCount || 0}
								</div>
							</TooltipTrigger>
							<TooltipContent>
								Total Invoices: {invoicesCount || 0}
							</TooltipContent>
						</Tooltip>
						<p className="text-xs text-muted-foreground">All time</p>
					</CardContent>
				</Card>
				<Card
					className="cursor-pointer hover:bg-muted/50 transition-colors"
					onClick={() => router.push("/customers")}
				>
					<CardHeader className="flex flex-row items-center justify-between pb-2">
						<CardTitle className="text-sm font-medium">Customers</CardTitle>
						<Users className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<Tooltip>
							<TooltipTrigger asChild>
								<div className="text-2xl font-bold cursor-help">
									{customersCount || 0}
								</div>
							</TooltipTrigger>
							<TooltipContent>
								Active Customers: {customersCount || 0}
							</TooltipContent>
						</Tooltip>
						<p className="text-xs text-muted-foreground">Active customers</p>
					</CardContent>
				</Card>
				<Card
					className={isAdmin ? "cursor-pointer hover:bg-muted/50 transition-colors" : ""}
					onClick={isAdmin ? () => router.push("/inventory") : undefined}
				>
					<CardHeader className="flex flex-row items-center justify-between pb-2">
						<CardTitle className="text-sm font-medium">Products</CardTitle>
						<Package className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<Tooltip>
							<TooltipTrigger asChild>
								<div className="text-2xl font-bold cursor-help">
									{productsCount || 0}
								</div>
							</TooltipTrigger>
							<TooltipContent>
								Products in Inventory: {productsCount || 0}
							</TooltipContent>
						</Tooltip>
						<p className="text-xs text-muted-foreground">In inventory</p>
					</CardContent>
				</Card>
			</div>
			<div className="grid gap-6 lg:grid-cols-2">
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<TrendingUp className="h-5 w-5" />
							Recent Invoices
						</CardTitle>
					</CardHeader>
					<CardContent>
						{recentInvoices && recentInvoices.length > 0 ? (
							<div className="space-y-4">
								{recentInvoices.map((invoice: any) => (
									<div
										key={invoice.id || invoice.invoice_number}
										className="flex items-center justify-between cursor-pointer hover:bg-muted/50 p-2 rounded transition-colors"
										onClick={() => router.push(`/invoices/${invoice.id}`)}
									>
										<div>
											<p className="font-medium">
												{invoice.invoice_number || invoice.id}
											</p>
											<p className="text-sm text-muted-foreground">
												{invoice.customer_name || "Customer"}
											</p>
										</div>
										<div className="text-right">
											<Tooltip>
												<TooltipTrigger asChild>
													<p className="font-medium text-sm md:text-base truncate max-w-[120px] cursor-help">
														₹
														{Number(
															invoice.total_amount || invoice.total
														).toLocaleString("en-IN")}
													</p>
												</TooltipTrigger>
												<TooltipContent>
													Amount: ₹
													{Number(
														invoice.total_amount || invoice.total
													).toLocaleString("en-IN")}
												</TooltipContent>
											</Tooltip>
											<p className="text-sm text-muted-foreground capitalize">
												{invoice.status || "n/a"}
											</p>
										</div>
									</div>
								))}
								<Button
									asChild
									variant="outline"
									className="w-full bg-transparent"
								>
									<Link href="/invoices">View All Invoices</Link>
								</Button>
							</div>
						) : (
							<div className="py-8 text-center text-muted-foreground">
								<p>No invoices yet</p>
								{(isEmployee || isAdmin) && (
									<Button asChild className="mt-4">
										<Link href="/invoices/new">Create Your First Invoice</Link>
									</Button>
								)}
							</div>
						)}
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<AlertCircle className="h-5 w-5" />
							Low Stock Alert
						</CardTitle>
					</CardHeader>
					<CardContent>
						{lowStockProducts && lowStockProducts.length > 0 ? (
							<div className="space-y-4">
								{lowStockProducts.map((product: any) => (
									<div
										key={product.id}
										className="flex items-center justify-between"
									>
										<p className="font-medium">{product.name}</p>
										<span className="rounded-full bg-orange-100 px-3 py-1 text-sm font-medium text-orange-800">
											{product.stock_quantity} left
										</span>
									</div>
								))}
								<Button
									asChild
									variant="outline"
									className="w-full bg-transparent"
								>
									<Link href="/products">Manage Products</Link>
								</Button>
							</div>
						) : (
							<div className="py-8 text-center text-muted-foreground">
								<p>All products are well stocked</p>
								<Button
									asChild
									className="mt-4 bg-transparent"
									variant="outline"
								>
									<Link href="/products">View Products</Link>
								</Button>
							</div>
						)}
					</CardContent>
				</Card>
			</div>

			{/* License Management - Only for Admins */}
			{isAdmin && (
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Shield className="h-5 w-5" />
							License Management
						</CardTitle>
					</CardHeader>
					<CardContent>
						{licenseInfo ? (
							<div className="space-y-4">
								<div className="space-y-2 text-sm">
									<div>
										<p className="font-medium">Client Name</p>
										<p className="text-muted-foreground">
											{licenseInfo.clientName || "Not set"}
										</p>
									</div>
									<div>
										<p className="font-medium">License Key</p>
										<p className="text-muted-foreground font-mono text-xs break-all">
											{licenseInfo.licenseKey || "Not set"}
										</p>
									</div>
									<div>
										<p className="font-medium">Status</p>
										<p className="text-muted-foreground capitalize">
											{licenseInfo.status || "Unknown"}
										</p>
									</div>
									<div>
										<p className="font-medium">Expires On</p>
										<p className="text-muted-foreground">
											{licenseInfo.expiresOn
												? new Date(licenseInfo.expiresOn).toLocaleDateString()
												: "Not set"}
										</p>
									</div>
								</div>
								<Button
									onClick={handleClearLicense}
									disabled={clearingLicense}
									variant="outline"
									className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/50"
								>
									{clearingLicense ? (
										<>
											<Loader2 className="mr-2 h-4 w-4 animate-spin" />
											Resetting License...
										</>
									) : (
										<>
											<LogOut className="mr-2 h-4 w-4" />
											Reset License
										</>
									)}
								</Button>
								<p className="text-xs text-center text-muted-foreground">
									This will completely remove the license and reset this PC to a
									new installation state. You will need to activate again.
								</p>
							</div>
						) : (
							<div className="space-y-4">
								<p className="text-sm text-muted-foreground">
									No license information found.
								</p>
								<Button asChild variant="outline" className="w-full">
									<Link href="/license">Activate License</Link>
								</Button>
							</div>
						)}
					</CardContent>
				</Card>
			)}
		</div>
	);
}
