"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

function startOfWeek(d) {
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function weekLabel(dateStr) {
  const thisMonday = startOfWeek(new Date());
  const itemMonday = startOfWeek(new Date(dateStr));
  const diffWeeks = Math.round(
    (thisMonday - itemMonday) / (7 * 24 * 60 * 60 * 1000)
  );
  if (diffWeeks === 0) return "이번 주";
  if (diffWeeks === 1) return "지난 주";
  return `${diffWeeks}주 전`;
}

function groupByWeek(moments) {
  const groups = [];
  for (const m of moments) {
    const label = weekLabel(m.captured_at);
    let group = groups.find((g) => g.label === label);
    if (!group) {
      group = { label, items: [] };
      groups.push(group);
    }
    group.items.push(m);
  }
  return groups;
}

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [moments, setMoments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        router.push("/login");
        return;
      }
      setUser(session.user);

      const { data } = await supabase
        .from("moments")
        .select("*")
        .eq("user_id", session.user.id)
        .order("captured_at", { ascending: false });

      setMoments(data || []);
      setLoading(false);
    });
  }, [router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (!user) {
    return null;
  }

  const filtered = moments.filter(
    (m) => !search.trim() || m.caption?.includes(search.trim())
  );
  const groups = groupByWeek(filtered);

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-4 px-4 py-8">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-full bg-[#CCFF00]" />
        <p className="text-sm font-semibold text-[#3A2F2A]">
          {user.email.split("@")[0]}님의 기록
        </p>
      </div>

      <input
        type="text"
        placeholder="기록한 한 줄에서 검색"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="h-10 rounded-xl border border-[#F0E2D3] bg-[#FFF8EF] px-4 text-sm text-[#3A2F2A] outline-none focus:border-[#CCFF00]"
      />

      {loading ? (
        <p className="py-12 text-center text-sm text-[#6B5C53]">
          불러오는 중...
        </p>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-sm text-[#6B5C53]">
            아직 기록한 행복한 순간이 없어요
          </p>
          <a
            href="/upload"
            className="rounded-full bg-[#CCFF00] px-5 py-2 text-sm font-semibold text-[#24330F]"
          >
            첫 기록 남기기
          </a>
        </div>
      ) : (
        groups.map((g) => (
          <div key={g.label} className="flex flex-col gap-2">
            <p className="text-xs text-[#6B5C53]">{g.label}</p>
            <div className="grid grid-cols-3 gap-1.5">
              {g.items.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelected(m)}
                  className="aspect-square overflow-hidden rounded-lg bg-[#FFF8EF]"
                >
                  {m.media_type === "video" ? (
                    <video
                      src={m.media_url}
                      muted
                      playsInline
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <img
                      src={m.media_url}
                      alt={m.caption || ""}
                      className="h-full w-full object-cover"
                    />
                  )}
                </button>
              ))}
            </div>
          </div>
        ))
      )}

      <a
        href="/upload"
        className="mt-4 flex h-11 items-center justify-center rounded-full bg-[#CCFF00] text-sm font-semibold text-[#24330F] transition hover:bg-[#B8E600]"
      >
        오늘의 행복 기록하기
      </a>
      <button
        onClick={handleLogout}
        className="h-11 rounded-full border border-[#F0E2D3] text-sm text-[#3A2F2A] transition hover:bg-[#FFF8EF]"
      >
        로그아웃
      </button>

      {selected && (
        <div
          onClick={() => setSelected(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm overflow-hidden rounded-2xl bg-white"
          >
            <div className="relative bg-black">
              {selected.media_type === "video" ? (
                <video
                  src={selected.media_url}
                  controls
                  autoPlay
                  playsInline
                  className="max-h-[70vh] w-full"
                />
              ) : (
                <img
                  src={selected.media_url}
                  alt={selected.caption || ""}
                  className="max-h-[70vh] w-full object-contain"
                />
              )}
              <button
                onClick={() => setSelected(null)}
                aria-label="닫기"
                className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white"
              >
                ×
              </button>
            </div>
            <div className="flex flex-col gap-2 p-4">
              {selected.caption && (
                <p className="text-sm text-[#3A2F2A]">{selected.caption}</p>
              )}
              <div className="flex flex-wrap gap-1.5">
                {(selected.tags || []).map((t) => (
                  <span
                    key={t}
                    className="rounded-full bg-[#FFF8EF] px-2 py-0.5 text-xs text-[#6B5C53]"
                  >
                    {t}
                  </span>
                ))}
              </div>
              <p className="text-xs text-[#B4A99C]">{selected.captured_at}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
