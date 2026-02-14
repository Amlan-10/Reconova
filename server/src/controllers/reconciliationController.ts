import { Response } from "express";
import prisma from "../config/db";
import { AuthRequest } from "../middleware/auth";
import { runReconciliation } from "../services/reconciliationService";
import * as XLSX from "xlsx";

/**
 * Trigger reconciliation for a session.
 */
export const reconcile = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { sessionId } = req.params;

        // Verify session belongs to user
        const session = await prisma.reconciliationSession.findFirst({
            where: { id: sessionId, userId: req.userId! },
        });

        if (!session) {
            res.status(404).json({ error: "Session not found." });
            return;
        }

        // Check that both files have been uploaded
        const [purchaseCount, gstr2bCount] = await Promise.all([
            prisma.purchaseInvoice.count({ where: { sessionId, userId: req.userId! } }),
            prisma.gSTR2BInvoice.count({ where: { sessionId, userId: req.userId! } }),
        ]);

        if (purchaseCount === 0) {
            res.status(400).json({ error: "No purchase invoices uploaded for this session." });
            return;
        }

        if (gstr2bCount === 0) {
            res.status(400).json({ error: "No GSTR-2B invoices uploaded for this session." });
            return;
        }

        // Run reconciliation
        const results = await runReconciliation(req.userId!, sessionId);

        // Compute summary
        const summary = {
            total: results.length,
            matched: results.filter((r) => r.status === "MATCHED").length,
            missingIn2B: results.filter((r) => r.status === "MISSING_IN_2B").length,
            amountMismatch: results.filter((r) => r.status === "AMOUNT_MISMATCH").length,
            missingInBooks: results.filter((r) => r.status === "MISSING_IN_BOOKS").length,
            totalItcAtRisk: results
                .filter((r) => r.status === "MISSING_IN_2B" || r.status === "AMOUNT_MISMATCH")
                .reduce((sum, r) => {
                    if (r.status === "MISSING_IN_2B") return sum + (r.booksGst || 0);
                    if (r.status === "AMOUNT_MISMATCH")
                        return sum + Math.abs((r.booksGst || 0) - (r.gstr2bGst || 0));
                    return sum;
                }, 0),
        };

        res.json({
            message: "Reconciliation completed successfully.",
            summary,
            results,
        });
    } catch (error) {
        console.error("Reconciliation error:", error);
        res.status(500).json({ error: "Reconciliation failed." });
    }
};

/**
 * Get reconciliation results for a session.
 */
export const getResults = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { sessionId } = req.params;

        const results = await prisma.reconciliationResult.findMany({
            where: { sessionId, userId: req.userId! },
            orderBy: { createdAt: "asc" },
        });

        // Compute summary
        const summary = {
            total: results.length,
            matched: results.filter((r) => r.status === "MATCHED").length,
            missingIn2B: results.filter((r) => r.status === "MISSING_IN_2B").length,
            amountMismatch: results.filter((r) => r.status === "AMOUNT_MISMATCH").length,
            missingInBooks: results.filter((r) => r.status === "MISSING_IN_BOOKS").length,
            totalItcAtRisk: results
                .filter((r) => r.status === "MISSING_IN_2B" || r.status === "AMOUNT_MISMATCH")
                .reduce((sum, r) => {
                    if (r.status === "MISSING_IN_2B") return sum + (r.booksGst || 0);
                    if (r.status === "AMOUNT_MISMATCH")
                        return sum + Math.abs((r.booksGst || 0) - (r.gstr2bGst || 0));
                    return sum;
                }, 0),
        };

        res.json({ summary, results });
    } catch (error) {
        console.error("Get results error:", error);
        res.status(500).json({ error: "Failed to fetch results." });
    }
};

/**
 * Export reconciliation results as an Excel file.
 */
export const exportReport = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { sessionId } = req.params;

        const results = await prisma.reconciliationResult.findMany({
            where: { sessionId, userId: req.userId! },
            orderBy: { createdAt: "asc" },
        });

        if (results.length === 0) {
            res.status(404).json({ error: "No reconciliation results found." });
            return;
        }

        // Build Excel workbook
        const data = results.map((r) => ({
            "Invoice No": r.invoiceNo,
            "Supplier GSTIN": r.supplierGstin,
            "Books GST (₹)": r.booksGst ?? "-",
            "GSTR-2B GST (₹)": r.gstr2bGst ?? "-",
            Status: r.status,
            Remark: r.remark || "",
        }));

        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(data);

        // Set column widths
        worksheet["!cols"] = [
            { wch: 18 },
            { wch: 20 },
            { wch: 15 },
            { wch: 15 },
            { wch: 20 },
            { wch: 50 },
        ];

        XLSX.utils.book_append_sheet(workbook, worksheet, "Reconciliation Report");

        // Write to buffer
        const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

        res.setHeader(
            "Content-Disposition",
            `attachment; filename=reconciliation_report_${sessionId}.xlsx`
        );
        res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        res.send(buffer);
    } catch (error) {
        console.error("Export error:", error);
        res.status(500).json({ error: "Failed to export report." });
    }
};
