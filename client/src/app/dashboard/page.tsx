"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useDropzone } from "react-dropzone";
import {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
} from "recharts";
import {
    Shield,
    Upload,
    FileSpreadsheet,
    CheckCircle2,
    AlertTriangle,
    XCircle,
    HelpCircle,
    Download,
    Plus,
    LogOut,
    Activity,
    IndianRupee,
    Loader2,
    Sparkles,
    ChevronRight,
    Calendar,
    Zap,
    Crown,
    X,
    Pencil,
    Trash2,
} from "lucide-react";
import api from "@/lib/api";

interface Session {
    id: string;
    name: string;
    period: string | null;
    createdAt: string;
    _count: {
        purchaseInvoices: number;
        gstr2bInvoices: number;
        reconciliationResults: number;
    };
}

interface ReconciliationResult {
    id: string;
    invoiceNo: string;
    supplierGstin: string;
    booksGst: number | null;
    gstr2bGst: number | null;
    status: string;
    remark: string;
}

interface Summary {
    total: number;
    matched: number;
    missingIn2B: number;
    amountMismatch: number;
    missingInBooks: number;
    totalItcAtRisk: number;
}

const STATUS_CONFIG: Record<
    string,
    { color: string; bg: string; icon: React.ReactNode; label: string }
> = {
    MATCHED: {
        color: "#1C9719",
        bg: "rgba(28,151,25,0.15)",
        icon: <CheckCircle2 style={{ width: 14, height: 14 }} />,
        label: "Matched",
    },
    MISSING_IN_2B: {
        color: "#f87171",
        bg: "rgba(190,58,31,0.15)",
        icon: <XCircle style={{ width: 14, height: 14 }} />,
        label: "Missing in 2B",
    },
    AMOUNT_MISMATCH: {
        color: "#E8A317",
        bg: "rgba(232,163,23,0.15)",
        icon: <AlertTriangle style={{ width: 14, height: 14 }} />,
        label: "Amount Mismatch",
    },
    MISSING_IN_BOOKS: {
        color: "#818cf8",
        bg: "rgba(99,102,241,0.15)",
        icon: <HelpCircle style={{ width: 14, height: 14 }} />,
        label: "Missing in Books",
    },
};

