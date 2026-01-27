"use client";

import type React from "react";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	Plus,
	Trash2,
	Search,
	Maximize2,
	X,
	MessageCircle,
} from "lucide-react";
import { useFullscreen } from "@/lib/utils/fullscreen-context";
import { useToast } from "@/hooks/use-toast";
import { calculateLineItem, roundToTwo } from "@/lib/utils/gst-calculator";
import { Switch } from "@/components/ui/switch";
import { storageManager } from "@/lib/storage-manager";
import { InlineCustomerForm } from "@/components/features/customers/inline-customer-form";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { isIndexedDbMode } from "@/lib/utils/db-mode";
import { getB2BModeStatus } from "@/lib/utils/b2b-mode";
import { createClient } from "@/lib/supabase/client";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { db } from "@/lib/dexie-client";
import { useInvalidateQueries } from "@/lib/hooks/use-cached-data";
// DORMANT: R2 engine removed - Supabase is now primary
// import { executeInvoiceAction } from "@/lib/invoice-document-engine";
import { prepareInvoiceDocumentData } from "@/lib/invoice-document-engine";
// DORMANT: Slip functionality removed - using A4 invoice instead
// import { generateInvoiceSlipPDF } from "@/lib/utils/invoice-slip-pdf";
import { generateInvoicePDF } from "@/lib/utils/invoice-pdf";
import { LogoConfigModal } from "@/components/features/invoices/logo-config-modal";
// DORMANT: R2 error modal removed - Supabase uses RLS error modal
// import { R2UploadErrorModal } from "@/components/features/invoices/r2-upload-error-modal";
import { RLSErrorModal } from "@/components/features/customers/rls-error-modal";
import {
	ResizablePanelGroup,
	ResizablePanel,
	ResizableHandle,
} from "@/components/ui/resizable";
import {
	validateInvoiceAmount,
	validateItemQuantity,
	validateUnitPrice,
	validateLineTotal,
	validateGstRate,
	validateDiscountPercent,
} from "@/lib/utils/db-validation";






function useIsRealMobile() {
	const [isMobile, setIsMobile] = useState(false);

	useEffect(() => {
		const check = () => {
			const isSmallScreen = window.innerWidth < 768;
			const isTouch =
				window.matchMedia("(pointer: coarse)").matches ||
				"ontouchstart" in window;

			setIsMobile(isSmallScreen || isTouch);
		};

		check();
		window.addEventListener("resize", check);
		return () => window.removeEventListener("resize", check);
	}, []);

	return isMobile;
}











// Helper function to update product stock quantities after invoice creation
async function updateProductStock(
	items: Array<{ product_id: string | null; quantity: number }>,
	isIndexedDb: boolean,
	supabase?: ReturnType<typeof createClient>,
	userId?: string,
	originalProducts?: Product[]
) {
	try {
		// Group items by product_id to sum quantities
		const productQuantities = new Map<string, number>();

		for (const item of items) {
			if (item.product_id) {
				const currentQty = productQuantities.get(item.product_id) || 0;
				productQuantities.set(item.product_id, currentQty + item.quantity);
			}
		}

		if (isIndexedDb) {
			// Update products in IndexedDB
			for (const [productId, quantityToDeduct] of productQuantities.entries()) {
				try {
					// Use original product stock if provided, otherwise fetch from DB
					let currentStock: number | undefined;
					if (originalProducts) {
						const originalProduct = originalProducts.find(
							(p) => p.id === productId
						);
						if (
							originalProduct &&
							originalProduct.stock_quantity !== undefined
						) {
							currentStock = originalProduct.stock_quantity;
						}
					}

					if (currentStock === undefined) {
						const product = await db.products.get(productId);
						if (product && product.stock_quantity !== undefined) {
							currentStock = product.stock_quantity;
						}
					}

					if (currentStock !== undefined) {
						const newStock = Math.max(0, currentStock - quantityToDeduct);
						await db.products.update(productId, {
							stock_quantity: newStock,
						});
						console.log(
							`[InvoiceForm] Updated product ${productId} stock: ${currentStock} -> ${newStock}`
						);
					}
				} catch (error) {
					console.error(
						`[InvoiceForm] Error updating product ${productId} stock:`,
						error
					);
				}
			}
		} else if (supabase && userId) {
			// Update products in Supabase
			for (const [productId, quantityToDeduct] of productQuantities.entries()) {
				try {
					// Use original product stock if provided, otherwise fetch from DB
					let currentStock: number | undefined;
					if (originalProducts) {
						const originalProduct = originalProducts.find(
							(p) => p.id === productId
						);
						if (
							originalProduct &&
							originalProduct.stock_quantity !== undefined
						) {
							currentStock = originalProduct.stock_quantity;
						}
					}

					if (currentStock === undefined) {
						const { data: product, error: fetchError } = await supabase
							.from("products")
							.select("stock_quantity")
							.eq("id", productId)
							.eq("user_id", userId)
							.single();

						if (fetchError) {
							console.error(
								`[InvoiceForm] Error fetching product ${productId}:`,
								fetchError
							);
							continue;
						}

						if (product && product.stock_quantity !== undefined) {
							currentStock = product.stock_quantity;
						}
					}

					if (currentStock !== undefined) {
						const newStock = Math.max(0, currentStock - quantityToDeduct);
						const { error: updateError } = await supabase
							.from("products")
							.update({
								stock_quantity: newStock,
								updated_at: new Date().toISOString(),
							})
							.eq("id", productId)
							.eq("user_id", userId);

						if (updateError) {
							console.error(
								`[InvoiceForm] Error updating product ${productId} stock:`,
								updateError
							);
						} else {
							console.log(
								`[InvoiceForm] Updated product ${productId} stock: ${currentStock} -> ${newStock}`
							);
						}
					}
				} catch (error) {
					console.error(
						`[InvoiceForm] Error updating product ${productId} stock:`,
						error
					);
				}
			}
		}
	} catch (error) {
		console.error("[InvoiceForm] Error updating product stock:", error);
		// Don't throw - stock update failure shouldn't prevent invoice creation
	}
}

interface Customer {
	id: string;
	name: string;
}

interface Product {
	id: string;
	name: string;
	price: number;
	gst_rate: number;
	hsn_code: string | null;
	unit: string;
	stock_quantity?: number;
	sku?: string | null;
	category?: string | null;
	selling_unit?: "loose" | "together" | null;
}

interface BusinessSettings {
	invoice_prefix: string;
	next_invoice_number: number;
	default_gst_rate: number;
	place_of_supply: string | null;
}

interface InvoiceFormProps {
	customers: Customer[];
	products: Product[];
	settings: BusinessSettings | null;
	storeId?: string | null;
	employeeId?: string;
	onCustomersUpdate?: (customers: Customer[]) => void;
	invoice?: any; // Invoice data for editing mode
}

// LineItem interface for form state
interface LineItem {
	id: string;
	invoice_id?: string;
	product_id: string | null;
	description: string;
	quantity: number;
	unit_price: number;
	discount_percent: number;
	gst_rate: number;
	hsn_code?: string;
	line_total?: number;
	gst_amount?: number;
	created_at?: string;
	selling_unit?: "loose" | "together" | null;
}

