import { useState } from "react";

interface Props {
  onLogin: (user: { id: string; name: string; email: string }) => void;
}

type LoginState =
  | { mode: "email-input" }
  | { mode: "totp-setup"; qrCode: string; secret: string }
  | { mode: "totp-verify" }
  | { mode: "pending-activation" }
  | { mode: "error"; message: string };

export function LoginPage({ onLogin }: Props) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [state, setState] = useState<LoginState>({ mode: "email-input" });
  const [loading, setLoading] = useState(false);

  const handleContinue = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (res.ok) {
        if (data.needsSetup) {
          setState({
            mode: "totp-setup",
            qrCode: data.qrCode,
            secret: data.secret,
          });
        } else if (data.user) {
          onLogin(data.user);
        }
      } else if (res.status === 400 && data.error === "Code required") {
        setState({ mode: "totp-verify" });
      } else {
        setState({ mode: "error", message: data.error || "Login failed" });
        setTimeout(() => setState({ mode: "email-input" }), 3000);
      }
    } catch (error) {
      setState({ mode: "error", message: "Network error" });
      setTimeout(() => setState({ mode: "email-input" }), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, code }),
      });

      const data = await res.json();

      if (res.ok && data.user) {
        onLogin(data.user);
      } else if (res.status === 403 && data.status === "pending") {
        setState({ mode: "pending-activation" });
      } else {
        setState({ mode: "error", message: data.error || "Invalid code" });
        setTimeout(() => {
          if (state.mode === "totp-setup") {
            setState({ mode: "totp-setup", qrCode: (state as any).qrCode, secret: (state as any).secret });
          } else {
            setState({ mode: "totp-verify" });
          }
        }, 3000);
      }
    } catch (error) {
      setState({ mode: "error", message: "Network error" });
      setTimeout(() => setState({ mode: "totp-verify" }), 3000);
    } finally {
      setLoading(false);
      setCode("");
    }
  };

  const handleBack = () => {
    setEmail("");
    setCode("");
    setState({ mode: "email-input" });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f1117]">
      <div className="w-full max-w-md p-8 rounded-2xl border border-[#2d3148] bg-[#1a1d2e]">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-white mb-2">TechFlow</h1>
          <p className="text-slate-400">Architecture Diagrams & Data Flow</p>
        </div>

        {/* Email Input */}
        {state.mode === "email-input" && (
          <div className="space-y-3">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              type="email"
              className="w-full px-4 py-2.5 rounded-lg bg-[#0f1117] border border-[#2d3148] text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              onKeyDown={(e) => e.key === "Enter" && handleContinue()}
            />
            <button
              onClick={handleContinue}
              disabled={loading || !email}
              className="w-full py-2.5 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-500 transition-colors disabled:opacity-50"
            >
              {loading ? "Loading..." : "Continue"}
            </button>
          </div>
        )}

        {/* TOTP Setup */}
        {state.mode === "totp-setup" && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-white text-center">
              Setup Two-Factor Authentication
            </h2>
            <div className="bg-white p-4 rounded-lg">
              <img src={state.qrCode} alt="QR Code" className="w-full" />
            </div>
            <div className="text-sm text-slate-400 text-center">
              <p className="mb-2">Scan with Google Authenticator or Authy</p>
              <p className="font-mono text-xs break-all">{state.secret}</p>
            </div>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="6-digit code"
              className="w-full px-4 py-2.5 rounded-lg bg-[#0f1117] border border-[#2d3148] text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-center text-2xl tracking-widest"
              onKeyDown={(e) => e.key === "Enter" && code.length === 6 && handleVerify()}
            />
            <button
              onClick={handleVerify}
              disabled={loading || code.length !== 6}
              className="w-full py-2.5 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-500 transition-colors disabled:opacity-50"
            >
              {loading ? "Verifying..." : "Verify & Login"}
            </button>
            <button
              onClick={handleBack}
              className="w-full text-slate-400 hover:text-white text-sm"
            >
              ← Back
            </button>
          </div>
        )}

        {/* TOTP Verify */}
        {state.mode === "totp-verify" && (
          <div className="space-y-3">
            <input
              value={email}
              disabled
              className="w-full px-4 py-2.5 rounded-lg bg-[#0f1117] border border-[#2d3148] text-slate-500"
            />
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="6-digit code"
              className="w-full px-4 py-2.5 rounded-lg bg-[#0f1117] border border-[#2d3148] text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-center text-2xl tracking-widest"
              onKeyDown={(e) => e.key === "Enter" && code.length === 6 && handleVerify()}
            />
            <button
              onClick={handleVerify}
              disabled={loading || code.length !== 6}
              className="w-full py-2.5 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-500 transition-colors disabled:opacity-50"
            >
              {loading ? "Logging in..." : "Login"}
            </button>
            <button
              onClick={handleBack}
              className="w-full text-slate-400 hover:text-white text-sm"
            >
              ← Change email
            </button>
          </div>
        )}

        {/* Pending Activation */}
        {state.mode === "pending-activation" && (
          <div className="text-center space-y-4">
            <div className="text-6xl">⏳</div>
            <h2 className="text-xl font-semibold text-white">
              Account Pending Activation
            </h2>
            <p className="text-slate-400">
              Administrator will review your request
            </p>
            <button
              onClick={handleBack}
              className="w-full py-2.5 rounded-lg border border-[#2d3148] text-white hover:bg-[#2d3148] transition-colors"
            >
              ← Back to login
            </button>
          </div>
        )}

        {/* Error State */}
        {state.mode === "error" && (
          <div className="text-center space-y-4">
            <div className="text-6xl">❌</div>
            <p className="text-red-400">{state.message}</p>
          </div>
        )}
      </div>
    </div>
  );
}
