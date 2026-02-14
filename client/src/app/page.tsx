"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  ArrowRight,
  Mail,
  Lock,
  User,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  BarChart3,
} from "lucide-react";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, register, user } = useAuth();
  const router = useRouter();

  // Redirect if already logged in
  useEffect(() => {
    if (user) router.push("/dashboard");
  }, [user, router]);

  if (user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await register(email, password, name);
      }
      router.push("/dashboard");
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const features = [
    {
      icon: <FileSpreadsheet style={{ width: 20, height: 20 }} />,
      title: "Upload & Parse",
      desc: "CSV & Excel support with smart header detection",
    },
    {
      icon: <Sparkles style={{ width: 20, height: 20 }} />,
      title: "Auto Reconcile",
      desc: "Instant matching of invoices against GSTR-2B",
    },
    {
      icon: <AlertTriangle style={{ width: 20, height: 20 }} />,
      title: "ITC at Risk",
      desc: "Identify mismatches before they cost you",
    },
    {
      icon: <BarChart3 style={{ width: 20, height: 20 }} />,
      title: "Export Reports",
      desc: "Download detailed Excel reconciliation reports",
    },
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "row",
        background: "var(--bg-dark)",
      }}
    >
      {/* Left Panel - Branding */}
      <div
        style={{
          width: "50%",
          position: "relative",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "48px",
        }}
      >
        {/* Background glow */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "var(--gradient-glow)",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at 30% 80%, rgba(28,151,25,0.08), transparent 60%)",
            pointerEvents: "none",
          }}
        />

        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          style={{ position: "relative", zIndex: 10 }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "var(--gradient-primary)",
              }}
            >
              <Shield style={{ width: 20, height: 20, color: "white" }} />
            </div>
            <span
              style={{
                fontSize: 24,
                fontWeight: 700,
                letterSpacing: "-0.02em",
                color: "var(--text-primary)",
              }}
            >
              Reconova
            </span>
          </div>
        </motion.div>

        {/* Hero Text */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          style={{ position: "relative", zIndex: 10 }}
        >
          <h1
            style={{
              fontSize: 48,
              fontWeight: 700,
              lineHeight: 1.1,
              color: "var(--text-primary)",
              marginBottom: 20,
            }}
          >
            GST Reconciliation,
            <br />
            <span style={{ color: "var(--primary)" }}>Simplified.</span>
          </h1>
          <p
            style={{
              fontSize: 18,
              maxWidth: 420,
              lineHeight: 1.6,
              color: "var(--text-secondary)",
            }}
          >
            Stop losing hours on manual reconciliation. Automatically match your
            purchase register with GSTR-2B and protect your ITC.
          </p>
        </motion.div>

        {/* Features Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          style={{
            position: "relative",
            zIndex: 10,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
          }}
        >
          {features.map((f, i) => (
            <div
              key={i}
              style={{
                padding: 16,
                borderRadius: 12,
                background: "var(--surface)",
                border: "1px solid var(--border)",
              }}
            >
              <div style={{ marginBottom: 8, color: "var(--primary)" }}>
                {f.icon}
              </div>
              <h3
                style={{
                  fontWeight: 600,
                  fontSize: 13,
                  marginBottom: 4,
                  color: "var(--text-primary)",
                }}
              >
                {f.title}
              </h3>
              <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                {f.desc}
              </p>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Right Panel - Auth Form */}
      <div
        style={{
          width: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 32,
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          style={{ width: "100%", maxWidth: 420 }}
        >
          <h2
            style={{
              fontSize: 28,
              fontWeight: 700,
              marginBottom: 8,
              color: "var(--text-primary)",
            }}
          >
            {isLogin ? "Welcome back" : "Create your account"}
          </h2>
          <p style={{ marginBottom: 32, color: "var(--text-secondary)", fontSize: 15 }}>
            {isLogin
              ? "Log in to continue to your dashboard"
              : "Start reconciling your GST data in minutes"}
          </p>

          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                style={{
                  marginBottom: 24,
                  padding: 16,
                  borderRadius: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  background: "rgba(190, 58, 31, 0.1)",
                  border: "1px solid rgba(190, 58, 31, 0.3)",
                  color: "#f87171",
                  fontSize: 14,
                }}
              >
                <AlertTriangle style={{ width: 16, height: 16, flexShrink: 0 }} />
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit}>
            {!isLogin && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                style={{ marginBottom: 20 }}
              >
                <label
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 500,
                    marginBottom: 8,
                    color: "var(--text-secondary)",
                  }}
                >
                  Full Name
                </label>
                <div style={{ position: "relative" }}>
                  <User
                    style={{
                      position: "absolute",
                      left: 16,
                      top: "50%",
                      transform: "translateY(-50%)",
                      width: 16,
                      height: 16,
                      color: "var(--text-muted)",
                    }}
                  />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Doe"
                    style={{
                      width: "100%",
                      paddingLeft: 48,
                      paddingRight: 16,
                      paddingTop: 14,
                      paddingBottom: 14,
                      borderRadius: 12,
                      fontSize: 14,
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      color: "var(--text-primary)",
                      outline: "none",
                    }}
                  />
                </div>
              </motion.div>
            )}

            <div style={{ marginBottom: 20 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 500,
                  marginBottom: 8,
                  color: "var(--text-secondary)",
                }}
              >
                Email Address
              </label>
              <div style={{ position: "relative" }}>
                <Mail
                  style={{
                    position: "absolute",
                    left: 16,
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: 16,
                    height: 16,
                    color: "var(--text-muted)",
                  }}
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  style={{
                    width: "100%",
                    paddingLeft: 48,
                    paddingRight: 16,
                    paddingTop: 14,
                    paddingBottom: 14,
                    borderRadius: 12,
                    fontSize: 14,
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    color: "var(--text-primary)",
                    outline: "none",
                  }}
                />
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 500,
                  marginBottom: 8,
                  color: "var(--text-secondary)",
                }}
              >
                Password
              </label>
              <div style={{ position: "relative" }}>
                <Lock
                  style={{
                    position: "absolute",
                    left: 16,
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: 16,
                    height: 16,
                    color: "var(--text-muted)",
                  }}
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  style={{
                    width: "100%",
                    paddingLeft: 48,
                    paddingRight: 16,
                    paddingTop: 14,
                    paddingBottom: 14,
                    borderRadius: 12,
                    fontSize: 14,
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    color: "var(--text-primary)",
                    outline: "none",
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
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
                cursor: loading ? "not-allowed" : "pointer",
                background: loading
                  ? "var(--primary-light)"
                  : "var(--gradient-primary)",
                boxShadow: "0 4px 20px rgba(28, 151, 25, 0.3)",
                transition: "transform 0.2s",
                opacity: loading ? 0.6 : 1,
              }}
              onMouseEnter={(e) => {
                if (!loading) e.currentTarget.style.transform = "scale(1.02)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "scale(1)";
              }}
            >
              {loading ? (
                <div
                  style={{
                    width: 20,
                    height: 20,
                    border: "2px solid rgba(255,255,255,0.3)",
                    borderTopColor: "white",
                    borderRadius: "50%",
                    animation: "spin 0.6s linear infinite",
                  }}
                />
              ) : (
                <>
                  {isLogin ? "Sign In" : "Create Account"}
                  <ArrowRight style={{ width: 16, height: 16 }} />
                </>
              )}
            </button>
          </form>

          <div style={{ marginTop: 32, textAlign: "center" }}>
            <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
              {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
              <button
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError("");
                }}
                style={{
                  fontWeight: 600,
                  color: "var(--primary)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  textDecoration: "none",
                  fontSize: 14,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.textDecoration = "underline";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.textDecoration = "none";
                }}
              >
                {isLogin ? "Sign up" : "Sign in"}
              </button>
            </p>
          </div>

          {/* Trust Badges */}
          <div
            style={{
              marginTop: 40,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 24,
            }}
          >
            {["Secure JWT Auth", "256-bit Encryption", "GDPR Ready"].map(
              (badge, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 11,
                    color: "var(--text-muted)",
                  }}
                >
                  <CheckCircle2
                    style={{ width: 12, height: 12, color: "var(--primary)" }}
                  />
                  {badge}
                </div>
              )
            )}
          </div>
        </motion.div>
      </div>

      {/* Spinner animation */}
      <style jsx global>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
