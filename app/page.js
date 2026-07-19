"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const EMAIL_DOMAINS = [
  "gmail.com",
  "naver.com",
  "daum.net",
  "kakao.com",
  "nate.com",
  "hanmail.net",
  "icloud.com",
  "직접입력",
];

const SLOT_COUNT = 8;

const CLOVER_LEAF =
  "M0,0 L-13.3,-13 C-19,-19 -15,-28 -7,-28 C-3,-28 0,-25.5 0,-22.5 C0,-25.5 3,-28 7,-28 C15,-28 19,-19 13.3,-13 Z";
const CURSOR_SIZE = 24;

function CloverCursor({ x, y, visible }) {
  return (
    <svg
      aria-hidden="true"
      width={CURSOR_SIZE}
      height={CURSOR_SIZE}
      viewBox="0 0 60 60"
      style={{
        position: "fixed",
        left: 0,
        top: 0,
        pointerEvents: "none",
        zIndex: 9999,
        opacity: visible ? 1 : 0,
        transform: `translate(${x - CURSOR_SIZE / 2}px, ${
          y - CURSOR_SIZE / 2
        }px)`,
        transition: "transform 0.1s ease-out, opacity 0.15s ease-out",
      }}
    >
      <g transform="translate(30,30)" fill="#CCFF00">
        <path d={CLOVER_LEAF} transform="rotate(0)" />
        <path d={CLOVER_LEAF} transform="rotate(120)" />
        <path d={CLOVER_LEAF} transform="rotate(240)" />
      </g>
    </svg>
  );
}

