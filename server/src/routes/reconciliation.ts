import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import {
    reconcile,
    getResults,
    exportReport,
} from "../controllers/reconciliationController";

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Reconciliation operations
router.post("/sessions/:sessionId/run", reconcile);
router.get("/sessions/:sessionId/results", getResults);
router.get("/sessions/:sessionId/export", exportReport);

export default router;
