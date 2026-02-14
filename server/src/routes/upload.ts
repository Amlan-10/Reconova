import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import { upload } from "../middleware/upload";
import {
    createSession,
    getSessions,
    uploadPurchaseRegister,
    uploadGSTR2B,
} from "../controllers/uploadController";

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Session management
router.post("/sessions", createSession);
router.get("/sessions", getSessions);

// File uploads (per session)
router.post(
    "/sessions/:sessionId/purchase",
    upload.single("file"),
    uploadPurchaseRegister
);
router.post(
    "/sessions/:sessionId/gstr2b",
    upload.single("file"),
    uploadGSTR2B
);

export default router;