export function InvoiceForm({
	customers,
	products: initialProducts,
	settings,
	storeId,
	employeeId,
	onCustomersUpdate,
	invoice: existingInvoice,
}: InvoiceFormProps) {
	const router = useRouter();
	const { toast } = useToast();
	const { isFullscreen, setIsFullscreen } = useFullscreen();
	const { invalidateInvoices, invalidateProducts } = useInvalidateQueries();
	const [isLoading, setIsLoading] = useState(false);
	const [isSharing, setIsSharing] = useState(false);
	const isEditMode = !!existingInvoice;
	const [invoiceNumber, setInvoiceNumber] = useState(existingInvoice?.invoice_number || "");
	const [localCustomers, setLocalCustomers] = useState<Customer[]>(customers);
	const [products, setProducts] = useState<Product[]>(initialProducts);
	const [storeName, setStoreName] = useState<string>("Business");
	const [showLogoModal, setShowLogoModal] = useState(false);
	const [logoUrl, setLogoUrl] = useState<string | null>(null);
	// DORMANT: R2 error modal state removed
	// const [showR2ErrorModal, setShowR2ErrorModal] = useState(false);
	// const [r2UploadError, setR2UploadError] = useState<string>("");
	const [showRLSErrorModal, setShowRLSErrorModal] = useState(false);
	const [rlsErrorDetails, setRlsErrorDetails] = useState<any>(null);
















	

	// Merge prop customers with local additions without removing new ones
	useEffect(() => {
		setLocalCustomers((prev) => {
			const dedup = new Map<string, Customer>();
			[...prev, ...customers].forEach((cust) => dedup.set(cust.id, cust));
			return Array.from(dedup.values());
		});
	}, [customers]);

	// Sync products when props change
	useEffect(() => {
		setProducts(initialProducts);
	}, [initialProducts]);

	// Fetch store name and logo URL
	useEffect(() => {
		const fetchStoreName = async () => {
			if (!storeId) {
				// Try to get from localStorage
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
					const store = await db.stores.get(storeId);
					if (store?.name) {
						setStoreName(store.name);
					}
				} else {
					const supabase = createClient();
					const { data: store } = await supabase
						.from("stores")
						.select("name")
						.eq("id", storeId)
						.single();
					if (store?.name) {
						setStoreName(store.name);
					}
				}
			} catch (err) {
				console.warn("[InvoiceForm] Failed to fetch store name:", err);
			}
		};

		const fetchLogoUrl = async () => {
			try {
				// First check localStorage cache
				const cachedLogo = localStorage.getItem("business_logo_url");
				if (cachedLogo) {
					setLogoUrl(cachedLogo);
					return;
				}

				// Get admin user_id (for both admin and employee)
				const supabase = createClient();
				const authType = localStorage.getItem("authType");
				let adminUserId: string | null = null;

				if (authType === "employee") {
					// For employees, get admin_user_id from store
					const employeeSession = localStorage.getItem("employeeSession");
					if (employeeSession) {
						try {
							const session = JSON.parse(employeeSession);
							const sessionStoreId = session.storeId || storeId;
							if (sessionStoreId) {
								const { data: store } = await supabase
									.from("stores")
									.select("admin_user_id")
									.eq("id", sessionStoreId)
									.single();
								adminUserId = store?.admin_user_id || null;
							}
						} catch (e) {
							console.warn("[InvoiceForm] Error parsing employee session:", e);
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
					console.warn("[InvoiceForm] Could not determine admin user ID");
					return;
				}

				// Fetch admin's logo from user_profiles
				const { data: profile } = await supabase
					.from("user_profiles")
					.select("logo_url")
					.eq("id", adminUserId)
					.maybeSingle();

				if (profile?.logo_url) {
					localStorage.setItem("business_logo_url", profile.logo_url);
					setLogoUrl(profile.logo_url);
				}
			} catch (err) {
				console.warn("[InvoiceForm] Failed to fetch logo URL:", err);
			}
		};

		fetchStoreName();
		fetchLogoUrl();
	}, [storeId]);

	useEffect(() => {
		// Generate invoice number on mount if we have store/employee
		if (storeId && employeeId) {
			// Use the unified function that automatically detects DB mode
			import("@/lib/utils/invoice-number").then(({ generateInvoiceNumber }) => {
				generateInvoiceNumber(storeId, employeeId)
					.then((num) => setInvoiceNumber(num))
					.catch((error) => {
						// Extract error message properly
						const errorMessage =
							error instanceof Error
								? error.message
								: error && typeof error === "object" && "message" in error
								? String(error.message)
								: String(error);

						console.error(
							"[InvoiceForm] Error generating invoice number:",
							errorMessage,
							error
						);

						// Fallback to simple format if generation fails
						setInvoiceNumber(
							`${settings?.invoice_prefix || "INV"}-${String(
								settings?.next_invoice_number || 1
							).padStart(4, "0")}`
						);
					});
			});
		} else {
			// Fallback to old format
			setInvoiceNumber(
				`${settings?.invoice_prefix || "INV"}-${String(
					settings?.next_invoice_number || 1
				).padStart(4, "0")}`
			);
		}
	}, [storeId, employeeId, settings]);
	const [invoiceDate, setInvoiceDate] = useState(
		new Date().toISOString().split("T")[0]
	);
	const [customerId, setCustomerId] = useState("");
	const [customerData, setCustomerData] = useState({
		name: "",
		phone: "",
		email: "",
		gstin: "",
		billing_address: "",
		city: "",
		state: "",
		pincode: "",
		isNewCustomer: false,
	});
	const [isGstInvoice, setIsGstInvoice] = useState(true);
	const [isSameState, setIsSameState] = useState(true);
	const [productSearchTerm, setProductSearchTerm] = useState("");
	const [focusedField, setFocusedField] = useState<string | null>(null);
	const [isB2BEnabled, setIsB2BEnabled] = useState(false);
	const isRealMobile = useIsRealMobile();

	const [lineItems, setLineItems] = useState<LineItem[]>([]);

	// Initialize form from existing invoice if in edit mode
	useEffect(() => {
		if (existingInvoice && isEditMode) {
			setInvoiceNumber(existingInvoice.invoice_number || "");
			setInvoiceDate(existingInvoice.invoice_date || new Date().toISOString().split("T")[0]);
			setCustomerId(existingInvoice.customer_id || "");
			setIsGstInvoice(existingInvoice.is_gst_invoice ?? true);
			setIsSameState(true); // Default, can be calculated from invoice if needed
			
			// Load line items
			if (existingInvoice.invoice_items && Array.isArray(existingInvoice.invoice_items)) {
				const items = existingInvoice.invoice_items.map((item: any) => ({
					id: item.id || crypto.randomUUID(),
					invoice_id: item.invoice_id,
					product_id: item.product_id || null,
					description: item.description || "",
					quantity: item.quantity || 1,
					unit_price: item.unit_price || 0,
					discount_percent: item.discount_percent || 0,
					gst_rate: item.gst_rate || 0,
					hsn_code: item.hsn_code || "",
					line_total: item.line_total,
					gst_amount: item.gst_amount,
					created_at: item.created_at,
					selling_unit: item.selling_unit || null,
				}));
				setLineItems(items);
			}
			
			// Load customer data if available
			if (existingInvoice.customers || existingInvoice.customer) {
				const customer = existingInvoice.customers || existingInvoice.customer;
				setCustomerData({
					name: customer.name || "",
					phone: customer.phone || "",
					email: customer.email || "",
					gstin: customer.gstin || "",
					billing_address: customer.billing_address || "",
					city: customer.city || "",
					state: customer.state || "",
					pincode: customer.pincode || "",
					isNewCustomer: false,
				});
			}
		}
	}, [existingInvoice, isEditMode]);

	// Load B2B mode status and enforce GST when B2B is enabled
	useEffect(() => {
		const loadB2BStatus = async () => {
			try {
				const b2bEnabled = await getB2BModeStatus();
				setIsB2BEnabled(b2bEnabled);
				// Force GST invoice when B2B is enabled
				if (b2bEnabled) {
					setIsGstInvoice(true);
				}
			} catch (error) {
				console.error("[InvoiceForm] Failed to load B2B status:", error);
			}
		};
		loadB2BStatus();
	}, []);

	const addLineItem = useCallback(() => {
		setLineItems((prev) => [
			...prev,
			{
				id: crypto.randomUUID(),
				product_id: null,
				description: "",
				quantity: 1,
				unit_price: 0,
				discount_percent: 0,
				gst_rate: settings?.default_gst_rate || 18,
				hsn_code: "",
				selling_unit: null,
			},
		]);
	}, [settings?.default_gst_rate]);

	// Don't add initial line item - start with empty list

	const removeLineItem = (id: string) => {
		const itemToRemove = lineItems.find((item) => item.id === id);
		// Restore stock when item is removed
		if (itemToRemove?.product_id && itemToRemove.quantity) {
			const product = products.find((p) => p.id === itemToRemove.product_id);
			if (product && product.stock_quantity !== undefined) {
				const newStock = (product.stock_quantity || 0) + itemToRemove.quantity;
				setProducts((prevProducts) =>
					prevProducts.map((p) =>
						p.id === itemToRemove.product_id
							? { ...p, stock_quantity: newStock }
							: p
					)
				);
			}
		}

		// Remove the item
		const newLineItems = lineItems.filter((item) => item.id !== id);
		setLineItems(newLineItems);
	};

	const updateLineItem = (id: string, field: keyof LineItem, value: any) => {
		setLineItems(
			lineItems.map((item) => {
				if (item.id === id) {
					// If product is selected, auto-fill details
					if (field === "product_id" && value) {
						const product = products.find((p) => p.id === value);
						if (product) {
							// Decrease stock in real-time when product is added
							if (product.stock_quantity !== undefined) {
								const newStock = Math.max(
									0,
									(product.stock_quantity || 0) - (item.quantity || 1)
								);
								setProducts((prevProducts) =>
									prevProducts.map((p) =>
										p.id === value ? { ...p, stock_quantity: newStock } : p
									)
								);
							}
							return {
								...item,
								product_id: value,
								description: product.name,
								unit_price: product.price,
								gst_rate: product.gst_rate || settings?.default_gst_rate || 18,
								hsn_code: product.hsn_code || "",
								selling_unit: product.selling_unit || null,
							};
						}
					}
					// If quantity changes and product is selected, update stock
					if (field === "quantity" && item.product_id) {
						const product = products.find((p) => p.id === item.product_id);
						if (product && product.stock_quantity !== undefined) {
							const oldQty = item.quantity || 0;
							const newQty = value || 0;
							const diff = oldQty - newQty; // negative if increasing, positive if decreasing
							const currentStock = product.stock_quantity;
							const newStock = Math.max(0, currentStock + diff);
							setProducts((prevProducts) =>
								prevProducts.map((p) =>
									p.id === item.product_id
										? { ...p, stock_quantity: newStock }
										: p
								)
							);
						}
					}
					return { ...item, [field]: value };
				}
				return item;
			})
		);
	};

	// Calculate frequently bought products (products that appear most in lineItems)
	const frequentlyBoughtProducts = useMemo(() => {
		// For now, we'll show products with stock > 0 (or no stock limit), sorted by name
		// In a real app, you'd track purchase frequency from invoice_items
		return products
			.filter((p) => p.stock_quantity === undefined || p.stock_quantity > 0)
			.slice(0, 8)
			.sort((a, b) => a.name.localeCompare(b.name));
	}, [products]);

	const recentProducts = useMemo(() => {
		const ordered = [...lineItems]
			.map((item) => item.product_id)
			.filter((id): id is string => Boolean(id))
			.reverse();
		const uniqueIds = Array.from(new Set(ordered));
		const mapped = uniqueIds
			.map((id) => products.find((p) => p.id === id))
			.filter((p): p is Product => Boolean(p));
		return mapped.slice(0, 8);
	}, [lineItems, products]);

	const alphabeticalProducts = useMemo(
		() => [...products].sort((a, b) => a.name.localeCompare(b.name)),
		[products]
	);

	// Filter products based on search
	const filteredProducts = useMemo(() => {
		const availableProducts = alphabeticalProducts.filter(
			(p) => p.stock_quantity === undefined || p.stock_quantity > 0
		);
		if (!productSearchTerm) return availableProducts;
		const search = productSearchTerm.toLowerCase();
		return availableProducts.filter(
			(p) =>
				p.name.toLowerCase().includes(search) ||
				p.sku?.toLowerCase().includes(search) ||
				p.category?.toLowerCase().includes(search)
		);
	}, [alphabeticalProducts, productSearchTerm]);

	// Add product to invoice
	const addProductToInvoice = (product: Product) => {
		// Check if product already exists in line items
		const existingItem = lineItems.find(
			(item) => item.product_id === product.id
		);

		if (existingItem) {
			// If product exists, increase quantity by 1
			updateLineItem(existingItem.id, "quantity", existingItem.quantity + 1);

			// Decrease stock in real-time
			if (product.stock_quantity !== undefined) {
				const newStock = Math.max(0, (product.stock_quantity || 0) - 1);
				setProducts((prevProducts) =>
					prevProducts.map((p) =>
						p.id === product.id ? { ...p, stock_quantity: newStock } : p
					)
				);
			}

			toast({
				title: "Quantity increased",
				description: `${product.name} quantity increased to ${
					existingItem.quantity + 1
				}`,
			});
		} else {
			// If product doesn't exist, add new line item
			const newLineItem: LineItem = {
				id: crypto.randomUUID(),
				product_id: product.id,
				description: product.name,
				quantity: 1,
				unit_price: product.price,
				discount_percent: 0,
				gst_rate: product.gst_rate || settings?.default_gst_rate || 18,
				hsn_code: product.hsn_code || "",
				selling_unit: product.selling_unit || null,
			};
			setLineItems([...lineItems, newLineItem]);

			// Decrease stock in real-time when product is added
			if (product.stock_quantity !== undefined) {
				const newStock = Math.max(0, (product.stock_quantity || 0) - 1);
				setProducts((prevProducts) =>
					prevProducts.map((p) =>
						p.id === product.id ? { ...p, stock_quantity: newStock } : p
					)
				);
			}

			toast({
				title: "Product added",
				description: `${product.name} added to invoice`,
			});
		}

		setProductSearchTerm("");
	};

	// Calculate totals
	const calculateTotals = () => {
		let subtotal = 0;
		let totalGst = 0;
		let cgst = 0;
		let sgst = 0;
		let igst = 0;

		lineItems.forEach((item) => {
			// Fix: Ensure we pass the correct format to calculateLineItem
			// If GST is disabled, use 0% GST rate for calculation
			const effectiveGstRate = isGstInvoice ? (item.gst_rate || 0) : 0;
			const calc = calculateLineItem({
				unitPrice: item.unit_price,
				discountPercent: item.discount_percent,
				gstRate: effectiveGstRate,
				quantity: item.quantity,
			});
			subtotal += calc.taxableAmount;

			if (isGstInvoice && effectiveGstRate > 0) {
				totalGst += calc.gstAmount;
				if (isSameState) {
					cgst += calc.gstAmount / 2;
					sgst += calc.gstAmount / 2;
				} else {
					igst += calc.gstAmount;
				}
			}
		});

		const total = subtotal + totalGst;

		return {
			subtotal: roundToTwo(subtotal),
			cgst: roundToTwo(cgst),
			sgst: roundToTwo(sgst),
			igst: roundToTwo(igst),
			totalGst: roundToTwo(totalGst),
			total: roundToTwo(total),
		};
	};

	const totals = calculateTotals();

	// Create customer function for auto-creation during invoice submission
	const createCustomer = async (data: {
		name: string;
		phone: string;
		email: string;
		gstin?: string;
		billing_address?: string;
		city?: string;
		state?: string;
		pincode?: string;
	}) => {
		try {
			const isIndexedDb = isIndexedDbMode();
			let newCustomer: { id: string; name: string };

			// Get current store ID for store-scoped isolation
			const { getCurrentStoreId } = await import(
				"@/lib/utils/get-current-store-id"
			);
			const currentStoreId = await getCurrentStoreId();

			if (isIndexedDb) {
				// Create customer in IndexedDB
				const customerId = crypto.randomUUID();
				const customerDataToSave = {
					id: customerId,
					name: data.name,
					phone: data.phone,
					email: data.email || null,
					gstin: data.gstin || null,
					billing_address: data.billing_address || null,
					city: data.city || null,
					state: data.state || null,
					pincode: data.pincode || null,
					store_id: currentStoreId || undefined, // Store-scoped isolation - use undefined instead of null
					created_at: new Date().toISOString(),
					updated_at: new Date().toISOString(),
				};

				await db.customers.add(customerDataToSave);
				newCustomer = { id: customerId, name: customerDataToSave.name };
			} else {
				// Create customer in Supabase
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
					const {
						data: { user },
					} = await supabase.auth.getUser();
					if (user) userId = user.id;
				}

				if (!userId) {
					throw new Error(
						"Could not determine admin user. Please ensure you're logged in and have a valid store assignment."
					);
				}

				// Ensure store_id is set (required for RLS)
				if (!currentStoreId) {
					console.warn(
						"[InvoiceForm] No store_id available, customer will be created without store_id"
					);
				}

				// Build insert object - only include fields that exist in schema
				const customerInsert: any = {
					name: data.name,
					phone: data.phone,
					email: data.email || null,
					gstin: data.gstin || null,
					billing_address: data.billing_address || null,
					user_id: userId,
					store_id: currentStoreId || null, // Store-scoped isolation
					created_at: new Date().toISOString(),
					updated_at: new Date().toISOString(),
				};

				// Add B2B fields only if they exist in schema (check by trying to insert them)
				// If schema doesn't have these columns, they'll be ignored
				if (
					data.city !== undefined &&
					data.city !== null &&
					data.city.trim() !== ""
				) {
					customerInsert.city = data.city;
				}
				if (
					data.state !== undefined &&
					data.state !== null &&
					data.state.trim() !== ""
				) {
					customerInsert.state = data.state;
				}
				if (
					data.pincode !== undefined &&
					data.pincode !== null &&
					data.pincode.trim() !== ""
				) {
					customerInsert.pincode = data.pincode;
				}

				const { data: createdCustomer, error } = await supabase
					.from("customers")
					.insert(customerInsert)
					.select()
					.single();

				if (error) {
					// Collect detailed diagnostics for RLS errors
					let diagnostics: any = {};
					const isRLSError =
						error.code === "42501" ||
						error.message?.toLowerCase().includes("row-level security") ||
						error.message?.toLowerCase().includes("policy");

					if (isRLSError) {
						// Get auth.uid() for comparison
						const {
							data: { user: authUser },
						} = await supabase.auth.getUser();
						diagnostics.authUid = authUser?.id || null;

						if (authType === "employee") {
							// Check employee and store details
							const empSession = localStorage.getItem("employeeSession");
							if (empSession) {
								try {
									const session = JSON.parse(empSession);
									const sessionStoreId = session.storeId;

									if (sessionStoreId) {
										// Check if store exists and get admin_user_id
										const { data: store } = await supabase
											.from("stores")
											.select("admin_user_id")
											.eq("id", sessionStoreId)
											.maybeSingle();

										diagnostics.storeExists = !!store;
										diagnostics.storeAdminUserId = store?.admin_user_id || null;
										diagnostics.employeeStoreId = sessionStoreId;

										// Check if employee exists
										const { data: employee } = await supabase
											.from("employees")
											.select("id, store_id")
											.eq("store_id", sessionStoreId)
											.maybeSingle();

										diagnostics.employeeExists = !!employee;
									}
								} catch (e) {
									console.error(
										"[InvoiceForm] Error parsing employee session:",
										e
									);
								}
							}
						}
					}

					const errorDetails = {
						errorCode: error.code,
						errorMessage: error.message,
						errorHint: error.hint,
						errorDetails: error.details,
						policyName: isRLSError
							? "Store members insert customers"
							: undefined,
						userId,
						storeId: currentStoreId,
						authType,
						attemptedValues: {
							user_id: userId,
							store_id: currentStoreId,
							name: data.name,
						},
						diagnostics: isRLSError ? diagnostics : undefined,
					};

					console.error(
						"[InvoiceForm] Customer creation error with diagnostics:",
						errorDetails
					);

					// Show RLS error modal for RLS errors
					if (isRLSError) {
						setRlsErrorDetails(errorDetails);
						setShowRLSErrorModal(true);
						throw new Error(
							error.message ||
								error.hint ||
								`RLS Policy Error: ${error.code || "Unknown error"}`
						);
					}

					// For non-RLS errors, throw normally
					throw new Error(
						error.message ||
							error.hint ||
							`Failed to create customer: ${error.code || "Unknown error"}`
					);
				}
				if (!createdCustomer)
					throw new Error("Failed to create customer - no data returned");

				newCustomer = { id: createdCustomer.id, name: createdCustomer.name };
			}

			// Update local customers list
			setLocalCustomers((prev) => [newCustomer, ...prev]);
			return newCustomer;
		} catch (error) {
			console.error("Error creating customer:", error);
			throw error;
		}
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		// Validate customer (either existing selected or new customer data entered)
		let finalCustomerId = customerId;

		if (
			!finalCustomerId &&
			customerData.isNewCustomer &&
			customerData.name &&
			customerData.phone
		) {
			// Auto-create new customer
			try {
				const newCustomer = await createCustomer({
					name: customerData.name,
					phone: customerData.phone,
					email: customerData.email,
					gstin: customerData.gstin,
					billing_address: customerData.billing_address,
					city: customerData.city,
					state: customerData.state,
					pincode: customerData.pincode,
				});
				finalCustomerId = newCustomer.id;
				setCustomerId(finalCustomerId);
				toast({
					title: "Customer Created",
					description: `New customer ${newCustomer.name} has been added`,
				});
			} catch (error) {
				// Check if it's an RLS error - if so, the modal is already shown
				const errorMessage =
					error instanceof Error ? error.message : "Failed to create customer";
				const isRLSError =
					errorMessage.includes("RLS") || errorMessage.includes("42501");

				if (!isRLSError) {
					// For non-RLS errors, show toast
					toast({
						title: "Error",
						description: errorMessage,
						variant: "destructive",
					});
				}
				setIsLoading(false);
				return;
			}
		}

		if (!finalCustomerId) {
			toast({
				title: "Error",
				description:
					"Please select an existing customer or enter new customer details",
				variant: "destructive",
			});
			setIsLoading(false);
			return;
		}

		// Validate line items exist
		if (lineItems.length === 0) {
			toast({
				title: "Error",
				description: "Please add at least one item to the invoice",
				variant: "destructive",
			});
			return;
		}

		setIsLoading(true);
		try {
			const t = calculateTotals();

			// Validate invoice total amount
			const totalValidation = validateInvoiceAmount(t.total);
			if (!totalValidation.isValid) {
				toast({
					title: "Invoice Amount Exceeds Limit",
					description: totalValidation.error,
					variant: "destructive",
				});
				setIsLoading(false);
				return;
			}

			// Validate subtotal
			const subtotalValidation = validateInvoiceAmount(t.subtotal);
			if (!subtotalValidation.isValid) {
				toast({
					title: "Subtotal Exceeds Limit",
					description: subtotalValidation.error,
					variant: "destructive",
				});
				setIsLoading(false);
				return;
			}

			// Validate each line item
			for (let i = 0; i < lineItems.length; i++) {
				const item = lineItems[i];

				// Skip empty line items (allow one empty item for flexibility)
				if (
					!item.product_id &&
					(!item.description || item.description.trim() === "") &&
					item.quantity === 0 &&
					item.unit_price === 0
				) {
					continue;
				}

				// Validate that item has either a product or description
				if (
					!item.product_id &&
					(!item.description || item.description.trim() === "")
				) {
					toast({
						title: `Line Item ${i + 1} Error`,
						description: "Please select a product or enter a description",
						variant: "destructive",
					});
					setIsLoading(false);
					return;
				}

				// Validate quantity
				const qtyValidation = validateItemQuantity(item.quantity);
				if (!qtyValidation.isValid) {
					toast({
						title: `Line Item ${i + 1} Error`,
						description: qtyValidation.error,
						variant: "destructive",
					});
					setIsLoading(false);
					return;
				}

				// Validate unit price
				const priceValidation = validateUnitPrice(item.unit_price);
				if (!priceValidation.isValid) {
					toast({
						title: `Line Item ${i + 1} Error`,
						description: priceValidation.error,
						variant: "destructive",
					});
					setIsLoading(false);
					return;
				}

				// Validate GST rate
				const gstValidation = validateGstRate(item.gst_rate);
				if (!gstValidation.isValid) {
					toast({
						title: `Line Item ${i + 1} Error`,
						description: gstValidation.error,
						variant: "destructive",
					});
					setIsLoading(false);
					return;
				}

				// Validate discount percent
				const discountValidation = validateDiscountPercent(
					item.discount_percent
				);
				if (!discountValidation.isValid) {
					toast({
						title: `Line Item ${i + 1} Error`,
						description: discountValidation.error,
						variant: "destructive",
					});
					setIsLoading(false);
					return;
				}

				// Calculate and validate line total
				const calc = calculateLineItem({
					unitPrice: item.unit_price,
					discountPercent: item.discount_percent,
					gstRate: item.gst_rate,
					quantity: item.quantity,
				});
				const lineTotal = calc.taxableAmount + calc.gstAmount;
				const lineTotalValidation = validateLineTotal(lineTotal);
				if (!lineTotalValidation.isValid) {
					toast({
						title: `Line Item ${i + 1} Total Exceeds Limit`,
						description: lineTotalValidation.error,
						variant: "destructive",
					});
					setIsLoading(false);
					return;
				}
			}

			// Validate store_id is present (required after RLS rebuild)
			// Try to get from localStorage if not provided
			let finalStoreId = storeId;
			if (!finalStoreId) {
				const currentStoreId = localStorage.getItem("currentStoreId");
				if (currentStoreId) {
					finalStoreId = currentStoreId;
				} else {
					toast({
						title: "Error",
						description:
							"Store ID is required. Please select a store or contact your administrator.",
						variant: "destructive",
					});
					setIsLoading(false);
					return;
				}
			}

			const invoiceId = isEditMode && existingInvoice?.id ? existingInvoice.id : crypto.randomUUID();
			console.log(
				`[InvoiceForm] ${isEditMode ? 'Updating' : 'Creating'} invoice with customer_id:`,
				finalCustomerId
			);
			const invoiceData = {
				id: invoiceId,
				customer_id: finalCustomerId,
				invoice_number: invoiceNumber,
				invoice_date: invoiceDate,
				status: isEditMode ? (existingInvoice?.status || "draft") : "draft",
				is_gst_invoice: isGstInvoice,
				subtotal: t.subtotal,
				cgst_amount: t.cgst,
				sgst_amount: t.sgst,
				igst_amount: t.igst,
				total_amount: t.total,
				created_at: isEditMode ? (existingInvoice?.created_at || new Date().toISOString()) : new Date().toISOString(),
				updated_at: new Date().toISOString(),
				store_id: finalStoreId, // Required - validated above
				employee_id: employeeId || existingInvoice?.employee_id || undefined,
				created_by_employee_id: employeeId || existingInvoice?.created_by_employee_id || undefined,
			};

			// Calculate line totals and GST for each item (filter out empty items)
			const validLineItems = lineItems.filter(
				(item) =>
					item.product_id ||
					(item.description && item.description.trim() !== "")
			);

			const items = validLineItems.map((li) => {
				const calc = calculateLineItem({
					unitPrice: li.unit_price,
					discountPercent: li.discount_percent,
					gstRate: li.gst_rate,
					quantity: li.quantity,
				});
				return {
					id: li.id,
					invoice_id: invoiceId,
					product_id: li.product_id || null,
					description: li.description,
					quantity: li.quantity,
					unit_price: li.unit_price,
					discount_percent: li.discount_percent,
					gst_rate: li.gst_rate,
					hsn_code: li.hsn_code || null,
					line_total: calc.taxableAmount + calc.gstAmount,
					gst_amount: calc.gstAmount,
					created_at: li.created_at || new Date().toISOString(),
					selling_unit: li.selling_unit || null,
				};
			});

			console.log("[InvoiceForm] Saving invoice", invoiceData, items);

			// Use async mode detection to ensure employees get correct mode from admin
			const { getActiveDbModeAsync } = await import("@/lib/utils/db-mode");
			const dbMode = await getActiveDbModeAsync();
			const isIndexedDb = dbMode === "indexeddb";

			console.log(
				"[InvoiceForm] DB Mode detected:",
				dbMode,
				"isIndexedDb:",
				isIndexedDb
			);

			if (isIndexedDb) {
				// Save or update in Dexie
				if (isEditMode) {
					await storageManager.updateInvoice(invoiceData, items);
				} else {
					await storageManager.addInvoice(invoiceData, items);
					// Decrease product stock quantities only for new invoices
					await updateProductStock(
						items,
						isIndexedDb,
						undefined,
						undefined,
						initialProducts
					);
				}

				// Dispatch event to notify customer detail page to refresh
				window.dispatchEvent(
					new CustomEvent(isEditMode ? "invoice:updated" : "invoice:created", {
						detail: { customer_id: customerId, invoice_id: invoiceId },
					})
				);

				// Invalidate cache for instant UI update
				await invalidateInvoices();
				if (!isEditMode) {
					await invalidateProducts(); // Also invalidate products since stock changed
				}

				toast({
					title: "Success",
					description: isEditMode ? "Invoice updated successfully" : "Invoice created successfully",
				});
				router.push("/invoices");
				router.refresh();
			} else {
				// Save to Supabase
				const supabase = createClient();

				// Get admin user_id (for employees, this is their admin's id)
				const { getAdminUserIdForInvoices } = await import(
					"@/lib/utils/get-admin-user-id-for-employees"
				);
				const adminUserId = await getAdminUserIdForInvoices();

				if (!adminUserId) {
					const authType = localStorage.getItem("authType");
					const errorMsg =
						authType === "employee"
							? "Could not determine admin user. Please ensure you're assigned to a store."
							: "Could not determine admin user. Please ensure you're logged in.";

					toast({
						title: "Error",
						description: errorMsg,
						variant: "destructive",
					});
					console.error(
						"[InvoiceForm] Cannot create invoice - adminUserId is null",
						{
							authType,
							employeeSession: localStorage.getItem("employeeSession"),
						}
					);
					return;
				}

				// Log the user_id being used for debugging
				console.log("[InvoiceForm] Creating invoice with user_id:", {
					user_id: adminUserId,
					authType: localStorage.getItem("authType"),
					invoiceData: {
						id: invoiceData.id,
						store_id: invoiceData.store_id,
						employee_id: invoiceData.employee_id,
					},
				});

				// Prepare invoice data with user_id
				const invoiceToInsert = { ...invoiceData, user_id: adminUserId };
				console.log("[InvoiceForm] Invoice data to insert:", {
					id: invoiceToInsert.id,
					user_id: invoiceToInsert.user_id,
					store_id: invoiceToInsert.store_id,
					customer_id: invoiceToInsert.customer_id,
					employee_id: invoiceToInsert.employee_id,
					total_amount: invoiceToInsert.total_amount,
				});

				const { data: newInvoice, error: invoiceError } = await supabase
					.from("invoices")
					.insert(invoiceToInsert)
					.select()
					.single();

				if (invoiceError) {
					console.error("[InvoiceForm] Invoice insert error details:", {
						error: invoiceError,
						message: invoiceError.message,
						code: invoiceError.code,
						details: invoiceError.details,
						hint: invoiceError.hint,
						invoiceData: invoiceToInsert,
					});

					if (
						invoiceError.code === "42501" ||
						invoiceError.message.includes("row-level security")
					) {
						console.error("[InvoiceForm] RLS ERROR - Diagnostic Info:", {
							user_id_used: adminUserId,
							store_id: invoiceData.store_id,
							employee_id: invoiceData.employee_id,
							authType: localStorage.getItem("authType"),
							employeeSession: localStorage.getItem("employeeSession"),
						});

						// Try to verify the store exists and has correct admin_user_id
						const { data: storeVerify, error: storeVerifyError } =
							await supabase
								.from("stores")
								.select("id, admin_user_id, name")
								.eq("id", invoiceData.store_id)
								.maybeSingle();

						if (storeVerifyError) {
							console.error(
								"[InvoiceForm] Store verification error:",
								storeVerifyError
							);
						} else if (storeVerify) {
							console.error("[InvoiceForm] Store verification:", {
								store_id: storeVerify.id,
								store_name: storeVerify.name,
								store_admin_user_id: storeVerify.admin_user_id,
								invoice_user_id: adminUserId,
								should_match: storeVerify.admin_user_id === adminUserId,
							});
						} else {
							console.error(
								"[InvoiceForm] Store not found for store_id:",
								invoiceData.store_id
							);
						}
					}

					throw invoiceError;
				}

				if (isEditMode) {
					// Update invoice items: delete old ones and insert new ones
					const { error: deleteItemsError } = await supabase
						.from("invoice_items")
						.delete()
						.eq("invoice_id", invoiceId);
					if (deleteItemsError) throw deleteItemsError;

					const itemsWithInvoiceId = items.map((item) => ({
						...item,
						invoice_id: invoiceId,
					}));

					const { error: itemsError } = await supabase
						.from("invoice_items")
						.insert(itemsWithInvoiceId);
					if (itemsError) throw itemsError;
				} else {
					// Insert new invoice items
					const itemsWithInvoiceId = items.map((item) => ({
						...item,
						invoice_id: newInvoice.id,
					}));

					const { error: itemsError } = await supabase
						.from("invoice_items")
						.insert(itemsWithInvoiceId);
					if (itemsError) throw itemsError;

					// Decrease product stock quantities only for new invoices
					await updateProductStock(
						items,
						isIndexedDb,
						supabase,
						adminUserId,
						initialProducts
					);
				}

				// Dispatch event to notify customer detail page to refresh
				window.dispatchEvent(
					new CustomEvent(isEditMode ? "invoice:updated" : "invoice:created", {
						detail: { customer_id: customerId, invoice_id: invoiceId },
					})
				);

				// Invalidate cache for instant UI update
				await invalidateInvoices();
				if (!isEditMode) {
					await invalidateProducts(); // Also invalidate products since stock changed
				}

				toast({
					title: "Success",
					description: isEditMode ? "Invoice updated successfully" : "Invoice created successfully",
				});
				router.push("/invoices");
				router.refresh();
			}
		} catch (error) {
			console.error("[InvoiceForm] Error saving invoice:", error);
			toast({
				title: "Error",
				description:
					error instanceof Error ? error.message : "Failed to save invoice",
				variant: "destructive",
			});
		} finally {
			setIsLoading(false);
		}
	};

	// Handle Save and Share on WhatsApp
	const handleSaveAndShare = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!navigator.onLine) {
			toast({
				title: "Offline",
				description: "Internet required to share invoice on WhatsApp",
				variant: "destructive",
			});
			return;
		}

		// Check if logo is configured
		// For employees, try to fetch admin's logo if not already loaded
		const authType = localStorage.getItem("authType");
		let currentLogoUrl = logoUrl || localStorage.getItem("business_logo_url");

		// If no logo and employee, try to fetch admin's logo one more time
		if (
			(!currentLogoUrl || currentLogoUrl.trim() === "") &&
			authType === "employee"
		) {
			try {
				const supabase = createClient();
				const employeeSession = localStorage.getItem("employeeSession");
				if (employeeSession) {
					const session = JSON.parse(employeeSession);
					const sessionStoreId = session.storeId || storeId;
					if (sessionStoreId) {
						const { data: store } = await supabase
							.from("stores")
							.select("admin_user_id")
							.eq("id", sessionStoreId)
							.single();

						if (store?.admin_user_id) {
							const { data: profile } = await supabase
								.from("user_profiles")
								.select("logo_url")
								.eq("id", store.admin_user_id)
								.maybeSingle();

							if (profile?.logo_url) {
								currentLogoUrl = profile.logo_url;
								localStorage.setItem("business_logo_url", profile.logo_url);
								setLogoUrl(profile.logo_url);
							}
						}
					}
				}
			} catch (err) {
				console.warn(
					"[InvoiceForm] Failed to fetch admin logo in share handler:",
					err
				);
			}
		}

		// For employees, don't show logo modal (they can't upload logos)
		// Allow sharing even without logo
		if (!currentLogoUrl || currentLogoUrl.trim() === "") {
			if (authType === "employee") {
				// For employees, silently continue without logo (no toast message)
				// Logo will be empty/placeholder in PDF, which is fine
			} else {
				// For admins, show the logo upload modal
				setShowLogoModal(true);
				return;
			}
		}

		// First, validate and save invoice (same as handleSubmit)
		let finalCustomerId = customerId;

		if (
			!finalCustomerId &&
			customerData.isNewCustomer &&
			customerData.name &&
			customerData.phone
		) {
			try {
				const newCustomer = await createCustomer({
					name: customerData.name,
					phone: customerData.phone,
					email: customerData.email,
					gstin: customerData.gstin,
					billing_address: customerData.billing_address,
					city: customerData.city,
					state: customerData.state,
					pincode: customerData.pincode,
				});
				finalCustomerId = newCustomer.id;
				setCustomerId(finalCustomerId);
			} catch (error) {
				// Check if it's an RLS error - if so, the modal is already shown
				const errorMessage =
					error instanceof Error ? error.message : "Failed to create customer";
				const isRLSError =
					errorMessage.includes("RLS") || errorMessage.includes("42501");

				if (!isRLSError) {
					// For non-RLS errors, show toast
					toast({
						title: "Error",
						description: errorMessage,
						variant: "destructive",
					});
				}
				setIsSharing(false);
				return;
			}
		}

		if (!finalCustomerId) {
			toast({
				title: "Error",
				description:
					"Please select an existing customer or enter new customer details",
				variant: "destructive",
			});
			setIsSharing(false);
			return;
		}

		if (lineItems.length === 0) {
			toast({
				title: "Error",
				description: "Please add at least one item to the invoice",
				variant: "destructive",
			});
			setIsSharing(false);
			return;
		}

		setIsSharing(true);
		setIsLoading(true);

		// Declare invoiceId and savedInvoice outside try block so they're accessible everywhere
		let invoiceId: string | undefined;
		let savedInvoice: any = null;

		try {
			const t = calculateTotals();

			// Validate invoice total
			const totalValidation = validateInvoiceAmount(t.total);
			if (!totalValidation.isValid) {
				toast({
					title: "Invoice Amount Exceeds Limit",
					description: totalValidation.error,
					variant: "destructive",
				});
				setIsSharing(false);
				setIsLoading(false);
				return;
			}

			// Validate store_id is present (required after RLS rebuild)
			// Try to get from localStorage if not provided
			let finalStoreIdForShare = storeId;
			if (!finalStoreIdForShare) {
				const currentStoreId = localStorage.getItem("currentStoreId");
				if (currentStoreId) {
					finalStoreIdForShare = currentStoreId;
				} else {
					toast({
						title: "Error",
						description:
							"Store ID is required. Please select a store or contact your administrator.",
						variant: "destructive",
					});
					setIsSharing(false);
					setIsLoading(false);
					return;
				}
			}

			invoiceId = crypto.randomUUID();
			const invoiceData = {
				id: invoiceId,
				customer_id: finalCustomerId,
				invoice_number: invoiceNumber,
				invoice_date: invoiceDate,
				status: "draft",
				is_gst_invoice: isGstInvoice,
				subtotal: t.subtotal,
				cgst_amount: t.cgst,
				sgst_amount: t.sgst,
				igst_amount: t.igst,
				total_amount: t.total,
				created_at: new Date().toISOString(),
				store_id: finalStoreIdForShare, // Required - validated above
				employee_id: employeeId || undefined,
				created_by_employee_id: employeeId || undefined,
			};

			const validLineItems = lineItems.filter(
				(item) =>
					item.product_id ||
					(item.description && item.description.trim() !== "")
			);

			const items = validLineItems.map((li) => {
				const calc = calculateLineItem({
					unitPrice: li.unit_price,
					discountPercent: li.discount_percent,
					gstRate: li.gst_rate,
					quantity: li.quantity,
				});
				return {
					id: li.id,
					invoice_id: invoiceId,
					product_id: li.product_id || null,
					description: li.description,
					quantity: li.quantity,
					unit_price: li.unit_price,
					discount_percent: li.discount_percent,
					gst_rate: li.gst_rate,
					hsn_code: li.hsn_code || null,
					line_total: calc.taxableAmount + calc.gstAmount,
					gst_amount: calc.gstAmount,
					created_at: li.created_at || new Date().toISOString(),
					selling_unit: li.selling_unit || null,
				};
			});

			// Save invoice
			// Use async mode detection to ensure employees get correct mode from admin
			const { getActiveDbModeAsync } = await import("@/lib/utils/db-mode");
			const dbMode = await getActiveDbModeAsync();
			const isIndexedDb = dbMode === "indexeddb";

			console.log(
				"[InvoiceForm] DB Mode for save & share:",
				dbMode,
				"isIndexedDb:",
				isIndexedDb
			);

			if (isIndexedDb) {
				await storageManager.addInvoice(invoiceData, items);
				// For IndexedDB, the invoiceData is the saved invoice
				savedInvoice = invoiceData;
				await updateProductStock(
					items,
					isIndexedDb,
					undefined,
					undefined,
					initialProducts
				);
				await invalidateInvoices();
				await invalidateProducts();
			} else {
				const supabase = createClient();

				// Get admin user_id (for employees, this is their admin's id)
				const { getAdminUserIdForInvoices } = await import(
					"@/lib/utils/get-admin-user-id-for-employees"
				);
				const adminUserId = await getAdminUserIdForInvoices();

				if (!adminUserId) {
					const authType = localStorage.getItem("authType");
					const errorMsg =
						authType === "employee"
							? "Could not determine admin user. Please ensure you're assigned to a store."
							: "Could not determine admin user. Please ensure you're logged in.";

					toast({
						title: "Error",
						description: errorMsg,
						variant: "destructive",
					});
					console.error(
						"[InvoiceForm] Cannot save and share invoice - adminUserId is null",
						{
							authType,
							employeeSession: localStorage.getItem("employeeSession"),
						}
					);
					setIsSharing(false);
					setIsLoading(false);
					return;
				}

				// Log the user_id being used for debugging
				console.log(
					"[InvoiceForm] Creating invoice (save & share) with user_id:",
					{
						user_id: adminUserId,
						authType: localStorage.getItem("authType"),
						invoiceData: {
							id: invoiceData.id,
							store_id: invoiceData.store_id,
							employee_id: invoiceData.employee_id,
						},
					}
				);

				// Verify the store's admin_user_id matches before insert
				if (invoiceData.store_id) {
					const { data: storeCheck, error: storeCheckError } = await supabase
						.from("stores")
						.select("id, admin_user_id")
						.eq("id", invoiceData.store_id)
						.maybeSingle();

					if (storeCheckError) {
						console.error("[InvoiceForm] Store check error:", storeCheckError);
					} else if (storeCheck) {
						console.log("[InvoiceForm] Store verification:", {
							store_id: storeCheck.id,
							store_admin_user_id: storeCheck.admin_user_id,
							invoice_user_id: adminUserId,
							match: storeCheck.admin_user_id === adminUserId,
						});

						if (storeCheck.admin_user_id !== adminUserId) {
							console.error(
								"[InvoiceForm] MISMATCH! Store admin_user_id doesn't match invoice user_id!"
							);
							toast({
								title: "Error",
								description: "Store configuration error. Please contact admin.",
								variant: "destructive",
							});
							setIsSharing(false);
							setIsLoading(false);
							return;
						}
					}
				}

				// Prepare invoice data with user_id
				const invoiceToInsert = { ...invoiceData, user_id: adminUserId };
				console.log("[InvoiceForm] Invoice data to insert:", {
					id: invoiceToInsert.id,
					user_id: invoiceToInsert.user_id,
					store_id: invoiceToInsert.store_id,
					customer_id: invoiceToInsert.customer_id,
					employee_id: invoiceToInsert.employee_id,
					total_amount: invoiceToInsert.total_amount,
				});

				const { data: newInvoice, error: invoiceError } = await supabase
					.from("invoices")
					.insert(invoiceToInsert)
					.select()
					.single();

				if (invoiceError) {
					console.error("[InvoiceForm] Invoice insert error (regular save):", {
						error: invoiceError,
						message: invoiceError.message,
						code: invoiceError.code,
						details: invoiceError.details,
						hint: invoiceError.hint,
						invoiceData: invoiceToInsert,
					});

					if (
						invoiceError.code === "42501" ||
						invoiceError.message.includes("row-level security")
					) {
						console.error(
							"[InvoiceForm] RLS ERROR (regular save) - Diagnostic Info:",
							{
								user_id_used: adminUserId,
								store_id: invoiceData.store_id,
								employee_id: invoiceData.employee_id,
								authType: localStorage.getItem("authType"),
								employeeSession: localStorage.getItem("employeeSession"),
							}
						);

						// Try to verify the store exists and has correct admin_user_id
						const { data: storeVerify, error: storeVerifyError } =
							await supabase
								.from("stores")
								.select("id, admin_user_id, name")
								.eq("id", invoiceData.store_id)
								.maybeSingle();

						if (storeVerifyError) {
							console.error(
								"[InvoiceForm] Store verification error (regular save):",
								storeVerifyError
							);
						} else if (storeVerify) {
							console.error(
								"[InvoiceForm] Store verification (regular save):",
								{
									store_id: storeVerify.id,
									store_name: storeVerify.name,
									store_admin_user_id: storeVerify.admin_user_id,
									invoice_user_id: adminUserId,
									should_match: storeVerify.admin_user_id === adminUserId,
								}
							);
						} else {
							console.error(
								"[InvoiceForm] Store not found (regular save) for store_id:",
								invoiceData.store_id
							);
						}
					}

					throw invoiceError;
				}

				const itemsWithInvoiceId = items.map((item) => ({
					...item,
					invoice_id: newInvoice.id,
				}));

				const { error: itemsError } = await supabase
					.from("invoice_items")
					.insert(itemsWithInvoiceId);
				if (itemsError) throw itemsError;

				await updateProductStock(
					items,
					isIndexedDb,
					supabase,
					adminUserId,
					initialProducts
				);
				await invalidateInvoices();
				await invalidateProducts();
			}

			// PRIMARY: Supabase Storage WhatsApp share flow
			// Step 1: Prepare invoice document data
			const selectedCustomer = localCustomers.find(
				(c) => c.id === finalCustomerId
			);
			const source = {
				invoice: savedInvoice || invoiceData,
				items,
				customer: selectedCustomer || null,
				profile: settings || null, // Use settings as profile (contains business info)
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
				const {
					data: { user },
				} = await supabase.auth.getUser();
				if (user) userId = user.id;
			}

			if (!userId) {
				throw new Error(
					"Could not determine user ID. Please ensure you're logged in."
				);
			}

			// Step 4: Upload to Supabase Storage
			toast({
				title: "Uploading to Supabase...",
				description: "Uploading PDF to cloud storage",
				duration: 2000,
			});

			const { uploadInvoicePDFToSupabase } = await import(
				"@/lib/utils/invoice-supabase-client"
			);
			const uploadResult = await uploadInvoicePDFToSupabase(
				pdfBlob,
				userId,
				invoiceId,
				(savedInvoice || invoiceData).invoice_number
			);

			if (!uploadResult.success || !uploadResult.publicUrl) {
				const errorMessage =
					uploadResult.error || "Failed to upload PDF to Supabase";
				throw new Error(errorMessage);
			}

			// Step 5: Generate WhatsApp message with Supabase URL
			const { generateWhatsAppBillMessage, shareOnWhatsApp } = await import(
				"@/lib/utils/whatsapp-bill"
			);
			const whatsappMessage = generateWhatsAppBillMessage({
				storeName: pdfData.businessName || storeName,
				invoiceNumber: (savedInvoice || invoiceData).invoice_number,
				invoiceDate: (savedInvoice || invoiceData).invoice_date,
				items: items.map((item) => ({
					name: item.description,
					quantity: item.quantity,
					unitPrice: item.unit_price,
				})),
				totalAmount: (savedInvoice || invoiceData).total_amount,
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
				toast({
					title: "⚠️ WhatsApp Blocked",
					description:
						"Invoice saved, but WhatsApp was blocked. Please allow popups and try sharing again.",
					variant: "destructive",
					duration: 5000,
				});
			} else {
				toast({
					title: "✅ Invoice Created & Shared!",
					description: "WhatsApp opened with invoice details.",
					duration: 3000,
				});
			}

			// CRITICAL: Wait for WhatsApp to open, then redirect after a short delay
			// This ensures WhatsApp opens before navigation interrupts it
			await new Promise((resolve) => setTimeout(resolve, 1500)); // Wait 1.5s for WhatsApp to fully open

			// Now safe to redirect
			router.push("/invoices");
			router.refresh();
		} catch (error) {
			console.error("[InvoiceForm] Error saving and sharing invoice:", error);

			// Get detailed error message with full debugging info
			let errorMessage = "Failed to save and share invoice";
			if (error instanceof Error) {
				errorMessage = error.message;
				console.error("[InvoiceForm] Full error details:", {
					message: error.message,
					stack: error.stack,
					name: error.name,
					error: error,
				});
			} else if (error && typeof error === "object" && "message" in error) {
				errorMessage = String(error.message);
			} else {
				console.error("[InvoiceForm] Non-Error object:", error);
			}

			// Show error toast (Supabase errors are handled by RLS modal if applicable)
			toast({
				title: "Error",
				description:
					errorMessage ||
					"An unexpected error occurred. Please check the console for details.",
				variant: "destructive",
				duration: 5000,
			});

			// If invoice was saved but WhatsApp failed, keep user on page
			// (invoice is already saved at this point)
			// Do NOT redirect - user can try sharing again or navigate manually
		} finally {
			setIsSharing(false);
			setIsLoading(false);
		}
	};

	// DORMANT: R2 retry handler removed
	// const handleRetryR2Upload = () => {
	// 	handleSaveAndShare(new Event("submit") as any);
	// };

	const handleLogoConfigured = (newLogoUrl: string) => {
		setLogoUrl(newLogoUrl);
		localStorage.setItem("business_logo_url", newLogoUrl);
		setShowLogoModal(false);
	};

	return (
		<>
			<LogoConfigModal
				open={showLogoModal}
				onOpenChange={setShowLogoModal}
				onLogoConfigured={handleLogoConfigured}
			/>
			{/* DORMANT: R2 error modal removed - Supabase uses RLS error modal */}
			<RLSErrorModal
				open={showRLSErrorModal}
				onOpenChange={setShowRLSErrorModal}
				errorDetails={rlsErrorDetails || {}}
				onRetry={() => {
					setShowRLSErrorModal(false);
					// Retry customer creation - this will be handled by the form submission
				}}
			/>
			<div
				className={
					isFullscreen
						? "fixed inset-0 z-[100] bg-background overflow-auto"
						: ""
				}
			>
				{isFullscreen && (
					<div className="sticky top-0 z-10 bg-background border-b flex items-center justify-between px-4 py-2">
						<h2 className="text-lg font-semibold">Create New Invoice</h2>
						<Button
							type="button"
							variant="ghost"
							size="icon"
							onClick={() => setIsFullscreen(false)}
							className="h-8 w-8"
							title="Exit fullscreen (ESC)"
						>
							<X className="h-4 w-4" />
						</Button>
					</div>
				)}
				<form
					onSubmit={handleSubmit}
					className={`space-y-2 ${isFullscreen ? "p-4" : "p-2"}`}
				>
					{!isFullscreen && (
						<div className="flex justify-end mb-2">
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => setIsFullscreen(true)}
								className="gap-2"
								title="Maximize invoice form (Fullscreen)"
							>
								<Maximize2 className="h-4 w-4" />
								Maximize
							</Button>
						</div>
					)}
					<div className="relative mb-4 lg:mb-0">
						{/* Invoice Number, Date, and Toggles - Top Right */}
						<div className="relative lg:absolute top-0 right-0 z-10 flex flex-col lg:flex-row items-end lg:items-center gap-2 mb-2 lg:mb-0">
							<div className="flex items-center gap-1.5 bg-background border rounded-md px-1.5 py-1 shadow-sm">
								<div className="flex flex-col">
									<span className="text-[9px] text-muted-foreground leading-tight">
										Invoice #
									</span>
									<Input
										value={invoiceNumber}
										onChange={(e) => setInvoiceNumber(e.target.value)}
										required
										className="h-6 text-[11px] font-semibold w-20 lg:w-24 px-1 py-0"
									/>
								</div>
								<div className="flex flex-col">
									<span className="text-[9px] text-muted-foreground leading-tight">
										Date
									</span>
									<Input
										type="date"
										value={invoiceDate}
										onChange={(e) => setInvoiceDate(e.target.value)}
										required
										className="h-6 text-[11px] w-18 lg:w-20 px-1 py-0"
									/>
								</div>
							</div>
							{/* GST Invoice and Same State toggles */}
							<div className="flex flex-col lg:flex-row items-end lg:items-center gap-1 lg:gap-2 bg-background border rounded-md px-2 py-1 shadow-sm">
								<div className="flex items-center gap-1">
									<Switch
										id="gst_invoice"
										checked={isGstInvoice}
										onCheckedChange={(checked) => {
											// Prevent disabling GST when B2B is enabled
											if (!isB2BEnabled || checked) {
												setIsGstInvoice(checked);
											}
										}}
										disabled={isB2BEnabled}
										className="scale-75"
									/>
									<Label
										htmlFor="gst_invoice"
										className="text-[10px] cursor-pointer leading-tight"
										title={
											isB2BEnabled
												? "GST Invoice is required when B2B mode is enabled"
												: ""
										}
									>
										GST Invoice{" "}
										{isB2BEnabled && (
											<span className="text-destructive">*</span>
										)}
									</Label>
								</div>
								{isGstInvoice && (
									<div className="flex items-center gap-1">
										<Switch
											id="same_state"
											checked={isSameState}
											onCheckedChange={setIsSameState}
											className="scale-75"
										/>
										<Label
											htmlFor="same_state"
											className="text-[10px] cursor-pointer leading-tight"
										>
											Same State
										</Label>
									</div>
								)}
							</div>
						</div>

						<div className="pt-2 lg:pt-12 lg:h-[calc(100vh-180px)] min-h-[600px] lg:flex lg:flex-col">
							

