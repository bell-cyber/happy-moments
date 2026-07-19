"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function SignUpPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus("loading");
    setMessage("");

    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }

    if (data.session) {
      router.push("/home");
      return;
    }

    setStatus("success");
    setMessage("가입 확인 메일을 보냈어요. 메일함을 확인해주세요.");
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm rounded-3xl border border-[#F0E2D3] bg-white p-8 shadow-sm">
        <div className="mb-8 text-center">
          <h1 className="text-lg font-semibold text-[#3A2F2A]">
            우리들의 행복한 순간
          </h1>
          <p className="mt-2 text-sm text-[#6B5C53]">
            오늘의 행복을 기록해보세요
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="email"
            required
            placeholder="you@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11 rounded-xl border border-[#F0E2D3] bg-[#FFF8EF] px-4 text-sm text-[#3A2F2A] outline-none focus:border-[#CCFF00]"
          />
          <input
            type="password"
            required
            minLength={6}
            placeholder="비밀번호 (6자 이상)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-11 rounded-xl border border-[#F0E2D3] bg-[#FFF8EF] px-4 text-sm text-[#3A2F2A] outline-none focus:border-[#CCFF00]"
          />
          <button
            type="submit"
            disabled={status === "loading"}
            className="mt-2 h-11 rounded-full bg-[#CCFF00] text-sm font-semibold text-[#24330F] transition hover:bg-[#B8E600] disabled:opacity-60"
          >
            {status === "loading" ? "가입 중..." : "가입하기"}
          </button>
        </form>

        {message && (
          <p
            className={`mt-4 text-center text-sm ${
              status === "error" ? "text-red-500" : "text-[#3A2F2A]"
            }`}
          >
            {message}
          </p>
        )}

        <p className="mt-6 text-center text-xs text-[#6B5C53]">
          이미 계정이 있나요?{" "}
          <a href="/login" className="underline">
            로그인
          </a>
        </p>
      </div>
    </div>
  );
}
