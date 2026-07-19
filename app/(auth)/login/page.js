"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus("loading");
    setMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }

    router.push("/home");
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm rounded-3xl border border-[#F0E2D3] bg-white p-8 shadow-sm">
        <div className="mb-8 text-center">
          <h1 className="text-lg font-semibold text-[#3A2F2A]">로그인</h1>
          <p className="mt-2 text-sm text-[#6B5C53]">
            다시 만나서 반가워요
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
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-11 rounded-xl border border-[#F0E2D3] bg-[#FFF8EF] px-4 text-sm text-[#3A2F2A] outline-none focus:border-[#CCFF00]"
          />
          <button
            type="submit"
            disabled={status === "loading"}
            className="mt-2 h-11 rounded-full bg-[#CCFF00] text-sm font-semibold text-[#24330F] transition hover:bg-[#B8E600] disabled:opacity-60"
          >
            {status === "loading" ? "로그인 중..." : "로그인"}
          </button>
        </form>

        {message && (
          <p className="mt-4 text-center text-sm text-red-500">{message}</p>
        )}

        <p className="mt-6 text-center text-xs text-[#6B5C53]">
          계정이 없나요?{" "}
          <a href="/signup" className="underline">
            가입하기
          </a>
        </p>
      </div>
    </div>
  );
}
