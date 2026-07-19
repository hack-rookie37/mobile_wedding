"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getBrowserSupabase } from "@/server/supabase/browserClient";

// 이메일·비밀번호 로그인 (Supabase Auth). 성공 시 대시보드로 이동한다.
// 공개 가입은 제공하지 않는다 — 계정은 Supabase 대시보드에서 직접 만든다 (ADR-024).
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = getBrowserSupabase();
    const result = await supabase.auth.signInWithPassword({ email, password });
    if (result.error) {
      setError(result.error.message);
      setBusy(false);
      return;
    }
    router.replace("/");
    router.refresh();
  };

  const inputClass =
    "h-9 w-full rounded-md border border-tool-border bg-white px-3 text-[14px] text-tool-ink " +
    "placeholder:text-tool-ink-faint focus:border-tool-accent focus:outline-none";

  return (
    <main className="flex min-h-dvh items-center justify-center bg-tool-bg px-6">
      <div className="w-full max-w-[360px]">
        <h1 className="text-[20px] font-semibold text-tool-ink">모바일 청첩장</h1>
        <p className="mt-1 text-[13px] text-tool-ink-soft">
          로그인하고 청첩장을 이어서 만들어 보세요.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-3">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-[12px] text-tool-ink-soft">
              이메일
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1.5 block text-[12px] text-tool-ink-soft">
              비밀번호
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="6자 이상"
              className={inputClass}
            />
          </div>
          {error !== null && (
            <p role="alert" className="text-[12px] text-tool-danger">
              로그인 실패: {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="h-9 w-full rounded-md bg-tool-ink text-[14px] font-medium text-white hover:bg-black disabled:opacity-40"
          >
            {busy ? "처리 중…" : "로그인"}
          </button>
        </form>
      </div>
    </main>
  );
}