export default function SubmissionPage() {
  const [cursorPos, setCursorPos] = useState({ x: -100, y: -100 });
  const [cursorVisible, setCursorVisible] = useState(false);

  useEffect(() => {
    function handleMove(e) {
      setCursorPos({ x: e.clientX, y: e.clientY });
      setCursorVisible(true);
    }
    function handleLeave() {
      setCursorVisible(false);
    }
    window.addEventListener("mousemove", handleMove);
    document.documentElement.addEventListener("mouseleave", handleLeave);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      document.documentElement.removeEventListener("mouseleave", handleLeave);
    };
  }, []);

  const [emailId, setEmailId] = useState("");
  const [emailDomain, setEmailDomain] = useState(EMAIL_DOMAINS[0]);
  const [emailDomainCustom, setEmailDomainCustom] = useState("");

  const [form, setForm] = useState({
    name: "",
    birthYear: "",
    instagram: "",
    occupation: "",
    song: "",
  });
  const [slotFiles, setSlotFiles] = useState(Array(SLOT_COUNT).fill(null));
  const [slotPreviews, setSlotPreviews] = useState(
    Array(SLOT_COUNT).fill(null)
  );
  const [stories, setStories] = useState(Array(SLOT_COUNT).fill(""));
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSlotFileChange(index, e) {
    const f = e.target.files?.[0] || null;
    setSlotFiles((prev) => prev.map((v, i) => (i === index ? f : v)));
    setSlotPreviews((prev) => {
      const next = [...prev];
      if (next[index]) URL.revokeObjectURL(next[index]);
      next[index] = f ? URL.createObjectURL(f) : null;
      return next;
    });
  }

  function updateStory(index, value) {
    setStories((prev) => prev.map((v, i) => (i === index ? value : v)));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (
      !form.name.trim() ||
      !form.birthYear.trim() ||
      !form.instagram.trim() ||
      !form.occupation.trim()
    ) {
      const text = "빈 칸 없이 모두 작성해주세요.";
      setStatus("error");
      setMessage(text);
      alert(text);
      return;
    }
    if (!consent) {
      setStatus("error");
      setMessage("개인정보 및 콘텐츠 활용 동의가 필요해요.");
      alert("개인정보 및 콘텐츠 활용 동의가 필요해요.");
      return;
    }
    if (slotFiles.some((f) => !f)) {
      const text = `사진 또는 영상을 ${SLOT_COUNT}장 모두 첨부해주세요.`;
      setStatus("error");
      setMessage(text);
      alert(text);
      return;
    }
    if (stories.some((s) => !s.trim())) {
      const text = `이야기를 ${SLOT_COUNT}개 모두 적어주세요.`;
      setStatus("error");
      setMessage(text);
      alert(text);
      return;
    }

    const domain =
      emailDomain === "직접입력" ? emailDomainCustom.trim() : emailDomain;
    if (!emailId.trim() || !domain) {
      setStatus("error");
      setMessage("이메일 주소를 입력해주세요.");
      alert("이메일 주소를 입력해주세요.");
      return;
    }

    setStatus("loading");
    setMessage("");

    const folder = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const mediaUrls = [];

    for (let i = 0; i < slotFiles.length; i++) {
      const file = slotFiles[i];
      const path = `${folder}/${i + 1}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("submissions")
        .upload(path, file);

      if (uploadError) {
        setStatus("error");
        setMessage(
          "파일 업로드 중 문제가 발생했어요. 파일 용량을 줄이거나 다시 시도해주세요."
        );
        return;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("submissions").getPublicUrl(path);
      mediaUrls.push(publicUrl);
    }

    const story = stories.map((s, i) => `${i + 1}. ${s.trim()}`).join("\n");

    const { error: insertError } = await supabase.from("submissions").insert({
      email: `${emailId.trim()}@${domain}`,
      name: form.name,
      birth_year: form.birthYear,
      instagram: form.instagram,
      occupation: form.occupation,
      story,
      song: form.song || null,
      media_urls: mediaUrls,
      consent,
    });

    if (insertError) {
      setStatus("error");
      setMessage("제출 중 문제가 발생했어요. 다시 시도해주세요.");
      return;
    }

    setStatus("success");
    setMessage("소중한 이야기를 보내주셔서 감사합니다");
  }

  if (status === "success") {
    return (
      <div
        style={{ cursor: "none" }}
        className="flex flex-1 items-center justify-center px-4 py-16"
      >
        <div className="w-full max-w-md rounded-3xl border border-[#F0E2D3] bg-white p-8 text-center">
          <p className="text-base font-semibold text-[#3A2F2A]">{message}</p>
        </div>
        <CloverCursor x={cursorPos.x} y={cursorPos.y} visible={cursorVisible} />
      </div>
    );
  }

  return (
    <div
      style={{ cursor: "none" }}
      className="flex flex-1 flex-col items-center px-4 py-16"
    >
      <CloverCursor x={cursorPos.x} y={cursorPos.y} visible={cursorVisible} />
      <div className="w-full max-w-md">
        <h1 className="text-center text-2xl font-semibold leading-snug text-[#3A2F2A]">
          행복한 순간을 함께 기록해 주세요
        </h1>

        <div className="mt-6 space-y-3 text-sm leading-relaxed text-[#6B5C53]">
          <p>
            안녕하세요, 저희는 &apos;세상에 존재하는 다양한 행복의 모습을
            기록하는 집단 다이어리&apos; 프로젝트를 운영하고 있습니다.
          </p>
          <p>
            각자의 행복한 순간을 사진과 영상으로 기록하고, 서로의 이야기를
            공유하며 더 큰 행복을 만들어가고자 시작한 프로젝트입니다.
          </p>
          <p>
            평소 기록해두신 사진이나 영상 속 최근 행복했던 순간, 또는
            소소하지만 오래 기억에 남는 행복한 순간을 함께 나눠주세요.
          </p>
          <p>
            소중한 기록은 &apos;Our Happy Moments&apos; 콘텐츠로 소개될
            예정입니다.
          </p>
          <p>참여해주셔서 감사합니다.</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-10 flex flex-col gap-5">
          <Field label="이메일 주소">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={emailId}
                onChange={(e) => setEmailId(e.target.value)}
                className="h-11 min-w-0 flex-1 rounded-xl border border-[#F0E2D3] bg-[#FFF8EF] px-4 text-sm text-[#3A2F2A] outline-none focus:border-[#CCFF00]"
              />
              <span className="text-sm text-[#6B5C53]">@</span>
              <select
                value={emailDomain}
                onChange={(e) => setEmailDomain(e.target.value)}
                className="h-11 rounded-xl border border-[#F0E2D3] bg-[#FFF8EF] px-3 text-sm text-[#3A2F2A] outline-none focus:border-[#CCFF00]"
              >
                {EMAIL_DOMAINS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            {emailDomain === "직접입력" && (
              <input
                type="text"
                placeholder="도메인을 입력해주세요 (예: mycompany.com)"
                value={emailDomainCustom}
                onChange={(e) => setEmailDomainCustom(e.target.value)}
                className="mt-2 h-11 w-full rounded-xl border border-[#F0E2D3] bg-[#FFF8EF] px-4 text-sm text-[#3A2F2A] outline-none focus:border-[#CCFF00]"
              />
            )}
          </Field>

          <Field label="성함이 어떻게 되세요?" hint="가명을 사용하셔도 괜찮습니다">
            <input
              type="text"
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
              className="h-11 w-full rounded-xl border border-[#F0E2D3] bg-[#FFF8EF] px-4 text-sm text-[#3A2F2A] outline-none focus:border-[#CCFF00]"
            />
          </Field>

          <Field label="출생연도를 알려주세요" hint="예: 1997년">
            <input
              type="text"
              value={form.birthYear}
              onChange={(e) => updateField("birthYear", e.target.value)}
              className="h-11 w-full rounded-xl border border-[#F0E2D3] bg-[#FFF8EF] px-4 text-sm text-[#3A2F2A] outline-none focus:border-[#CCFF00]"
            />
          </Field>

          <Field
            label="인스타그램 계정이 어떻게 되세요?"
            hint="콘텐츠 업로드 시 계정 태그 및 출처 표기를 위해 사용됩니다. 계정이 없거나 공개를 원하지 않으시면 'X'를 입력해주세요."
          >
            <input
              type="text"
              value={form.instagram}
              onChange={(e) => updateField("instagram", e.target.value)}
              className="h-11 w-full rounded-xl border border-[#F0E2D3] bg-[#FFF8EF] px-4 text-sm text-[#3A2F2A] outline-none focus:border-[#CCFF00]"
            />
          </Field>

          <Field
            label="현재 어떤 일을 하고 계신가요?"
            hint="디자이너, 자영업, 육아, 취업 준비 등 편하게 적어주세요."
          >
            <input
              type="text"
              value={form.occupation}
              onChange={(e) => updateField("occupation", e.target.value)}
              className="h-11 w-full rounded-xl border border-[#F0E2D3] bg-[#FFF8EF] px-4 text-sm text-[#3A2F2A] outline-none focus:border-[#CCFF00]"
            />
          </Field>

          <Field
            label={`행복했던 순간을 담은 사진 또는 영상 ${SLOT_COUNT}장을 순서대로 올려주세요`}
            hint="사진/영상 순번과 아래 이야기 순번이 짝지어져요."
          >
            <div className="flex flex-col gap-4">
              {Array.from({ length: SLOT_COUNT }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-[#F0E2D3] bg-[#FFF8EF] p-3"
                >
                  <p className="mb-2 text-xs font-semibold text-[#3A2F2A]">
                    {i + 1}번째 순간
                  </p>
                  <div className="flex gap-3">
                    <label className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white text-xs text-[#B4A99C]">
                      {slotPreviews[i] ? (
                        slotFiles[i]?.type.startsWith("video/") ? (
                          <video
                            src={slotPreviews[i]}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <img
                            src={slotPreviews[i]}
                            className="h-full w-full object-cover"
                            alt=""
                          />
                        )
                      ) : (
                        <span className="text-center leading-tight">
                          사진/영상
                          <br />
                          선택하기
                        </span>
                      )}
                      <input
                        type="file"
                        accept="image/*,video/*"
                        onChange={(e) => handleSlotFileChange(i, e)}
                        className="hidden"
                      />
                    </label>
                    <textarea
                      rows={4}
                      placeholder="이 순간은 어떤 행복한 순간이였나요?"
                      value={stories[i]}
                      onChange={(e) => updateStory(i, e.target.value)}
                      className="h-24 flex-1 rounded-xl border border-[#F0E2D3] bg-white px-3 pt-8 pb-2 text-center text-sm leading-tight text-[#3A2F2A] outline-none focus:border-[#CCFF00] placeholder:text-xs placeholder:leading-tight placeholder:text-[#B4A99C]"
                    />
                  </div>
                </div>
              ))}
            </div>
          </Field>

          <Field
            label="행복한 순간 듣고 싶은 노래가 있다면 알려주세요"
            hint="곡명과 아티스트를 함께 적어주세요. (선택)"
          >
            <input
              type="text"
              value={form.song}
              onChange={(e) => updateField("song", e.target.value)}
              className="h-11 w-full rounded-xl border border-[#F0E2D3] bg-[#FFF8EF] px-4 text-sm text-[#3A2F2A] outline-none focus:border-[#CCFF00]"
            />
          </Field>

          <label className="flex items-start gap-2 text-sm text-[#3A2F2A]">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-1"
            />
            개인정보 및 콘텐츠 활용에 동의합니다
          </label>

          <button
            type="submit"
            disabled={status === "loading"}
            className="mt-2 h-12 rounded-full bg-[#CCFF00] text-sm font-semibold text-[#24330F] transition hover:bg-[#B8E600] disabled:opacity-60"
          >
            {status === "loading" ? "제출 중..." : "제출하기"}
          </button>

          {message && status === "error" && (
            <p className="text-center text-sm text-red-500">{message}</p>
          )}
        </form>
      </div>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-semibold text-[#3A2F2A]">{label}</p>
      {hint && <p className="mb-1.5 text-xs text-[#6B5C53]">{hint}</p>}
      {children}
    </div>
  );
}
