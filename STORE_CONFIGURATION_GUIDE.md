# Store Configuration Guide - SURYODAY E VEHICLE SALES CENTRE

## 📋 Overview
This guide will help you configure the billing system for **SURYODAY E VEHICLE SALES CENTRE** based on the physical invoice format shown.

## ✅ Current Schema Compatibility

**Good News:** Your current invoice schema (`lib/dexie-client.ts`) is **already compatible** with this invoice format! No schema changes needed.

### What Already Works:
- ✅ **InvoiceItem** supports `product_id?: string | null` - allows charges without products
- ✅ **Description** field supports multi-line product descriptions
- ✅ **HSN Code** field (`hsn_code`) is present and optional
- ✅ **GST Rate** field (`gst_rate`) is present
- ✅ **Quantity, Unit Price, Line Total** - all supported
- ✅ **Notes & Terms** on Invoice - for storing terms and conditions

### What's Missing (Optional):
- ⚠️ **Bank Details** - Not in current schema, but can be added to `business_settings` or `Store` if needed

---

## 🛠️ Step-by-Step Configuration

### Step 1: Create/Configure Store

1. Go to **Settings → Store Settings**
2. Fill in:
   - **Store Name:** `SURYODAY E VEHICLE SALES CENTRE`
   - **Address:** `Suryoday Tower, Sai Shyam Nagar, Lohari Road, Akot, Dist-Akola, MH, 444101`
   - **GSTIN:** `27AXDPT7202M1Z3`
   - **Phone:** `9850913448`

### Step 2: Configure Business Settings

1. Go to **Settings → Business Settings**
2. Fill in:
   - **Business Name:** `SURYODAY E VEHICLE SALES CENTRE`
   - **Proprietor Name:** `Pratapsingh Thakur` (add to business name or notes)
   - **Business GSTIN:** `27AXDPT7202M1Z3`
   - **Business Address:** `Suryoday Tower, Sai Shyam Nagar, Lohari Road, Akot, Dist-Akola, MH, 444101`
   - **Business Phone:** `9850913448`
   - **Business Email:** `Kunwarsaa97@gmail.com`
   - **Default GST Rate:** `5` (change from 18 to 5)
   - **Invoice Prefix:** `INV` (or customize)
   - **Terms & Conditions:** 
     ```
     Note - No Returns or Exchanges.
     Warranty as per manufacturer's T&Cs.
     ```

### Step 3: Add Bank Details (Manual - Store in Notes or Business Settings)

Since bank details aren't in the schema, you can:
- **Option A:** Store in Business Settings → Notes section
- **Option B:** Add manually to each invoice in the Notes field
- **Option C:** We can add bank fields to schema if you prefer

**Bank Details to Store:**
- **Bank:** State Bank of India, Branch Akot
- **Account Name:** Suryoday E Vehicle Sales Centre
- **Account Number:** 44561715297
- **IFSC:** SBIN0000307

### Step 4: Add 3 Products

Go to **Products → Add Product** and create these 3 products:

#### Product 1: Krishna E-Rickshaw (SS)
- **Name:** `Krishna E-Rickshaw (SS)`
- **Description:** `Stainless Steel Type Model: Battery Operated for Passengers`
- **SKU:** (optional) `KRISHNA-ERICK-SS`
- **Category:** `Electric Vehicles` or `E-Rickshaw`
- **Price:** `200000` (₹2,00,000 - base price)
- **Cost Price:** (optional)
- **Stock Quantity:** (set as needed)
- **Unit:** `piece` or `unit`
- **HSN Code:** `870380` ⚠️ **IMPORTANT**
- **GST Rate:** `5` ⚠️ **IMPORTANT** (not 18%)
- **Selling Unit Type:** `None` (or as needed)

#### Product 2: Krishna E-Cart 3x5 Model
- **Name:** `Krishna E-Cart 3x5 Model`
- **Description:** `Krishna Loader 3ft by 5ft Type: Battery Operated E-Cart for Cargo`
- **SKU:** (optional) `KRISHNA-ECART-3X5`
- **Category:** `Electric Vehicles` or `E-Loader`
- **Price:** `210000` (₹2,10,000 - base price)
- **Cost Price:** (optional)
- **Stock Quantity:** (set as needed)
- **Unit:** `piece` or `unit`
- **HSN Code:** `870380` ⚠️ **IMPORTANT**
- **GST Rate:** `5` ⚠️ **IMPORTANT** (not 18%)
- **Selling Unit Type:** `None` (or as needed)