{/* DESKTOP ONLY */}

						<div className="hidden lg:flex flex-1 min-h-0">
							<ResizablePanelGroup
								direction="horizontal"
								className="flex-1 "
							>
								{/* Left side: Customer form and Products (stacked vertically) */}
								<ResizablePanel defaultSize={40} minSize={25} maxSize={60}>
									<ResizablePanelGroup direction="vertical" className="h-full">
										{/* Top: Customer form */}
										<ResizablePanel defaultSize={45} minSize={30} maxSize={70}>
											<div className="h-full space-y-2 pr-2 overflow-y-auto rounded-lg p-2">
												<InlineCustomerForm
													onCustomerCreated={(newCustomer) => {
														console.log(
															"[InvoiceForm] Customer created:",
															newCustomer
														);
														setLocalCustomers((prev) => {
															const nextList = [
																newCustomer,
																...prev.filter((c) => c.id !== newCustomer.id),
															];
															console.log(
																"[InvoiceForm] Updated customer list:",
																nextList.length
															);
															return nextList;
														});
														setTimeout(() => {
															console.log(
																"[InvoiceForm] Setting customer ID:",
																newCustomer.id
															);
															setCustomerId(newCustomer.id);
														}, 50);
														const nextList = [
															newCustomer,
															...localCustomers.filter(
																(c) => c.id !== newCustomer.id
															),
														];
														onCustomersUpdate?.(nextList);
													}}
													onCustomerDataChange={(data) => {
														setCustomerData({
															name: data.name,
															phone: data.phone,
															email: data.email,
															gstin: data.gstin || "",
															billing_address: data.billing_address || "",
															city: data.city || "",
															state: data.state || "",
															pincode: data.pincode || "",
															isNewCustomer: data.isNewCustomer,
														});
														if (data.isNewCustomer) {
															setCustomerId("");
														}
													}}
												/>
											</div>
										</ResizablePanel>

										<ResizableHandle withHandle />

										{/* Bottom: Products (limited to 1-2 rows) */}
										<ResizablePanel defaultSize={55} minSize={30} maxSize={70}>
											<div className="h-full pr-2">
												<Card className="h-full flex flex-col">
													<CardHeader className="pb-0.5 pt-1 px-4 flex-shrink-0 mt-[-1vh]">
														<CardTitle className="text-xs leading-tight">
															Select Products
														</CardTitle>
														<p className="text-[9px] text-muted-foreground leading-tight mt-0">
															Search or tap to add items instantly
														</p>
													</CardHeader>
													<CardContent className="space-y-1 p-1.5 flex-1 flex flex-col overflow-hidden mt-[-2vh]">
														<div className="relative flex-shrink-0">
															<Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
															<Input
																placeholder="Search name, SKU, or category"
																value={productSearchTerm}
																onChange={(e) =>
																	setProductSearchTerm(e.target.value)
																}
																className="pl-7 h-7 text-xs"
															/>
														</div>

														{recentProducts.length > 0 &&
															!productSearchTerm && (
																<div className="flex-shrink-0">
																	<div className="flex items-center justify-between text-[9px] text-muted-foreground mb-0.5">
																		<span>Recently added</span>
																		<span>{recentProducts.length} items</span>
																	</div>
																	<div
	className={`grid gap-1 max-h-[70px] overflow-y-auto ${
		isRealMobile ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2"
	}`}
>

																		{recentProducts.map((product) => (
																			<button
																				key={product.id}
																				type="button"
																				onClick={() =>
																					addProductToInvoice(product)
																				}
																				className="rounded-md border px-1.5 py-1 text-left text-[9px] hover:bg-primary/10 focus-visible:outline focus-visible:ring-2 focus-visible:ring-primary bg-white dark:bg-slate-800"
																			>
																				<p className="font-medium truncate text-[10px] leading-tight">
																					{product.name}
																				</p>
																				<div className="flex items-center justify-between text-[9px] text-muted-foreground mt-0.5">
																					<Tooltip>
																						<TooltipTrigger asChild>
																							<span className="truncate block max-w-[65px] cursor-help">
																								₹
																								{product.price.toLocaleString()}
																							</span>
																						</TooltipTrigger>
																						<TooltipContent>
																							Price: ₹
																							{product.price.toLocaleString(
																								"en-IN",
																								{
																									minimumFractionDigits: 2,
																									maximumFractionDigits: 2,
																								}
																							)}
																						</TooltipContent>
																					</Tooltip>
																					{product.unit && (
																						<span className="text-[8px]">
																							{product.unit}
																						</span>
																					)}
																				</div>
																			</button>
																		))}
																	</div>
																</div>
															)}

														<div className="space-y-0.5 flex-1 flex flex-col overflow-hidden min-h-0">
															<div className="flex items-center justify-between text-[9px] text-muted-foreground flex-shrink-0 px-0.5">
																<span>
																	{productSearchTerm
																		? "Matching products"
																		: "All products (A-Z)"}
																</span>
																<span>{filteredProducts.length} items</span>
															</div>
															<div className="flex-1 overflow-y-auto pr-0.5 min-h-0">
																{filteredProducts.length === 0 ? (
																	<div className="py-3 text-center text-[9px] text-muted-foreground">
																		{productSearchTerm
																			? "No products found"
																			: "No products available"}
																	</div>
																) : (
																	<div
	className={`grid gap-1 h-full ${
		isRealMobile ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2"
	}`}
>

																		{filteredProducts.map((product) => (
																			<button
																				key={product.id}
																				type="button"
																				onClick={() =>
																					addProductToInvoice(product)
																				}
																				className="rounded-md border px-1.5 py-1 text-left hover:bg-primary/10 focus-visible:outline focus-visible:ring-2 focus-visible:ring-primary bg-white dark:bg-slate-800 flex flex-col justify-between"
																			>
																				<p className="text-[10px] font-medium truncate leading-tight">
																					{product.name}
																				</p>
																				<div className="mt-0.5 text-[9px] text-muted-foreground space-y-0.5">
																					<div className="flex items-center justify-between">
																						<Tooltip>
																							<TooltipTrigger asChild>
																								<span className="truncate block max-w-[45px] cursor-help">
																									₹
																									{product.price.toLocaleString()}
																								</span>
																							</TooltipTrigger>
																							<TooltipContent>
																								Price: ₹
																								{product.price.toLocaleString(
																									"en-IN",
																									{
																										minimumFractionDigits: 2,
																										maximumFractionDigits: 2,
																									}
																								)}
																							</TooltipContent>
																						</Tooltip>
																						{product.category && (
																							<span className="truncate max-w-[55px] text-[8px]">
																								{product.category}
																							</span>
																						)}
																					</div>
																					{product.stock_quantity !==
																						undefined && (
																						<Badge
																							variant={
																								product.stock_quantity > 10
																									? "default"
																									: product.stock_quantity > 0
																									? "secondary"
																									: "destructive"
																							}
																							className="text-[8px] font-normal h-3 px-0.5 leading-tight"
																						>
																							{product.unit === "piece"
																								? `${Math.round(
																										product.stock_quantity
																								  )} ${product.unit}`
																								: `${Number(
																										product.stock_quantity
																								  ).toLocaleString("en-IN")} ${
																										product.unit
																								  }`}
																						</Badge>
																					)}
																				</div>
																			</button>
																		))}
																	</div>
																)}
															</div>
														</div>
													</CardContent>
												</Card>
											</div>
										</ResizablePanel>
									</ResizablePanelGroup>
								</ResizablePanel>

								<ResizableHandle withHandle />

								{/* Right side: Invoice Items */}
								<ResizablePanel defaultSize={60} minSize={40} maxSize={75}>
									<div className="h-full space-y-2 pl-2 overflow-y-auto rounded-lg p-2">
										<Card className="h-full">
											<CardHeader className="pb-1 pt-2 px-3">
												<CardTitle className="text-sm">Invoice Items</CardTitle>
											</CardHeader>
											<CardContent className="space-y-1 p-2">
												{lineItems.length === 0 && (
													<div className="text-center py-6 space-y-2">
														<p className="text-xs text-muted-foreground">
															No items added
														</p>
														<Button
															type="button"
															variant="outline"
															size="sm"
															onClick={addLineItem}
															className="text-xs h-7"
														>
															<Plus className="h-3 w-3 mr-1" />
															Add Item
														</Button>
													</div>
												)}
												{lineItems.length > 0 && (
													<div className="rounded-md border">
														<div className="max-h-[380px] overflow-y-auto">
															<Table className="text-xs">
																<TableHeader className="bg-muted/30 sticky top-0 z-10">
																	<TableRow className="h-9">
																		<TableHead className="w-[120px] px-2 py-2 text-xs font-semibold">
																			Product
																		</TableHead>
																		<TableHead className="w-[75px] text-center px-1.5 py-2 text-xs font-semibold">
																			Qty
																		</TableHead>
																		<TableHead className="w-[80px] text-center px-1.5 py-2 text-xs font-semibold">
																			Unit
																		</TableHead>
																		<TableHead className="w-[90px] text-center px-1.5 py-2 text-xs font-semibold">
																			Rate
																		</TableHead>
																		<TableHead className="w-[75px] text-center px-1.5 py-2 text-xs font-semibold">
																			Disc%
																		</TableHead>
																		{isGstInvoice && (
																			<TableHead className="w-[70px] text-center px-1.5 py-2 text-xs font-semibold">
																				GST
																			</TableHead>
																		)}
																		<TableHead className="w-[100px] text-right px-2 py-2 text-xs font-semibold">
																			Amount
																		</TableHead>
																		<TableHead className="w-[40px] px-1 py-2"></TableHead>
																	</TableRow>
																</TableHeader>
																<TableBody>
																	{lineItems.map((item) => {
																		const calc = calculateLineItem({
																			unitPrice: item.unit_price,
																			discountPercent: item.discount_percent,
																			gstRate: item.gst_rate,
																			quantity: item.quantity,
																		});
																		return (
																			<TableRow key={item.id} className="h-12">
																				<TableCell className="px-2 py-1.5">
																					{!item.product_id ? (
																						<Input
																							value={item.description || ""}
																							onChange={(e) =>
																								updateLineItem(
																									item.id,
																									"description",
																									e.target.value
																								)
																							}
																							placeholder="Enter description"
																							className="h-8 text-xs px-2"
																						/>
																					) : (
																						<Select
																							value={item.product_id || ""}
																							onValueChange={(value) => {
																								updateLineItem(
																									item.id,
																									"product_id",
																									value
																								);
																								// Auto-add new line item if this is the last row and a product is selected
																								if (
																									lineItems.length > 0 &&
																									lineItems[
																										lineItems.length - 1
																									].id === item.id &&
																									value
																								) {
																									setTimeout(() => {
																										addLineItem();
																									}, 100);
																								}
																							}}
																						>
																							<SelectTrigger className="h-8 text-xs px-2">
																								<SelectValue placeholder="Select Product" />
																							</SelectTrigger>
																							<SelectContent className="max-h-60">
																								{products.map((product) => (
																									<SelectItem
																										key={product.id}
																										value={product.id}
																									>
																										{product.name}
																									</SelectItem>
																								))}
																							</SelectContent>
																						</Select>
																					)}
																				</TableCell>
																				{(() => {
																					const fieldId = `${item.id}-qty`;
																					const qtyFocused =
																						focusedField === fieldId;
																					const rateFieldId = `${item.id}-rate`;
																					const rateFocused =
																						focusedField === rateFieldId;
																					const discFieldId = `${item.id}-disc`;
																					const discFocused =
																						focusedField === discFieldId;
																					const gstFieldId = `${item.id}-gst`;
																					const gstFocused =
																						focusedField === gstFieldId;

																					return (
																						<>
																							<TableCell
																								className={`px-1.5 py-1 transition-all duration-300 ${
																									qtyFocused
																										? "w-[110px]"
																										: "w-[75px]"
																								}`}
																							>
																								<div className="flex flex-col">
																									<Input
																										type="number"
																										min="0"
																										step="1"
																										value={item.quantity || ""}
																										onChange={(e) =>
																											updateLineItem(
																												item.id,
																												"quantity",
																												Number.parseInt(
																													e.target.value
																												) || 0
																											)
																										}
																										onFocus={() =>
																											setFocusedField(fieldId)
																										}
																										onBlur={() =>
																											setFocusedField(null)
																										}
																										onMouseEnter={() =>
																											setFocusedField(fieldId)
																										}
																										onMouseLeave={() => {
																											const activeEl =
																												document.activeElement as HTMLElement;
																											if (
																												activeEl?.dataset
																													?.fieldId !== fieldId
																											) {
																												setFocusedField(null);
																											}
																										}}
																										data-field-id={fieldId}
																										required
																										className={`h-9 text-sm text-center font-semibold transition-all duration-300 ${
																											qtyFocused
																												? "px-3 bg-primary/5 border-primary/50 shadow-sm"
																												: "px-1.5"
																										}`}
																									/>
																									<div className="text-[10px] text-muted-foreground text-center mt-0.5 h-3">
																										{item.quantity
																											? item.quantity
																											: ""}
																									</div>
																								</div>
																							</TableCell>
																							<TableCell className="px-1.5 py-1.5">
																								<Select
																									value={item.selling_unit || ""}
																									onValueChange={(value) =>
																										updateLineItem(
																											item.id,
																											"selling_unit",
																											value === "" ? null : value
																										)
																									}
																								>
																									<SelectTrigger className="h-7 text-xs">
																										<SelectValue placeholder="Unit" />
																									</SelectTrigger>
																									<SelectContent>
																										<SelectItem value="">None</SelectItem>
																										<SelectItem value="loose">Loose</SelectItem>
																										<SelectItem value="together">Together</SelectItem>
																									</SelectContent>
																								</Select>
																							</TableCell>
																							<TableCell
																								className={`px-1.5 py-1 transition-all duration-300 ${
																									rateFocused
																										? "w-[120px]"
																										: "w-[90px]"
																								}`}
																							>
																								<div className="flex flex-col">
																									<Input
																										type="number"
																										min="0"
																										step="0.01"
																										value={
																											item.unit_price || ""
																										}
																										onChange={(e) =>
																											updateLineItem(
																												item.id,
																												"unit_price",
																												Number.parseFloat(
																													e.target.value
																												) || 0
																											)
																										}
																										onFocus={() =>
																											setFocusedField(
																												rateFieldId
																											)
																										}
																										onBlur={() =>
																											setFocusedField(null)
																										}
																										onMouseEnter={() =>
																											setFocusedField(
																												rateFieldId
																											)
																										}
																										onMouseLeave={() => {
																											const activeEl =
																												document.activeElement as HTMLElement;
																											if (
																												activeEl?.dataset
																													?.fieldId !==
																												rateFieldId
																											) {
																												setFocusedField(null);
																											}
																										}}
																										data-field-id={rateFieldId}
																										required
																										className={`h-9 text-sm text-center font-semibold transition-all duration-300 ${
																											rateFocused
																												? "px-3 bg-primary/5 border-primary/50 shadow-sm"
																												: "px-1.5"
																										}`}
																									/>
																									<div className="text-[10px] text-muted-foreground text-center mt-0.5 h-3">
																										{item.unit_price
																											? `₹${item.unit_price.toFixed(
																													2
																											  )}`
																											: ""}
																									</div>
																								</div>
																							</TableCell>
																							<TableCell
																								className={`px-1.5 py-1 transition-all duration-300 ${
																									discFocused
																										? "w-[110px]"
																										: "w-[75px]"
																								}`}
																							>
																								<div className="flex flex-col">
																									<Input
																										type="number"
																										min="0"
																										max="100"
																										step="0.01"
																										value={
																											item.discount_percent ||
																											""
																										}
																										onChange={(e) =>
																											updateLineItem(
																												item.id,
																												"discount_percent",
																												Number.parseFloat(
																													e.target.value
																												) || 0
																											)
																										}
																										onFocus={() =>
																											setFocusedField(
																												discFieldId
																											)
																										}
																										onBlur={() =>
																											setFocusedField(null)
																										}
																										onMouseEnter={() =>
																											setFocusedField(
																												discFieldId
																											)
																										}
																										onMouseLeave={() => {
																											const activeEl =
																												document.activeElement as HTMLElement;
																											if (
																												activeEl?.dataset
																													?.fieldId !==
																												discFieldId
																											) {
																												setFocusedField(null);
																											}
																										}}
																										data-field-id={discFieldId}
																										className={`h-9 text-sm text-center font-semibold transition-all duration-300 ${
																											discFocused
																												? "px-3 bg-primary/5 border-primary/50 shadow-sm"
																												: "px-1.5"
																										}`}
																									/>
																									<div className="text-[10px] text-muted-foreground text-center mt-0.5 h-3">
																										{item.discount_percent
																											? `${item.discount_percent}%`
																											: ""}
																									</div>
																								</div>
																							</TableCell>
																							{isGstInvoice && (
																								<TableCell
																									className={`px-1.5 py-1 transition-all duration-300 ${
																										gstFocused
																											? "w-[100px]"
																											: "w-[70px]"
																									}`}
																								>
																									<div className="flex flex-col">
																										<Input
																											type="number"
																											min="0"
																											step="0.01"
																											value={
																												item.gst_rate || ""
																											}
																											onChange={(e) =>
																												updateLineItem(
																													item.id,
																													"gst_rate",
																													Number.parseFloat(
																														e.target.value
																													) || 0
																												)
																											}
																											onFocus={() =>
																												setFocusedField(
																													gstFieldId
																												)
																											}
																											onBlur={() =>
																												setFocusedField(null)
																											}
																											onMouseEnter={() =>
																												setFocusedField(
																													gstFieldId
																												)
																											}
																											onMouseLeave={() => {
																												const activeEl =
																													document.activeElement as HTMLElement;
																												if (
																													activeEl?.dataset
																														?.fieldId !==
																													gstFieldId
																												) {
																													setFocusedField(null);
																												}
																											}}
																											data-field-id={gstFieldId}
																											className={`h-9 text-sm text-center font-semibold transition-all duration-300 ${
																												gstFocused
																													? "px-3 bg-primary/5 border-primary/50 shadow-sm"
																													: "px-1.5"
																											}`}
																										/>
																										<div className="text-[10px] text-muted-foreground text-center mt-0.5 h-3">
																											{item.gst_rate
																												? `${item.gst_rate}%`
																												: ""}
																										</div>
																									</div>
																								</TableCell>
																							)}
																						</>
																					);
																				})()}
																				<TableCell className="text-right font-bold text-sm px-2 py-1.5">
																					₹{calc.lineTotal.toFixed(2)}
																				</TableCell>
																				<TableCell className="px-1 py-1.5">
																					<Button
																						type="button"
																						variant="ghost"
																						size="icon"
																						onClick={() =>
																							removeLineItem(item.id)
																						}
																						className="h-7 w-7"
																					>
																						<Trash2 className="h-3.5 w-3.5" />
																					</Button>
																				</TableCell>
																			</TableRow>
																		);
																	})}
																</TableBody>
															</Table>
														</div>
													</div>
												)}
											</CardContent>
										</Card>

										<Card>
											<CardContent className="space-y-1.5 p-3 text-xs">
												<div className="flex justify-between">
													<span>Subtotal</span>
													<span className="font-medium">
														₹{totals.subtotal.toFixed(2)}
													</span>
												</div>
												{isGstInvoice && (
													<>
														{isSameState ? (
															<>
																<div className="flex justify-between text-xs text-muted-foreground">
																	<span>CGST</span>
																	<span>₹{totals.cgst.toFixed(2)}</span>
																</div>
																<div className="flex justify-between text-xs text-muted-foreground">
																	<span>SGST</span>
																	<span>₹{totals.sgst.toFixed(2)}</span>
																</div>
															</>
														) : (
															<div className="flex justify-between text-xs text-muted-foreground">
																<span>IGST</span>
																<span>₹{totals.igst.toFixed(2)}</span>
															</div>
														)}
													</>
												)}
												<div className="flex justify-between border-t pt-2 text-sm font-semibold">
													<span>Total</span>
													<span>₹{totals.total.toFixed(2)}</span>
												</div>
											</CardContent>
										</Card>

										<div className="flex flex-col gap-2">
											<Button
												type="button"
												onClick={handleSaveAndShare}
												disabled={isLoading || isSharing || !navigator.onLine}
												className="gap-2"
											>
												<MessageCircle className="h-4 w-4" />
												{isSharing
													? "Saving & Sharing..."
													: "Save & Share on WhatsApp"}
											</Button>
											<Button type="submit" disabled={isLoading || isSharing}>
												{isLoading ? "Creating..." : "Create Invoice"}
											</Button>
											<Button
												type="button"
												variant="outline"
												onClick={() => router.back()}
												disabled={isLoading || isSharing}
											>
												Cancel
											</Button>
										</div>
									</div>
								</ResizablePanel>
							</ResizablePanelGroup>
							</div>
							{/* Mobile Layout: Stack vertically */}
							<div className="flex lg:hidden flex-col space-y-4 min-h-[600px] overflow-y-auto pb-4">
								{/* Customer form */}
								<div className="space-y-2">
									<InlineCustomerForm
										onCustomerCreated={(newCustomer) => {
											console.log(
												"[InvoiceForm] Customer created:",
												newCustomer
											);
											setLocalCustomers((prev) => {
												const nextList = [
													newCustomer,
													...prev.filter((c) => c.id !== newCustomer.id),
												];
												console.log(
													"[InvoiceForm] Updated customer list:",
													nextList.length
												);
												return nextList;
											});
											setTimeout(() => {
												console.log(
													"[InvoiceForm] Setting customer ID:",
													newCustomer.id
												);
												setCustomerId(newCustomer.id);
											}, 50);
											const nextList = [
												newCustomer,
												...localCustomers.filter(
													(c) => c.id !== newCustomer.id
												),
											];
											onCustomersUpdate?.(nextList);
										}}
										onCustomerDataChange={(data) => {
											setCustomerData({
												name: data.name,
												phone: data.phone,
												email: data.email,
												gstin: data.gstin || "",
												billing_address: data.billing_address || "",
												city: data.city || "",
												state: data.state || "",
												pincode: data.pincode || "",
												isNewCustomer: data.isNewCustomer,
											});
											if (data.isNewCustomer) {
												setCustomerId("");
											}
										}}
									/>
								</div>

								{/* Products */}
								<Card className="flex flex-col">
									<CardHeader className="pb-0.5 pt-1 px-4 flex-shrink-0">
										<CardTitle className="text-xs leading-tight">
											Select Products
										</CardTitle>
										<p className="text-[9px] text-muted-foreground leading-tight mt-0">
											Search or tap to add items instantly
										</p>
									</CardHeader>
									<CardContent className="space-y-1 p-1.5 flex-1 flex flex-col overflow-hidden">
										<div className="relative flex-shrink-0">
											<Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
											<Input
												placeholder="Search name, SKU, or category"
												value={productSearchTerm}
												onChange={(e) => setProductSearchTerm(e.target.value)}
												className="pl-7 h-7 text-xs"
											/>
										</div>

										{recentProducts.length > 0 && !productSearchTerm && (
											<div className="flex-shrink-0">
												<div className="flex items-center justify-between text-[9px] text-muted-foreground mb-0.5">
													<span>Recently added</span>
													<span>{recentProducts.length} items</span>
												</div>
												<div className="grid grid-cols-1 gap-1 max-h-[70px] overflow-y-auto">
													{recentProducts.map((product) => (
														<button
															key={product.id}
															type="button"
															onClick={() => addProductToInvoice(product)}
															className="rounded-md border px-1.5 py-1 text-left text-[9px] hover:bg-primary/10 focus-visible:outline focus-visible:ring-2 focus-visible:ring-primary bg-white dark:bg-slate-800"
														>
															<p className="font-medium truncate text-[10px] leading-tight">
																{product.name}
															</p>
															<div className="flex items-center justify-between text-[9px] text-muted-foreground mt-0.5">
																<span>₹{product.price.toLocaleString()}</span>
																{product.category && (
																	<span className="truncate max-w-[55px] text-[8px]">
																		{product.category}
																	</span>
																)}
															</div>
														</button>
													))}
												</div>
											</div>
										)}

										<div className="space-y-0.5 flex-1 flex flex-col overflow-hidden min-h-0">
											<div className="flex items-center justify-between text-[9px] text-muted-foreground flex-shrink-0 px-0.5">
												<span>
													{productSearchTerm
														? `Search results (${filteredProducts.length})`
														: `All products (${filteredProducts.length})`}
												</span>
											</div>
											<div className="flex-1 overflow-y-auto pr-0.5 min-h-0">
												{filteredProducts.length === 0 ? (
													<div className="py-3 text-center text-[9px] text-muted-foreground">
														{productSearchTerm
															? "No products found"
															: "No products available"}
													</div>
												) : (
													<div className="grid grid-cols-1 gap-1 h-full">
														{filteredProducts.map((product) => (
															<button
																key={product.id}
																type="button"
																onClick={() => addProductToInvoice(product)}
																className="rounded-md border px-1.5 py-1 text-left hover:bg-primary/10 focus-visible:outline focus-visible:ring-2 focus-visible:ring-primary bg-white dark:bg-slate-800 flex flex-col justify-between"
															>
																<p className="text-[10px] font-medium truncate leading-tight">
																	{product.name}
																</p>
																<div className="mt-0.5 text-[9px] text-muted-foreground space-y-0.5">
																	<div className="flex items-center justify-between">
																		<Tooltip>
																			<TooltipTrigger asChild>
																				<span className="truncate block max-w-[45px] cursor-help">
																					₹{product.price.toLocaleString()}
																				</span>
																			</TooltipTrigger>
																			<TooltipContent>
																				Price: ₹
																				{product.price.toLocaleString("en-IN", {
																					minimumFractionDigits: 2,
																					maximumFractionDigits: 2,
																				})}
																			</TooltipContent>
																		</Tooltip>
																		{product.category && (
																			<span className="truncate max-w-[55px] text-[8px]">
																				{product.category}
																			</span>
																		)}
																	</div>
																	{product.stock_quantity !== undefined && (
																		<Badge
																			variant={
																				product.stock_quantity > 10
																					? "default"
																					: product.stock_quantity > 0
																					? "secondary"
																					: "destructive"
																			}
																			className="text-[8px] font-normal h-3 px-0.5 leading-tight"
																		>
																			{product.unit === "piece"
																				? `${Math.round(
																						product.stock_quantity
																				  )} ${product.unit}`
																				: `${Number(
																						product.stock_quantity
																				  ).toLocaleString("en-IN")} ${
																						product.unit
																				  }`}
																		</Badge>
																	)}
																</div>
															</button>
														))}
													</div>
												)}
											</div>
										</div>
									</CardContent>
								</Card>

								{/* Invoice Items */}
								<Card className="h-full">
									<CardHeader className="pb-1 pt-2 px-3">
										<CardTitle className="text-sm">Invoice Items</CardTitle>
									</CardHeader>
									<CardContent className="space-y-1 p-2">
										{lineItems.length === 0 && (
											<div className="text-center py-6 space-y-2">
												<p className="text-xs text-muted-foreground">
													No items added
												</p>
												<Button
													type="button"
													variant="outline"
													size="sm"
													onClick={addLineItem}
													className="text-xs h-7"
												>
													<Plus className="h-3 w-3 mr-1" />
													Add Item
												</Button>
											</div>
										)}
										{lineItems.length > 0 && (
											<div className="rounded-md border">
												<div className="max-h-[380px] overflow-x-auto">
													<Table className="text-xs">
														<TableHeader className="bg-muted/30 sticky top-0 z-10">
															<TableRow className="h-9">
																<TableHead className="w-[120px] px-2 py-2 text-xs font-semibold">
																	Product
																</TableHead>
																<TableHead className="w-[75px] text-center px-1.5 py-2 text-xs font-semibold">
																	Qty
																</TableHead>
																<TableHead className="w-[80px] text-center px-1.5 py-2 text-xs font-semibold">
																	Unit
																</TableHead>
																<TableHead className="w-[90px] text-center px-1.5 py-2 text-xs font-semibold">
																	Rate
																</TableHead>
																<TableHead className="w-[75px] text-center px-1.5 py-2 text-xs font-semibold">
																	Disc%
																</TableHead>
																{isGstInvoice && (
																	<TableHead className="w-[70px] text-center px-1.5 py-2 text-xs font-semibold">
																		GST
																	</TableHead>
																)}
																<TableHead className="w-[100px] text-right px-2 py-2 text-xs font-semibold">
																	Amount
																</TableHead>
																<TableHead className="w-[40px] px-1 py-2"></TableHead>
															</TableRow>
														</TableHeader>
														<TableBody>
															{lineItems.map((item) => {
																const calc = calculateLineItem({
																	unitPrice: item.unit_price,
																	discountPercent: item.discount_percent,
																	gstRate: item.gst_rate,
																	quantity: item.quantity,
																});
																return (
																	<TableRow key={item.id} className="h-12">
																		<TableCell className="px-2 py-1.5">
																			{!item.product_id ? (
																				<Input
																					value={item.description || ""}
																					onChange={(e) =>
																						updateLineItem(
																							item.id,
																							"description",
																							e.target.value
																						)
																					}
																					placeholder="Description"
																					className="h-7 text-xs"
																				/>
																			) : (
																				<div className="text-xs font-medium">
																					{item.description || "N/A"}
																				</div>
																			)}
																		</TableCell>
																		<TableCell className="px-1.5 py-1.5">
																			<Input
																				type="number"
																				value={item.quantity || ""}
																				onChange={(e) => {
																					const val = parseFloat(
																						e.target.value
																					);
																					if (!isNaN(val) && val >= 0) {
																						updateLineItem(
																							item.id,
																							"quantity",
																							val
																						);
																					} else if (e.target.value === "") {
																						updateLineItem(
																							item.id,
																							"quantity",
																							0
																						);
																					}
																				}}
																				className="h-7 text-xs text-center"
																				min="0"
																				step="0.01"
																			/>
																		</TableCell>
																		<TableCell className="px-1.5 py-1.5">
																			<Select
																				value={item.selling_unit || ""}
																				onValueChange={(value) =>
																					updateLineItem(
																						item.id,
																						"selling_unit",
																						value === "" ? null : value
																					)
																				}
																			>
																				<SelectTrigger className="h-7 text-xs">
																					<SelectValue placeholder="Unit" />
																				</SelectTrigger>
																				<SelectContent>
																					<SelectItem value="">None</SelectItem>
																					<SelectItem value="loose">Loose</SelectItem>
																					<SelectItem value="together">Together</SelectItem>
																				</SelectContent>
																			</Select>
																		</TableCell>
																		<TableCell className="px-1.5 py-1.5">
																			<Input
																				type="number"
																				value={item.unit_price || ""}
																				onChange={(e) => {
																					const val = parseFloat(
																						e.target.value
																					);
																					if (!isNaN(val) && val >= 0) {
																						updateLineItem(
																							item.id,
																							"unit_price",
																							val
																						);
																					} else if (e.target.value === "") {
																						updateLineItem(
																							item.id,
																							"unit_price",
																							0
																						);
																					}
																				}}
																				className="h-7 text-xs text-center"
																				min="0"
																				step="0.01"
																			/>
																		</TableCell>
																		<TableCell className="px-1.5 py-1.5">
																			<Input
																				type="number"
																				value={item.discount_percent || ""}
																				onChange={(e) => {
																					const val = parseFloat(
																						e.target.value
																					);
																					if (
																						!isNaN(val) &&
																						val >= 0 &&
																						val <= 100
																					) {
																						updateLineItem(
																							item.id,
																							"discount_percent",
																							val
																						);
																					} else if (e.target.value === "") {
																						updateLineItem(
																							item.id,
																							"discount_percent",
																							0
																						);
																					}
																				}}
																				className="h-7 text-xs text-center"
																				min="0"
																				max="100"
																				step="0.01"
																			/>
																		</TableCell>
																		{isGstInvoice && (
																			<TableCell className="px-1.5 py-1.5">
																				<Select
																					value={String(item.gst_rate || 0)}
																					onValueChange={(value) => {
																						const numValue = parseFloat(value);
																						if (!isNaN(numValue) && numValue >= 0 && numValue <= 100) {
																							updateLineItem(
																								item.id,
																								"gst_rate",
																								numValue
																							);
																						}
																					}}
																				>
																					<SelectTrigger className="h-7 text-xs">
																						<SelectValue placeholder="Select GST %" />
																					</SelectTrigger>
																					<SelectContent>
																						<SelectItem value="0">
																							0%
																						</SelectItem>
																						<SelectItem value="5">
																							5%
																						</SelectItem>
																						<SelectItem value="12">
																							12%
																						</SelectItem>
																						<SelectItem value="18">
																							18%
																						</SelectItem>
																						<SelectItem value="28">
																							28%
																						</SelectItem>
																					</SelectContent>
																				</Select>
																			</TableCell>
																		)}
																		<TableCell className="px-2 py-1.5 text-right text-xs font-medium">
																			₹
																			{roundToTwo(
																				calc.lineTotal
																			).toLocaleString("en-IN")}
																		</TableCell>
																		<TableCell className="px-1 py-1.5">
																			<Button
																				type="button"
																				variant="ghost"
																				size="icon"
																				onClick={() => removeLineItem(item.id)}
																				className="h-6 w-6"
																			>
																				<Trash2 className="h-3 w-3" />
																			</Button>
																		</TableCell>
																	</TableRow>
																);
															})}
														</TableBody>
													</Table>
												</div>
											</div>
										)}
									</CardContent>
								</Card>

								{/* Totals */}
								<Card>
									<CardContent className="space-y-1.5 p-3 text-xs">
										<div className="flex justify-between">
											<span>Subtotal</span>
											<span className="font-medium">
												₹{totals.subtotal.toFixed(2)}
											</span>
										</div>
										{isGstInvoice && (
											<>
												{isSameState ? (
													<>
														<div className="flex justify-between text-xs text-muted-foreground">
															<span>CGST</span>
															<span>₹{totals.cgst.toFixed(2)}</span>
														</div>
														<div className="flex justify-between text-xs text-muted-foreground">
															<span>SGST</span>
															<span>₹{totals.sgst.toFixed(2)}</span>
														</div>
													</>
												) : (
													<div className="flex justify-between text-xs text-muted-foreground">
														<span>IGST</span>
														<span>₹{totals.igst.toFixed(2)}</span>
													</div>
												)}
											</>
										)}
										<div className="flex justify-between border-t pt-2 text-sm font-semibold">
											<span>Total</span>
											<span>₹{totals.total.toFixed(2)}</span>
										</div>
									</CardContent>
								</Card>

								{/* Action Buttons */}
								<div className="flex flex-col gap-2 pb-4">
									<Button
										type="button"
										onClick={handleSaveAndShare}
										disabled={isLoading || isSharing || !navigator.onLine}
										className="gap-2"
									>
										<MessageCircle className="h-4 w-4" />
										{isSharing
											? "Saving & Sharing..."
											: "Save & Share on WhatsApp"}
									</Button>
									<Button type="submit" disabled={isLoading || isSharing}>
										{isLoading ? "Creating..." : "Create Invoice"}
									</Button>
									<Button
										type="button"
										variant="outline"
										onClick={() => router.back()}
										disabled={isLoading || isSharing}
									>
										Cancel
									</Button>
								</div>
							</div>
						</div>
					</div>
				</form>
			</div>
		</>
	);
}
