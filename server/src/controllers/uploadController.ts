import { Response } from "express";
import prisma from "../config/db";
import { AuthRequest } from "../middleware/auth";
import { parseFile } from "../services/csvParser";
import fs from "fs";

/**
 * Create a new reconciliation session.
 */
export const createSession = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { name, period } = req.body;

        // Check trial limit for free users by counting actual sessions
        const currentUser = await prisma.user.findUnique({
            where: { id: req.userId! },
            select: { plan: true },
        });

        if (currentUser && currentUser.plan === "free") {
            const sessionCount = await prisma.reconciliationSession.count({
                where: { userId: req.userId! },
            });
            if (sessionCount >= 3) {
                res.status(403).json({
                    error: "You've used all 3 free trial sessions. Upgrade to continue.",
                    trialLimitReached: true,
                });
                return;
            }
        }

        const session = await prisma.reconciliationSession.create({
            data: {
                userId: req.userId!,
                name: name || `Reconciliation ${new Date().toLocaleDateString()}`,
                period: period || null,
            },
        });

        // Count sessions after creation
        const newCount = await prisma.reconciliationSession.count({
            where: { userId: req.userId! },
        });

        res.status(201).json({
            session,
            trialSessionsUsed: newCount,
        });
    } catch (error) {
        console.error("Create session error:", error);
        res.status(500).json({ error: "Failed to create session." });
    }
};

/**
 * Get all sessions for the current user.
 */
export const getSessions = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const sessions = await prisma.reconciliationSession.findMany({
            where: { userId: req.userId! },
            orderBy: { createdAt: "desc" },
            include: {
                _count: {
                    select: {
                        purchaseInvoices: true,
                        gstr2bInvoices: true,
                        reconciliationResults: true,
                    },
                },
            },
        });

        res.json({ sessions });
    } catch (error) {
        console.error("Get sessions error:", error);
        res.status(500).json({ error: "Failed to fetch sessions." });
    }
};

/**
 * Update a reconciliation session (name/period).
 */
export const updateSession = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { sessionId } = req.params;
        const { name, period } = req.body;

        const session = await prisma.reconciliationSession.findFirst({
            where: { id: sessionId, userId: req.userId! },
        });

        if (!session) {
            res.status(404).json({ error: "Session not found." });
            return;
        }

        const updated = await prisma.reconciliationSession.update({
            where: { id: sessionId },
            data: {
                ...(name !== undefined && { name }),
                ...(period !== undefined && { period: period || null }),
            },
        });

        res.json({ session: updated });
    } catch (error) {
        console.error("Update session error:", error);
        res.status(500).json({ error: "Failed to update session." });
    }
};

/**
 * Delete a reconciliation session and all related data.
 */
export const deleteSession = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { sessionId } = req.params;

        const session = await prisma.reconciliationSession.findFirst({
            where: { id: sessionId, userId: req.userId! },
        });

        if (!session) {
            res.status(404).json({ error: "Session not found." });
            return;
        }

        // Delete session (cascades to invoices and results)
        await prisma.reconciliationSession.delete({
            where: { id: sessionId },
        });

        // Count remaining sessions
        const remainingCount = await prisma.reconciliationSession.count({
            where: { userId: req.userId! },
        });

        res.json({
            message: "Session deleted successfully.",
            trialSessionsUsed: remainingCount,
        });
    } catch (error) {
        console.error("Delete session error:", error);
        res.status(500).json({ error: "Failed to delete session." });
    }
};

/**
 * Upload Purchase Register CSV/Excel for a session.
 */
export const uploadPurchaseRegister = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { sessionId } = req.params;

        if (!req.file) {
            res.status(400).json({ error: "No file uploaded." });
            return;
        }

        // Verify session belongs to user
        const session = await prisma.reconciliationSession.findFirst({
            where: { id: sessionId, userId: req.userId! },
        });

        if (!session) {
            res.status(404).json({ error: "Session not found." });
            return;
        }

        // Parse file
        const invoices = await parseFile(req.file.path);

        if (invoices.length === 0) {
            res.status(400).json({
                error: "No valid invoices found. Ensure columns include: Invoice No, Supplier GSTIN, GST Amount.",
            });
            return;
        }

        // Clear previous purchase invoices for this session
        await prisma.purchaseInvoice.deleteMany({
            where: { sessionId, userId: req.userId! },
        });

        // Store parsed invoices
        await prisma.purchaseInvoice.createMany({
            data: invoices.map((inv) => ({
                userId: req.userId!,
                sessionId,
                invoiceNo: inv.invoiceNo,
                supplierGstin: inv.supplierGstin,
                invoiceDate: inv.invoiceDate || null,
                gstAmount: inv.gstAmount,
            })),
        });

        // Clean up uploaded file
        fs.unlinkSync(req.file.path);

        res.json({
            message: `Successfully uploaded ${invoices.length} purchase invoices.`,
            count: invoices.length,
        });
    } catch (error) {
        console.error("Upload purchase register error:", error);
        // Clean up file on error
        if (req.file) {
            try { fs.unlinkSync(req.file.path); } catch (_) { }
        }
        res.status(500).json({ error: "Failed to process purchase register file." });
    }
};

/**
 * Upload GSTR-2B CSV/Excel for a session.
 */
export const uploadGSTR2B = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { sessionId } = req.params;

        if (!req.file) {
            res.status(400).json({ error: "No file uploaded." });
            return;
        }

        // Verify session belongs to user
        const session = await prisma.reconciliationSession.findFirst({
            where: { id: sessionId, userId: req.userId! },
        });

        if (!session) {
            res.status(404).json({ error: "Session not found." });
            return;
        }

        // Parse file
        const invoices = await parseFile(req.file.path);

        if (invoices.length === 0) {
            res.status(400).json({
                error: "No valid invoices found. Ensure columns include: Invoice No, Supplier GSTIN, GST Amount.",
            });
            return;
        }

        // Clear previous GSTR-2B invoices for this session
        await prisma.gSTR2BInvoice.deleteMany({
            where: { sessionId, userId: req.userId! },
        });

        // Store parsed invoices
        await prisma.gSTR2BInvoice.createMany({
            data: invoices.map((inv) => ({
                userId: req.userId!,
                sessionId,
                invoiceNo: inv.invoiceNo,
                supplierGstin: inv.supplierGstin,
                gstAmount: inv.gstAmount,
            })),
        });

        // Clean up uploaded file
        fs.unlinkSync(req.file.path);

        res.json({
            message: `Successfully uploaded ${invoices.length} GSTR-2B invoices.`,
            count: invoices.length,
        });
    } catch (error) {
        console.error("Upload GSTR-2B error:", error);
        if (req.file) {
            try { fs.unlinkSync(req.file.path); } catch (_) { }
        }
        res.status(500).json({ error: "Failed to process GSTR-2B file." });
    }
};
