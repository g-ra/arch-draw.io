import { useState } from "react";

interface Props {
  onLogin: (user: { id: string; name: string; email: string }) => void;
}

export function LoginPage({ onLogin }: Props) {
  const [email, setEmail] = useState("dev@techflow.io");
  const [name, setName] = useState("Dev User");

  const handleDevLogin = async () => {
    const res = await fetch("/api/auth/dev-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, name }),
    });
    if (res.ok) {
      const { user } = await res.json();
      onLogin(user);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f1117]">
      <div className="w-full max-w-md p-8 rounded-2xl border border-[#2d3148] bg-[#1a1d2e]">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-white mb-2">TechFlow</h1>
          <p className="text-slate-400">Architecture Diagrams & Data Flow</p>
        </div>

        {/* GitHub OAuth */}
        <a
          href="/api/auth/github"
          className="flex items-center justify-center gap-3 w-full py-3 px-4 rounded-lg bg-white text-gray-900 font-medium hover:bg-gray-100 transition-colors mb-4"
        >
          <GithubIcon />
          Continue with GitHub
        </a>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[#2d3148]" />
          </div>
          <div className="relative flex justify-center text-xs text-slate-500">
            <span className="px-2 bg-[#1a1d2e]">or dev login</span>
          </div>
        </div>

        {/* Dev login */}
        <div className="space-y-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            className="w-full px-4 py-2.5 rounded-lg bg-[#0f1117] border border-[#2d3148] text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full px-4 py-2.5 rounded-lg bg-[#0f1117] border border-[#2d3148] text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
          <button
            onClick={handleDevLogin}
            className="w-full py-2.5 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-500 transition-colors"
          >
            Dev Login
          </button>
        </div>
      </div>
    </div>
  );
}

function GithubIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}