export default function DashboardPage() {
    const { user, logout, updateTrialUsage, refreshUser, isLoading: authLoading } = useAuth();
    const router = useRouter();

    const [sessions, setSessions] = useState<Session[]>([]);
    const [activeSession, setActiveSession] = useState<Session | null>(null);
    const [results, setResults] = useState<ReconciliationResult[]>([]);
    const [summary, setSummary] = useState<Summary | null>(null);

    const [uploading, setUploading] = useState<"purchase" | "gstr2b" | null>(null);
    const [reconciling, setReconciling] = useState(false);
    const [loadingSessions, setLoadingSessions] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string>("ALL");
    const [newSessionModal, setNewSessionModal] = useState(false);
    const [newSessionName, setNewSessionName] = useState("");
    const [newSessionPeriod, setNewSessionPeriod] = useState("");
    const [trialLimitModal, setTrialLimitModal] = useState(false);
    const [editSessionModal, setEditSessionModal] = useState(false);
    const [editingSession, setEditingSession] = useState<Session | null>(null);
    const [editSessionName, setEditSessionName] = useState("");
    const [editSessionPeriod, setEditSessionPeriod] = useState("");

    const isFreeUser = user?.plan === "free";
    const trialLimit = 3;
    const trialUsed = isFreeUser ? sessions.length : 0;
    const trialRemaining = Math.max(0, trialLimit - trialUsed);

    useEffect(() => {
        if (!authLoading && !user) router.push("/");
    }, [user, authLoading, router]);

    const fetchSessions = useCallback(async () => {
        try {
            setLoadingSessions(true);
            const res = await api.get("/upload/sessions");
            setSessions(res.data.sessions);
        } catch {
            console.error("Failed to fetch sessions");
        } finally {
            setLoadingSessions(false);
        }
    }, []);

    useEffect(() => {
        if (user) fetchSessions();
    }, [user, fetchSessions]);

    // Sync fresh user data (plan/trial) from server once on mount
    useEffect(() => {
        const token = localStorage.getItem("reconova_token");
        if (token) refreshUser();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const fetchResults = useCallback(async (sessionId: string) => {
        try {
            const res = await api.get(`/reconciliation/sessions/${sessionId}/results`);
            setResults(res.data.results);
            setSummary(res.data.summary);
        } catch {
            setResults([]);
            setSummary(null);
        }
    }, []);

    useEffect(() => {
        if (activeSession) fetchResults(activeSession.id);
    }, [activeSession, fetchResults]);

    const handleNewSessionClick = () => {
        if (isFreeUser && trialUsed >= trialLimit) {
            setTrialLimitModal(true);
            return;
        }
        setNewSessionModal(true);
    };

    const createSession = async () => {
        try {
            const res = await api.post("/upload/sessions", {
                name: newSessionName || undefined,
                period: newSessionPeriod || undefined,
            });
            const newSession = {
                ...res.data.session,
                _count: { purchaseInvoices: 0, gstr2bInvoices: 0, reconciliationResults: 0 },
            };
            setSessions((prev) => [newSession, ...prev]);
            setActiveSession(newSession);
            setNewSessionModal(false);
            setNewSessionName("");
            setNewSessionPeriod("");
            // Update trial usage in auth context
            if (res.data.trialSessionsUsed !== undefined) {
                updateTrialUsage(res.data.trialSessionsUsed);
            }
        } catch (err: unknown) {
            const error = err as { response?: { data?: { trialLimitReached?: boolean } } };
            if (error.response?.data?.trialLimitReached) {
                setNewSessionModal(false);
                setTrialLimitModal(true);
            } else {
                console.error("Failed to create session");
            }
        }
    };

    const handleEditSession = (session: Session, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingSession(session);
        setEditSessionName(session.name || "");
        setEditSessionPeriod(session.period || "");
        setEditSessionModal(true);
    };

    const saveEditSession = async () => {
        if (!editingSession) return;
        try {
            const res = await api.patch(`/upload/sessions/${editingSession.id}`, {
                name: editSessionName || undefined,
                period: editSessionPeriod || undefined,
            });
            setSessions((prev) =>
                prev.map((s) =>
                    s.id === editingSession.id ? { ...s, ...res.data.session } : s
                )
            );
            if (activeSession?.id === editingSession.id) {
                setActiveSession((prev) => prev ? { ...prev, ...res.data.session } : prev);
            }
            setEditSessionModal(false);
            setEditingSession(null);
        } catch {
            console.error("Failed to update session");
        }
    };

    const handleDeleteSession = async (session: Session, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm(`Delete "${session.name || "Untitled Session"}"? This will remove all its data permanently.`)) return;
        try {
            const res = await api.delete(`/upload/sessions/${session.id}`);
            setSessions((prev) => prev.filter((s) => s.id !== session.id));
            if (activeSession?.id === session.id) {
                setActiveSession(null);
                setResults([]);
                setSummary(null);
            }
            if (res.data.trialSessionsUsed !== undefined) {
                updateTrialUsage(res.data.trialSessionsUsed);
            }
        } catch {
            console.error("Failed to delete session");
        }
    };

    const handleFileUpload = async (file: File, type: "purchase" | "gstr2b") => {
        if (!activeSession) return;
        setUploading(type);
        try {
            const formData = new FormData();
            formData.append("file", file);
            const endpoint =
                type === "purchase"
                    ? `/upload/sessions/${activeSession.id}/purchase`
                    : `/upload/sessions/${activeSession.id}/gstr2b`;
            await api.post(endpoint, formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            await fetchSessions();
            const updated = (await api.get("/upload/sessions")).data.sessions;
            const refreshed = updated.find((s: Session) => s.id === activeSession.id);
            if (refreshed) setActiveSession(refreshed);
        } catch {
            console.error("Upload failed");
        } finally {
            setUploading(null);
        }
    };

    const runReconciliation = async () => {
        if (!activeSession) return;
        setReconciling(true);
        try {
            const res = await api.post(`/reconciliation/sessions/${activeSession.id}/run`);
            setResults(res.data.results);
            setSummary(res.data.summary);
            await fetchSessions();
            const updated = (await api.get("/upload/sessions")).data.sessions;
            const refreshed = updated.find((s: Session) => s.id === activeSession.id);
            if (refreshed) setActiveSession(refreshed);
        } catch {
            console.error("Reconciliation failed");
        } finally {
            setReconciling(false);
        }
    };

    const exportReport = async () => {
        if (!activeSession) return;
        try {
            const res = await api.get(
                `/reconciliation/sessions/${activeSession.id}/export`,
                { responseType: "blob" }
            );
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const a = document.createElement("a");
            a.href = url;
            a.download = `reconciliation_report_${activeSession.name || activeSession.id}.xlsx`;
            a.click();
            window.URL.revokeObjectURL(url);
        } catch {
            console.error("Export failed");
        }
    };

    const filteredResults =
        statusFilter === "ALL" ? results : results.filter((r) => r.status === statusFilter);

    const pieData = summary
        ? [
            { name: "Matched", value: summary.matched, color: "#1C9719" },
            { name: "Missing in 2B", value: summary.missingIn2B, color: "#BE3A1F" },
            { name: "Mismatch", value: summary.amountMismatch, color: "#E8A317" },
            { name: "Missing in Books", value: summary.missingInBooks, color: "#6366f1" },
        ].filter((d) => d.value > 0)
        : [];

    const barData = summary
        ? [
            { name: "Matched", count: summary.matched, fill: "#1C9719" },
            { name: "Missing 2B", count: summary.missingIn2B, fill: "#BE3A1F" },
            { name: "Mismatch", count: summary.amountMismatch, fill: "#E8A317" },
            { name: "No Books", count: summary.missingInBooks, fill: "#6366f1" },
        ]
        : [];

    if (authLoading) {
        return (
            <div
                style={{
                    minHeight: "100vh",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "var(--bg-dark)",
                }}
            >
                <Loader2
                    style={{ width: 32, height: 32, color: "var(--primary)", animation: "spin 1s linear infinite" }}
                />
            </div>
        );
    }

    if (!user) return null;

    return (
        <div style={{ minHeight: "100vh", background: "var(--bg-dark)" }}>
            {/* Header */}
            <header
                style={{
                    position: "sticky",
                    top: 0,
                    zIndex: 50,
                    background: "rgba(2,3,3,0.85)",
                    backdropFilter: "blur(12px)",
                    borderBottom: "1px solid var(--border)",
                }}
            >
                <div
                    style={{
                        maxWidth: 1200,
                        margin: "0 auto",
                        padding: "16px 24px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                    }}
                >
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div
                            style={{
                                width: 36,
                                height: 36,
                                borderRadius: 10,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                background: "var(--gradient-primary)",
                            }}
                        >
                            <Shield style={{ width: 18, height: 18, color: "white" }} />
                        </div>
                        <span style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>
                            Reconova
                        </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                        {isFreeUser && (
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    padding: "6px 14px",
                                    borderRadius: 8,
                                    fontSize: 12,
                                    fontWeight: 600,
                                    background: trialRemaining > 0
                                        ? "rgba(28, 151, 25, 0.1)"
                                        : "rgba(232, 163, 23, 0.1)",
                                    border: `1px solid ${trialRemaining > 0 ? "rgba(28, 151, 25, 0.3)" : "rgba(232, 163, 23, 0.3)"}`,
                                    color: trialRemaining > 0 ? "var(--primary)" : "#E8A317",
                                }}
                            >
                                <Zap style={{ width: 14, height: 14 }} />
                                Free Trial: {trialUsed}/{trialLimit} sessions used
                            </div>
                        )}
                        <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>{user.email}</span>
                        <button
                            onClick={logout}
                            style={{
                                padding: 8,
                                borderRadius: 8,
                                background: "transparent",
                                border: "none",
                                cursor: "pointer",
                                color: "var(--text-muted)",
                                display: "flex",
                                alignItems: "center",
                            }}
                        >
                            <LogOut style={{ width: 18, height: 18 }} />
                        </button>
                    </div>
                </div>
            </header>

            <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px" }}>
                <div style={{ display: "flex", gap: 32 }}>
                    {/* Sidebar - Sessions */}
                    <div style={{ width: 280, flexShrink: 0 }}>
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                marginBottom: 16,
                            }}
                        >
                            <h2
                                style={{
                                    fontSize: 12,
                                    fontWeight: 600,
                                    textTransform: "uppercase",
                                    letterSpacing: "0.08em",
                                    color: "var(--text-muted)",
                                }}
                            >
                                Sessions
                            </h2>
                            <button
                                onClick={handleNewSessionClick}
                                style={{
                                    padding: 6,
                                    borderRadius: 8,
                                    background: "var(--primary)",
                                    color: "white",
                                    border: "none",
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                }}
                            >
                                <Plus style={{ width: 16, height: 16 }} />
                            </button>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {loadingSessions ? (
                                [1, 2, 3].map((i) => (
                                    <div
                                        key={i}
                                        className="skeleton"
                                        style={{ height: 80, borderRadius: 12 }}
                                    />
                                ))
                            ) : sessions.length === 0 ? (
                                <div
                                    style={{
                                        textAlign: "center",
                                        padding: "48px 16px",
                                        borderRadius: 12,
                                        background: "var(--surface)",
                                        border: "1px solid var(--border)",
                                    }}
                                >
                                    <FileSpreadsheet
                                        style={{ width: 32, height: 32, margin: "0 auto 12px", color: "var(--text-muted)" }}
                                    />
                                    <p style={{ fontSize: 14, marginBottom: 4, color: "var(--text-secondary)" }}>
                                        No sessions yet
                                    </p>
                                    <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                                        Create one to start reconciling
                                    </p>
                                </div>
                            ) : (
                                sessions.map((session) => (
                                    <div
                                        key={session.id}
                                        onClick={() => {
                                            setActiveSession(session);
                                            setStatusFilter("ALL");
                                        }}
                                        style={{
                                            width: "100%",
                                            textAlign: "left",
                                            padding: 16,
                                            borderRadius: 12,
                                            cursor: "pointer",
                                            transition: "all 0.2s",
                                            background:
                                                activeSession?.id === session.id ? "var(--surface-light)" : "var(--surface)",
                                            border: `1px solid ${activeSession?.id === session.id ? "var(--primary)" : "var(--border)"
                                                }`,
                                        }}
                                    >
                                        <div
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "space-between",
                                                marginBottom: 4,
                                            }}
                                        >
                                            <span
                                                style={{
                                                    fontWeight: 500,
                                                    fontSize: 14,
                                                    color: "var(--text-primary)",
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                    whiteSpace: "nowrap",
                                                }}
                                            >
                                                {session.name || "Untitled Session"}
                                            </span>
                                            <ChevronRight style={{ width: 16, height: 16, color: "var(--text-muted)", flexShrink: 0 }} />
                                        </div>
                                        {session.period && (
                                            <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 8 }}>
                                                <Calendar style={{ width: 12, height: 12, color: "var(--text-muted)" }} />
                                                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{session.period}</span>
                                            </div>
                                        )}
                                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                            <div style={{ display: "flex", gap: 12, fontSize: 12, color: "var(--text-secondary)" }}>
                                                <span>{session._count?.purchaseInvoices ?? 0} purchases</span>
                                                <span>·</span>
                                                <span>{session._count?.gstr2bInvoices ?? 0} 2B</span>
                                                {(session._count?.reconciliationResults ?? 0) > 0 && (
                                                    <>
                                                        <span>·</span>
                                                        <span style={{ color: "var(--primary)" }}>✓ reconciled</span>
                                                    </>
                                                )}
                                            </div>
                                            <div style={{ display: "flex", gap: 4 }}>
                                                <button
                                                    onClick={(e) => handleEditSession(session, e)}
                                                    title="Edit session"
                                                    style={{
                                                        padding: 4,
                                                        borderRadius: 6,
                                                        background: "transparent",
                                                        border: "none",
                                                        cursor: "pointer",
                                                        color: "var(--text-muted)",
                                                        display: "flex",
                                                        alignItems: "center",
                                                        transition: "color 0.2s",
                                                    }}
                                                    onMouseEnter={(e) => { e.currentTarget.style.color = "var(--primary)"; }}
                                                    onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}
                                                >
                                                    <Pencil style={{ width: 13, height: 13 }} />
                                                </button>
                                                <button
                                                    onClick={(e) => handleDeleteSession(session, e)}
                                                    title="Delete session"
                                                    style={{
                                                        padding: 4,
                                                        borderRadius: 6,
                                                        background: "transparent",
                                                        border: "none",
                                                        cursor: "pointer",
                                                        color: "var(--text-muted)",
                                                        display: "flex",
                                                        alignItems: "center",
                                                        transition: "color 0.2s",
                                                    }}
                                                    onMouseEnter={(e) => { e.currentTarget.style.color = "#ef4444"; }}
                                                    onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}
                                                >
                                                    <Trash2 style={{ width: 13, height: 13 }} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Main Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        {!activeSession ? (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    paddingTop: 96,
                                    paddingBottom: 96,
                                }}
                            >
                                <div
                                    className="animate-pulse-glow"
                                    style={{
                                        width: 80,
                                        height: 80,
                                        borderRadius: 16,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        marginBottom: 24,
                                        background: "var(--surface)",
                                        border: "1px solid var(--border)",
                                    }}
                                >
                                    <Sparkles style={{ width: 32, height: 32, color: "var(--primary)" }} />
                                </div>
                                <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8, color: "var(--text-primary)" }}>
                                    Select or create a session
                                </h2>
                                <p style={{ fontSize: 14, marginBottom: 24, color: "var(--text-secondary)" }}>
                                    Upload your Purchase Register and GSTR-2B to begin reconciliation
                                </p>
                                <button
                                    onClick={handleNewSessionClick}
                                    style={{
                                        padding: "12px 24px",
                                        borderRadius: 12,
                                        color: "white",
                                        fontWeight: 500,
                                        fontSize: 14,
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 8,
                                        border: "none",
                                        cursor: "pointer",
                                        background: "var(--gradient-primary)",
                                    }}
                                >
                                    <Plus style={{ width: 16, height: 16 }} /> New Session
                                </button>
                            </motion.div>
                        ) : (
                            <motion.div
                                key={activeSession.id}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.3 }}
                            >
                                {/* Session Header */}
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        marginBottom: 24,
                                    }}
                                >
                                    <div>
                                        <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)" }}>
                                            {activeSession.name || "Untitled Session"}
                                        </h1>
                                        {activeSession.period && (
                                            <p style={{ fontSize: 14, marginTop: 4, color: "var(--text-secondary)" }}>
                                                Period: {activeSession.period}
                                            </p>
                                        )}
                                    </div>
                                    <div style={{ display: "flex", gap: 12 }}>
                                        {summary && summary.total > 0 && (
                                            <button
                                                onClick={exportReport}
                                                style={{
                                                    padding: "10px 16px",
                                                    borderRadius: 12,
                                                    fontSize: 14,
                                                    fontWeight: 500,
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 8,
                                                    background: "var(--surface)",
                                                    border: "1px solid var(--border)",
                                                    color: "var(--text-primary)",
                                                    cursor: "pointer",
                                                }}
                                            >
                                                <Download style={{ width: 16, height: 16 }} /> Export Excel
                                            </button>
                                        )}
                                        <button
                                            onClick={runReconciliation}
                                            disabled={
                                                reconciling ||
                                                activeSession._count.purchaseInvoices === 0 ||
                                                activeSession._count.gstr2bInvoices === 0
                                            }
                                            style={{
                                                padding: "10px 20px",
                                                borderRadius: 12,
                                                color: "white",
                                                fontSize: 14,
                                                fontWeight: 600,
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 8,
                                                border: "none",
                                                cursor:
                                                    reconciling ||
                                                        activeSession._count.purchaseInvoices === 0 ||
                                                        activeSession._count.gstr2bInvoices === 0
                                                        ? "not-allowed"
                                                        : "pointer",
                                                background: "var(--gradient-primary)",
                                                boxShadow: "0 4px 20px rgba(28,151,25,0.3)",
                                                opacity:
                                                    reconciling ||
                                                        activeSession._count.purchaseInvoices === 0 ||
                                                        activeSession._count.gstr2bInvoices === 0
                                                        ? 0.4
                                                        : 1,
                                            }}
                                        >
                                            {reconciling ? (
                                                <Loader2
                                                    style={{ width: 16, height: 16, animation: "spin 1s linear infinite" }}
                                                />
                                            ) : (
                                                <Activity style={{ width: 16, height: 16 }} />
                                            )}
                                            {reconciling ? "Processing..." : "Run Reconciliation"}
                                        </button>
                                    </div>
                                </div>

                                {/* Upload Section */}
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 32 }}>
                                    <UploadZone
                                        label="Purchase Register"
                                        type="purchase"
                                        count={activeSession._count.purchaseInvoices}
                                        isUploading={uploading === "purchase"}
                                        onDrop={(file) => handleFileUpload(file, "purchase")}
                                    />
                                    <UploadZone
                                        label="GSTR-2B"
                                        type="gstr2b"
                                        count={activeSession._count.gstr2bInvoices}
                                        isUploading={uploading === "gstr2b"}
                                        onDrop={(file) => handleFileUpload(file, "gstr2b")}
                                    />
                                </div>

                                {/* Results Section */}
                                {summary && summary.total > 0 && (
                                    <>
                                        {/* Summary Cards */}
                                        <div
                                            style={{
                                                display: "grid",
                                                gridTemplateColumns: "repeat(5, 1fr)",
                                                gap: 16,
                                                marginBottom: 32,
                                            }}
                                        >
                                            <SummaryCard
                                                label="Total Invoices"
                                                value={summary.total}
                                                icon={<FileSpreadsheet style={{ width: 20, height: 20 }} />}
                                                color="var(--text-primary)"
                                            />
                                            <SummaryCard
                                                label="Matched"
                                                value={summary.matched}
                                                icon={<CheckCircle2 style={{ width: 20, height: 20 }} />}
                                                color="#1C9719"
                                            />
                                            <SummaryCard
                                                label="Missing in 2B"
                                                value={summary.missingIn2B}
                                                icon={<XCircle style={{ width: 20, height: 20 }} />}
                                                color="#BE3A1F"
                                            />
                                            <SummaryCard
                                                label="Amount Mismatch"
                                                value={summary.amountMismatch}
                                                icon={<AlertTriangle style={{ width: 20, height: 20 }} />}
                                                color="#E8A317"
                                            />
                                            <SummaryCard
                                                label="ITC at Risk"
                                                value={`₹${summary.totalItcAtRisk.toLocaleString("en-IN", {
                                                    minimumFractionDigits: 2,
                                                })}`}
                                                icon={<IndianRupee style={{ width: 20, height: 20 }} />}
                                                color="#f87171"
                                                highlight
                                            />
                                        </div>

                                        {/* Charts */}
                                        <div
                                            style={{
                                                display: "grid",
                                                gridTemplateColumns: "1fr 1fr",
                                                gap: 16,
                                                marginBottom: 32,
                                            }}
                                        >
                                            <div
                                                style={{
                                                    padding: 24,
                                                    borderRadius: 12,
                                                    background: "var(--surface)",
                                                    border: "1px solid var(--border)",
                                                }}
                                            >
                                                <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 16, color: "var(--text-secondary)" }}>
                                                    Status Distribution
                                                </h3>
                                                <ResponsiveContainer width="100%" height={200}>
                                                    <PieChart>
                                                        <Pie
                                                            data={pieData}
                                                            cx="50%"
                                                            cy="50%"
                                                            innerRadius={55}
                                                            outerRadius={80}
                                                            paddingAngle={3}
                                                            dataKey="value"
                                                        >
                                                            {pieData.map((entry, i) => (
                                                                <Cell key={i} fill={entry.color} />
                                                            ))}
                                                        </Pie>
                                                        <Tooltip
                                                            contentStyle={{
                                                                background: "#1a201a",
                                                                border: "1px solid #2a362a",
                                                                borderRadius: 8,
                                                                color: "#E2E8E4",
                                                            }}
                                                        />
                                                    </PieChart>
                                                </ResponsiveContainer>
                                                <div
                                                    style={{
                                                        display: "flex",
                                                        flexWrap: "wrap",
                                                        gap: 12,
                                                        marginTop: 8,
                                                        justifyContent: "center",
                                                    }}
                                                >
                                                    {pieData.map((d, i) => (
                                                        <div
                                                            key={i}
                                                            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}
                                                        >
                                                            <div
                                                                style={{
                                                                    width: 10,
                                                                    height: 10,
                                                                    borderRadius: "50%",
                                                                    background: d.color,
                                                                }}
                                                            />
                                                            <span style={{ color: "var(--text-secondary)" }}>
                                                                {d.name} ({d.value})
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            <div
                                                style={{
                                                    padding: 24,
                                                    borderRadius: 12,
                                                    background: "var(--surface)",
                                                    border: "1px solid var(--border)",
                                                }}
                                            >
                                                <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 16, color: "var(--text-secondary)" }}>
                                                    Reconciliation Breakdown
                                                </h3>
                                                <ResponsiveContainer width="100%" height={220}>
                                                    <BarChart data={barData}>
                                                        <XAxis
                                                            dataKey="name"
                                                            tick={{ fill: "#5C5E5F", fontSize: 11 }}
                                                            axisLine={false}
                                                            tickLine={false}
                                                        />
                                                        <YAxis
                                                            tick={{ fill: "#5C5E5F", fontSize: 11 }}
                                                            axisLine={false}
                                                            tickLine={false}
                                                        />
                                                        <Tooltip
                                                            contentStyle={{
                                                                background: "#1a201a",
                                                                border: "1px solid #2a362a",
                                                                borderRadius: 8,
                                                                color: "#E2E8E4",
                                                            }}
                                                        />
                                                        <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                                                            {barData.map((entry, i) => (
                                                                <Cell key={i} fill={entry.fill} />
                                                            ))}
                                                        </Bar>
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </div>

                                        {/* Results Table */}
                                        <div
                                            style={{
                                                borderRadius: 12,
                                                overflow: "hidden",
                                                background: "var(--surface)",
                                                border: "1px solid var(--border)",
                                            }}
                                        >
                                            {/* Filters */}
                                            <div
                                                style={{
                                                    padding: "16px 24px",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 12,
                                                    borderBottom: "1px solid var(--border)",
                                                    flexWrap: "wrap",
                                                }}
                                            >
                                                <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)" }}>
                                                    Filter:
                                                </span>
                                                {["ALL", "MATCHED", "MISSING_IN_2B", "AMOUNT_MISMATCH", "MISSING_IN_BOOKS"].map(
                                                    (status) => (
                                                        <button
                                                            key={status}
                                                            onClick={() => setStatusFilter(status)}
                                                            style={{
                                                                padding: "6px 12px",
                                                                borderRadius: 8,
                                                                fontSize: 12,
                                                                fontWeight: 500,
                                                                cursor: "pointer",
                                                                border:
                                                                    statusFilter === status
                                                                        ? "1px solid transparent"
                                                                        : "1px solid var(--border)",
                                                                background:
                                                                    statusFilter === status
                                                                        ? status === "ALL"
                                                                            ? "var(--primary)"
                                                                            : STATUS_CONFIG[status]?.color || "var(--primary)"
                                                                        : "transparent",
                                                                color: statusFilter === status ? "white" : "var(--text-secondary)",
                                                            }}
                                                        >
                                                            {status === "ALL"
                                                                ? `All (${results.length})`
                                                                : `${STATUS_CONFIG[status]?.label} (${results.filter((r) => r.status === status).length
                                                                })`}
                                                        </button>
                                                    )
                                                )}
                                            </div>

                                            {/* Table */}
                                            <div style={{ overflowX: "auto" }}>
                                                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                                    <thead>
                                                        <tr style={{ borderBottom: "1px solid var(--border)" }}>
                                                            {["Invoice No", "Supplier GSTIN", "Books GST", "2B GST", "Status", "Remark"].map(
                                                                (h) => (
                                                                    <th
                                                                        key={h}
                                                                        style={{
                                                                            padding: "12px 24px",
                                                                            textAlign: "left",
                                                                            fontSize: 11,
                                                                            fontWeight: 600,
                                                                            textTransform: "uppercase",
                                                                            letterSpacing: "0.05em",
                                                                            color: "var(--text-muted)",
                                                                        }}
                                                                    >
                                                                        {h}
                                                                    </th>
                                                                )
                                                            )}
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {filteredResults.map((r, idx) => {
                                                            const config = STATUS_CONFIG[r.status];
                                                            return (
                                                                <tr
                                                                    key={r.id || `row-${idx}`}
                                                                    style={{ borderBottom: "1px solid var(--border)" }}
                                                                >
                                                                    <td
                                                                        style={{
                                                                            padding: "16px 24px",
                                                                            fontSize: 14,
                                                                            fontFamily: "'JetBrains Mono', monospace",
                                                                            fontWeight: 500,
                                                                            color: "var(--text-primary)",
                                                                        }}
                                                                    >
                                                                        {r.invoiceNo}
                                                                    </td>
                                                                    <td
                                                                        style={{
                                                                            padding: "16px 24px",
                                                                            fontSize: 14,
                                                                            fontFamily: "'JetBrains Mono', monospace",
                                                                            color: "var(--text-secondary)",
                                                                        }}
                                                                    >
                                                                        {r.supplierGstin}
                                                                    </td>
                                                                    <td
                                                                        style={{
                                                                            padding: "16px 24px",
                                                                            fontSize: 14,
                                                                            fontFamily: "'JetBrains Mono', monospace",
                                                                            color: "var(--text-primary)",
                                                                        }}
                                                                    >
                                                                        {r.booksGst != null
                                                                            ? `₹${r.booksGst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
                                                                            : "—"}
                                                                    </td>
                                                                    <td
                                                                        style={{
                                                                            padding: "16px 24px",
                                                                            fontSize: 14,
                                                                            fontFamily: "'JetBrains Mono', monospace",
                                                                            color: "var(--text-primary)",
                                                                        }}
                                                                    >
                                                                        {r.gstr2bGst != null
                                                                            ? `₹${r.gstr2bGst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
                                                                            : "—"}
                                                                    </td>
                                                                    <td style={{ padding: "16px 24px" }}>
                                                                        <span
                                                                            style={{
                                                                                display: "inline-flex",
                                                                                alignItems: "center",
                                                                                gap: 6,
                                                                                padding: "4px 10px",
                                                                                borderRadius: 8,
                                                                                fontSize: 12,
                                                                                fontWeight: 500,
                                                                                background: config?.bg,
                                                                                color: config?.color,
                                                                            }}
                                                                        >
                                                                            {config?.icon}
                                                                            {config?.label}
                                                                        </span>
                                                                    </td>
                                                                    <td
                                                                        style={{
                                                                            padding: "16px 24px",
                                                                            fontSize: 12,
                                                                            maxWidth: 300,
                                                                            overflow: "hidden",
                                                                            textOverflow: "ellipsis",
                                                                            whiteSpace: "nowrap",
                                                                            color: "var(--text-secondary)",
                                                                        }}
                                                                    >
                                                                        {r.remark}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </motion.div>
                        )}
                    </div>
                </div>
            </div>

            {/* New Session Modal */}
            <AnimatePresence>
                {newSessionModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setNewSessionModal(false)}
                        style={{
                            position: "fixed",
                            inset: 0,
                            zIndex: 100,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: 16,
                            background: "rgba(0,0,0,0.7)",
                        }}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                width: "100%",
                                maxWidth: 440,
                                padding: 24,
                                borderRadius: 16,
                                background: "var(--surface)",
                                border: "1px solid var(--border)",
                            }}
                        >
                            <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20, color: "var(--text-primary)" }}>
                                New Reconciliation Session
                            </h3>
                            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                                <div>
                                    <label
                                        style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6, color: "var(--text-secondary)" }}
                                    >
                                        Session Name
                                    </label>
                                    <input
                                        value={newSessionName}
                                        onChange={(e) => setNewSessionName(e.target.value)}
                                        placeholder="e.g., Client ABC Jan 2024"
                                        style={{
                                            width: "100%",
                                            padding: "12px 16px",
                                            borderRadius: 12,
                                            fontSize: 14,
                                            background: "var(--bg-dark)",
                                            border: "1px solid var(--border)",
                                            color: "var(--text-primary)",
                                            outline: "none",
                                        }}
                                    />
                                </div>
                                <div>
                                    <label
                                        style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6, color: "var(--text-secondary)" }}
                                    >
                                        Period (optional)
                                    </label>
                                    <input
                                        value={newSessionPeriod}
                                        onChange={(e) => setNewSessionPeriod(e.target.value)}
                                        placeholder="e.g., Jan 2024"
                                        style={{
                                            width: "100%",
                                            padding: "12px 16px",
                                            borderRadius: 12,
                                            fontSize: 14,
                                            background: "var(--bg-dark)",
                                            border: "1px solid var(--border)",
                                            color: "var(--text-primary)",
                                            outline: "none",
                                        }}
                                    />
                                </div>
                            </div>
                            <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
                                <button
                                    onClick={() => setNewSessionModal(false)}
                                    style={{
                                        flex: 1,
                                        padding: "10px 0",
                                        borderRadius: 12,
                                        fontSize: 14,
                                        fontWeight: 500,
                                        background: "var(--bg-dark)",
                                        border: "1px solid var(--border)",
                                        color: "var(--text-secondary)",
                                        cursor: "pointer",
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={createSession}
                                    style={{
                                        flex: 1,
                                        padding: "10px 0",
                                        borderRadius: 12,
                                        fontSize: 14,
                                        fontWeight: 600,
                                        color: "white",
                                        background: "var(--gradient-primary)",
                                        border: "none",
                                        cursor: "pointer",
                                    }}
                                >
                                    Create Session
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Edit Session Modal */}
            <AnimatePresence>
                {editSessionModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setEditSessionModal(false)}
                        style={{
                            position: "fixed",
                            inset: 0,
                            zIndex: 100,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: 16,
                            background: "rgba(0,0,0,0.7)",
                        }}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                width: "100%",
                                maxWidth: 440,
                                padding: 32,
                                borderRadius: 16,
                                background: "var(--surface)",
                                border: "1px solid var(--border)",
                            }}
                        >
                            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: "var(--text-primary)" }}>
                                Edit Session
                            </h3>
                            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                <div>
                                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6, display: "block" }}>Session Name</label>
                                    <input
                                        value={editSessionName}
                                        onChange={(e) => setEditSessionName(e.target.value)}
                                        placeholder="e.g. Q1 Reconciliation"
                                        style={{
                                            width: "100%",
                                            padding: "10px 14px",
                                            borderRadius: 10,
                                            background: "var(--background)",
                                            border: "1px solid var(--border)",
                                            color: "var(--text-primary)",
                                            fontSize: 14,
                                            outline: "none",
                                        }}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6, display: "block" }}>Period</label>
                                    <input
                                        value={editSessionPeriod}
                                        onChange={(e) => setEditSessionPeriod(e.target.value)}
                                        placeholder="e.g. Jan 2024"
                                        style={{
                                            width: "100%",
                                            padding: "10px 14px",
                                            borderRadius: 10,
                                            background: "var(--background)",
                                            border: "1px solid var(--border)",
                                            color: "var(--text-primary)",
                                            fontSize: 14,
                                            outline: "none",
                                        }}
                                    />
                                </div>
                            </div>
                            <div style={{ display: "flex", gap: 12, marginTop: 20, justifyContent: "flex-end" }}>
                                <button
                                    onClick={() => setEditSessionModal(false)}
                                    style={{
                                        padding: "10px 20px",
                                        borderRadius: 10,
                                        background: "transparent",
                                        border: "1px solid var(--border)",
                                        color: "var(--text-secondary)",
                                        cursor: "pointer",
                                        fontSize: 14,
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={saveEditSession}
                                    style={{
                                        padding: "10px 20px",
                                        borderRadius: 10,
                                        background: "var(--primary)",
                                        color: "white",
                                        fontWeight: 600,
                                        border: "none",
                                        cursor: "pointer",
                                        fontSize: 14,
                                    }}
                                >
                                    Save Changes
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Trial Limit Reached Modal */}
            <AnimatePresence>
                {trialLimitModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setTrialLimitModal(false)}
                        style={{
                            position: "fixed",
                            inset: 0,
                            zIndex: 100,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: 16,
                            background: "rgba(0,0,0,0.7)",
                        }}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                width: "100%",
                                maxWidth: 440,
                                padding: 32,
                                borderRadius: 16,
                                background: "var(--surface)",
                                border: "1px solid var(--border)",
                                textAlign: "center",
                                position: "relative",
                            }}
                        >
                            <button
                                onClick={() => setTrialLimitModal(false)}
                                style={{
                                    position: "absolute",
                                    top: 16,
                                    right: 16,
                                    background: "none",
                                    border: "none",
                                    cursor: "pointer",
                                    color: "var(--text-muted)",
                                    display: "flex",
                                    alignItems: "center",
                                }}
                            >
                                <X style={{ width: 18, height: 18 }} />
                            </button>

                            <div
                                style={{
                                    width: 64,
                                    height: 64,
                                    borderRadius: 16,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    margin: "0 auto 20px",
                                    background: "rgba(232, 163, 23, 0.1)",
                                    border: "1px solid rgba(232, 163, 23, 0.3)",
                                }}
                            >
                                <Crown style={{ width: 28, height: 28, color: "#E8A317" }} />
                            </div>

                            <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: "var(--text-primary)" }}>
                                Free Trial Complete
                            </h3>
                            <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 24, lineHeight: 1.6 }}>
                                You&apos;ve used all {trialLimit} free reconciliation sessions.
                                Upgrade to a paid plan for unlimited sessions, priority support, and more.
                            </p>

                            <div
                                style={{
                                    padding: 16,
                                    borderRadius: 12,
                                    background: "rgba(28, 151, 25, 0.05)",
                                    border: "1px solid rgba(28, 151, 25, 0.2)",
                                    marginBottom: 24,
                                }}
                            >
                                <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 8 }}>Plan includes:</p>
                                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                    {["Unlimited reconciliation sessions", "Priority email support", "Advanced export options"].map((item, i) => (
                                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-primary)" }}>
                                            <CheckCircle2 style={{ width: 14, height: 14, color: "var(--primary)", flexShrink: 0 }} />
                                            {item}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <button
                                onClick={() => {
                                    // Placeholder for Razorpay integration
                                    alert("Payment integration coming soon! Contact us to upgrade.");
                                }}
                                style={{
                                    width: "100%",
                                    padding: "14px 0",
                                    borderRadius: 12,
                                    color: "white",
                                    fontWeight: 600,
                                    fontSize: 14,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: 8,
                                    border: "none",
                                    cursor: "pointer",
                                    background: "linear-gradient(135deg, #E8A317, #f59e0b)",
                                    boxShadow: "0 4px 20px rgba(232, 163, 23, 0.3)",
                                    transition: "transform 0.2s",
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.02)"; }}
                                onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                            >
                                <Crown style={{ width: 16, height: 16 }} />
                                Upgrade Now
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <style jsx global>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
        </div >
    );
}

/* ─── Sub Components ──────────────────────────────────────── */

function UploadZone({
    label,
    count,
    isUploading,
    onDrop,
}: {
    label: string;
    type: "purchase" | "gstr2b";
    count: number;
    isUploading: boolean;
    onDrop: (file: File) => void;
}) {
    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop: (files) => files[0] && onDrop(files[0]),
        accept: {
            "text/csv": [".csv"],
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
            "application/vnd.ms-excel": [".xls"],
        },
        multiple: false,
        disabled: isUploading,
    });

    return (
        <div
            {...getRootProps()}
            style={{
                padding: 24,
                borderRadius: 12,
                textAlign: "center",
                cursor: isUploading ? "not-allowed" : "pointer",
                transition: "all 0.2s",
                background: isDragActive ? "rgba(28,151,25,0.05)" : "var(--surface)",
                border: `2px dashed ${isDragActive ? "var(--primary)" : count > 0 ? "var(--primary)" : "var(--border)"}`,
            }}
        >
            <input {...getInputProps()} />
            {isUploading ? (
                <Loader2
                    style={{
                        width: 32,
                        height: 32,
                        margin: "0 auto 12px",
                        color: "var(--primary)",
                        animation: "spin 1s linear infinite",
                    }}
                />
            ) : count > 0 ? (
                <CheckCircle2
                    style={{ width: 32, height: 32, margin: "0 auto 12px", color: "var(--primary)" }}
                />
            ) : (
                <Upload
                    style={{ width: 32, height: 32, margin: "0 auto 12px", color: "var(--text-muted)" }}
                />
            )}
            <p style={{ fontWeight: 600, fontSize: 14, marginBottom: 4, color: "var(--text-primary)" }}>
                {label}
            </p>
            <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                {isUploading
                    ? "Processing..."
                    : count > 0
                        ? `${count} invoices loaded · Drop to re-upload`
                        : "Drop CSV or Excel file here"}
            </p>
        </div>
    );
}

function SummaryCard({
    label,
    value,
    icon,
    color,
    highlight,
}: {
    label: string;
    value: number | string;
    icon: React.ReactNode;
    color: string;
    highlight?: boolean;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
                padding: 20,
                borderRadius: 12,
                background: highlight ? "rgba(190,58,31,0.05)" : "var(--surface)",
                border: `1px solid ${highlight ? "rgba(190,58,31,0.3)" : "var(--border)"}`,
            }}
        >
            <div style={{ marginBottom: 12, color }}>{icon}</div>
            <p
                style={{
                    fontSize: 24,
                    fontWeight: 700,
                    fontFamily: "'JetBrains Mono', monospace",
                    color,
                }}
            >
                {value}
            </p>
            <p style={{ fontSize: 12, marginTop: 4, color: "var(--text-muted)" }}>{label}</p>
        </motion.div>
    );
}