#### Product 3: Krishna E-Cart 4x6 Model
- **Name:** `Krishna E-Cart 4x6 Model`
- **Description:** `Krishna Loader 4ft by 6ft Type: Battery Operated E-Cart for Cargo`
- **SKU:** (optional) `KRISHNA-ECART-4X6`
- **Category:** `Electric Vehicles` or `E-Loader`
- **Price:** `220000` (₹2,20,000 - base price)
- **Cost Price:** (optional)
- **Stock Quantity:** (set as needed)
- **Unit:** `piece` or `unit`
- **HSN Code:** `870380` ⚠️ **IMPORTANT**
- **GST Rate:** `5` ⚠️ **IMPORTANT** (not 18%)
- **Selling Unit Type:** `None` (or as needed)

---

## 📝 Creating Invoices - How to Match Physical Format

### When Creating an Invoice:

1. **Add Products:**
   - Select the 3 products from the product list
   - Set quantities and prices as needed

2. **Add Additional Charges as Line Items:**
   Since the invoice shows charges as separate line items, add them manually:

   **To add charges (Insurance, RTO Tax, Other Expense):**
   - Click **"Add Item"** button
   - **Leave Product dropdown empty** (or select "None")
   - **Description:** Enter charge name (e.g., "Insurance", "RTO Tax", "Other Expense")
   - **Quantity:** `1`
   - **Unit Price:** Enter the charge amount
   - **GST Rate:** `0` (if charges are non-taxable) or `5` (if taxable)
   - **HSN Code:** Leave empty or use `870380` if applicable

   **To add GST as a line item (if needed):**
   - Click **"Add Item"**
   - **Description:** `GST 5%`
   - **Quantity:** `1`
   - **Unit Price:** Enter GST amount (calculated from products)
   - **GST Rate:** `0` (since GST is already calculated)
   - **HSN Code:** `870380`

3. **Invoice Settings:**
   - **Invoice Type:** Select "Performa Invoice" if you have that option, or use regular invoice
   - **GST Invoice:** Enable (since all products have GST)
   - **Terms:** Add your terms and conditions

---

## 🔍 Schema Analysis - What's Already Supported

### Invoice Schema (`lib/dexie-client.ts`):
```typescript
export interface Invoice {
  invoice_number: string;        ✅ Matches "Invoice No."
  invoice_date: string;          ✅ Matches "Invoice Date"
  customer_id: string;           ✅ Links to customer (name, address, phone)
  is_gst_invoice: boolean;       ✅ Matches GST invoice requirement
  subtotal: number;              ✅ For base amounts
  cgst_amount: number;           ✅ For CGST breakdown
  sgst_amount: number;           ✅ For SGST breakdown
  igst_amount: number;           ✅ For IGST breakdown
  total_amount: number;          ✅ Matches "Total Amount Rs."
  notes?: string;                ✅ For additional notes
  terms?: string;                ✅ For terms & conditions
}
```

### InvoiceItem Schema:
```typescript
export interface InvoiceItem {
  product_id?: string | null;    ✅ Can be null for charges
  description: string;           ✅ Matches "MACHINERY DESCRIPTION"
  quantity: number;               ✅ Matches "QTY"
  unit_price: number;            ✅ For calculating amount
  gst_rate: number;              ✅ Matches "GST 5%"
  hsn_code?: string | null;      ✅ Matches "GST - HSN" (870380)
  line_total?: number;           ✅ Matches "AMOUNT RS."
}
```

**✅ All required fields are present!**

---

## ⚠️ Important Notes

1. **GST Rate:** Make sure to set default GST rate to **5%** (not 18%) in Business Settings
2. **HSN Code:** All 3 products use HSN code **870380** - make sure to add this to each product
3. **Charges as Line Items:** Insurance, RTO Tax, Other Expense should be added as separate line items with `product_id = null`
4. **GST as Line Item:** If you want GST shown as a separate line item (like in the physical invoice), add it manually as a line item
5. **Bank Details:** Currently not in schema - store manually in Business Settings notes or add to each invoice notes

---

## 🎯 Quick Checklist

- [ ] Create Store with name, address, GSTIN, phone
- [ ] Configure Business Settings with all business details
- [ ] Set Default GST Rate to **5%**
- [ ] Add 3 Products with HSN Code **870380** and GST Rate **5%**
- [ ] Store Bank Details (manually in notes or business settings)
- [ ] Test creating an invoice with products + charges

---

## 💡 Optional: Adding Bank Details to Schema

If you want bank details in the schema (for future use), we can add:
- `bank_name?: string`
- `account_name?: string`
- `account_number?: string`
- `ifsc_code?: string`

To either:
- `Store` interface (if bank details are per store)
- `business_settings` (if bank details are per business)

Let me know if you want this added!
