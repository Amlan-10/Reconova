import prisma from "../config/db";

interface InvoiceRecord {
    invoiceNo: string;
    supplierGstin: string;
    gstAmount: number;
}

interface ReconciliationResultItem {
    invoiceNo: string;
    supplierGstin: string;
    booksGst: number | null;
    gstr2bGst: number | null;
    status: "MATCHED" | "MISSING_IN_2B" | "AMOUNT_MISMATCH" | "MISSING_IN_BOOKS";
    remark: string;
}

/**
 * Generate a composite key for matching invoices.
 * Normalizes invoice number and GSTIN for reliable matching.
 */
function makeKey(invoiceNo: string, gstin: string): string {
    return `${invoiceNo.trim().toUpperCase()}|${gstin.trim().toUpperCase()}`;
}

/**
 * Core reconciliation engine.
 * Compares purchase register invoices against GSTR-2B invoices
 * using Invoice No + Supplier GSTIN as matching key.
 */
export function reconcile(
    purchaseInvoices: InvoiceRecord[],
    gstr2bInvoices: InvoiceRecord[]
): ReconciliationResultItem[] {
    const results: ReconciliationResultItem[] = [];

    // Build a map of GSTR-2B invoices for O(1) lookup
    const gstr2bMap = new Map<string, InvoiceRecord>();
    for (const inv of gstr2bInvoices) {
        const key = makeKey(inv.invoiceNo, inv.supplierGstin);
        gstr2bMap.set(key, inv);
    }

    // Track which 2B invoices have been matched
    const matched2BKeys = new Set<string>();

    // Check each purchase invoice against GSTR-2B
    for (const purchase of purchaseInvoices) {
        const key = makeKey(purchase.invoiceNo, purchase.supplierGstin);
        const gstr2bRecord = gstr2bMap.get(key);

        if (!gstr2bRecord) {
            // Invoice exists in books but NOT in GSTR-2B
            results.push({
                invoiceNo: purchase.invoiceNo,
                supplierGstin: purchase.supplierGstin,
                booksGst: purchase.gstAmount,
                gstr2bGst: null,
                status: "MISSING_IN_2B",
                remark: "Invoice found in purchase register but not in GSTR-2B. ITC at risk.",
            });
        } else {
            matched2BKeys.add(key);

            const diff = Math.abs(purchase.gstAmount - gstr2bRecord.gstAmount);
            if (diff < 0.01) {
                // Exact match (within floating point tolerance)
                results.push({
                    invoiceNo: purchase.invoiceNo,
                    supplierGstin: purchase.supplierGstin,
                    booksGst: purchase.gstAmount,
                    gstr2bGst: gstr2bRecord.gstAmount,
                    status: "MATCHED",
                    remark: "Invoice matched successfully.",
                });
            } else {
                // Amount mismatch
                results.push({
                    invoiceNo: purchase.invoiceNo,
                    supplierGstin: purchase.supplierGstin,
                    booksGst: purchase.gstAmount,
                    gstr2bGst: gstr2bRecord.gstAmount,
                    status: "AMOUNT_MISMATCH",
                    remark: `GST amount differs by ₹${diff.toFixed(2)}. Books: ₹${purchase.gstAmount}, 2B: ₹${gstr2bRecord.gstAmount}`,
                });
            }
        }
    }

    // Find invoices in GSTR-2B but NOT in purchase register
    for (const gstr2b of gstr2bInvoices) {
        const key = makeKey(gstr2b.invoiceNo, gstr2b.supplierGstin);
        if (!matched2BKeys.has(key)) {
            results.push({
                invoiceNo: gstr2b.invoiceNo,
                supplierGstin: gstr2b.supplierGstin,
                booksGst: null,
                gstr2bGst: gstr2b.gstAmount,
                status: "MISSING_IN_BOOKS",
                remark: "Invoice found in GSTR-2B but not in purchase register. Possible unrecorded purchase.",
            });
        }
    }

    return results;
}

/**
 * Run reconciliation for a session and persist results to the database.
 */
export async function runReconciliation(
    userId: string,
    sessionId: string
): Promise<ReconciliationResultItem[]> {
    // Fetch invoices for this session
    const [purchaseInvoices, gstr2bInvoices] = await Promise.all([
        prisma.purchaseInvoice.findMany({
            where: { sessionId, userId },
        }),
        prisma.gSTR2BInvoice.findMany({
            where: { sessionId, userId },
        }),
    ]);

    // Run reconciliation
    const results = reconcile(
        purchaseInvoices.map((inv) => ({
            invoiceNo: inv.invoiceNo,
            supplierGstin: inv.supplierGstin,
            gstAmount: inv.gstAmount,
        })),
        gstr2bInvoices.map((inv) => ({
            invoiceNo: inv.invoiceNo,
            supplierGstin: inv.supplierGstin,
            gstAmount: inv.gstAmount,
        }))
    );

    // Clear previous results for this session
    await prisma.reconciliationResult.deleteMany({
        where: { sessionId, userId },
    });

    // Store results
    await prisma.reconciliationResult.createMany({
        data: results.map((r) => ({
            userId,
            sessionId,
            invoiceNo: r.invoiceNo,
            supplierGstin: r.supplierGstin,
            booksGst: r.booksGst,
            gstr2bGst: r.gstr2bGst,
            status: r.status,
            remark: r.remark,
        })),
    });

    return results;
}
