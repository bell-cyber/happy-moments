"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const MAX_VIDEO_SECONDS = 10;

async function getCapturedDate(file) {
  if (file.type.startsWith("image/")) {
    try {
      const exifr = (await import("exifr")).default;
      const date = await exifr.parse(file, ["DateTimeOriginal"]);
      if (date?.DateTimeOriginal) {
        return date.DateTimeOriginal.toISOString().slice(0, 10);
      }
    } catch {
      // EXIF 없으면 아래 fallback으로 넘어감
    }
  }
  return new Date(file.lastModified).toISOString().slice(0, 10);
}

function getVideoDuration(file) {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      URL.revokeObjectURL(v.src);
      resolve(v.duration);
    };
    v.src = URL.createObjectURL(file);
  });
}

function trimVideo(videoEl, start, duration) {
  return new Promise((resolve, reject) => {
    if (typeof videoEl.captureStream !== "function") {
      reject(new Error("trim-unsupported"));
      return;
    }
    const stream = videoEl.captureStream();
    const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
    const chunks = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onerror = reject;
    recorder.onstop = () => {
      videoEl.muted = false;
      resolve(new Blob(chunks, { type: "video/webm" }));
    };

    videoEl.muted = true;
    const onSeeked = () => {
      videoEl.removeEventListener("seeked", onSeeked);
      recorder.start();
      videoEl.play();
      setTimeout(() => {
        videoEl.pause();
        recorder.stop();
      }, duration * 1000);
    };
    videoEl.addEventListener("seeked", onSeeked);
    videoEl.currentTime = start;
  });
}

function toKoreanError(error) {
  const msg = (error?.message || "").toLowerCase();
  if (
    msg.includes("size") ||
    msg.includes("too large") ||
    msg.includes("exceeded") ||
    msg.includes("payload")
  ) {
    return "파일 용량이 너무 커요. 영상 길이를 줄이거나 더 작은 파일로 시도해주세요.";
  }
  if (
    msg.includes("row-level security") ||
    msg.includes("permission") ||
    msg.includes("policy")
  ) {
    return "권한 문제로 저장하지 못했어요. 다시 로그인한 후 시도해주세요.";
  }
  if (msg.includes("network") || msg.includes("fetch")) {
    return "네트워크 연결을 확인하고 다시 시도해주세요.";
  }
  return "기록 중 문제가 발생했어요. 다시 시도해주세요.";
}

export default function UploadPage() {
  const router = useRouter();
  const trimVideoRef = useRef(null);
  const [user, setUser] = useState(null);
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [caption, setCaption] = useState("");
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

  const [trimSource, setTrimSource] = useState(null);
  const [trimSourceUrl, setTrimSourceUrl] = useState(null);
  const [trimDuration, setTrimDuration] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimming, setTrimming] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push("/login");
        return;
      }
      setUser(session.user);
    });
  }, [router]);

  async function handleFileChange(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setMessage("");

    if (f.type.startsWith("video/")) {
      const duration = await getVideoDuration(f);
      if (duration > MAX_VIDEO_SECONDS) {
        const canTrimHere =
          typeof document.createElement("video").captureStream === "function";
        if (canTrimHere) {
          setTrimSource(f);
          setTrimSourceUrl(URL.createObjectURL(f));
          setTrimDuration(duration);
          setTrimStart(0);
        } else {
          setMessage(
            `영상이 ${MAX_VIDEO_SECONDS}초보다 길어요. 폰 사진 앱에서 ${MAX_VIDEO_SECONDS}초 이내로 자른 후 다시 선택해주세요.`
          );
        }
        e.target.value = "";
        return;
      }
    }

    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
  }

  async function handleConfirmTrim() {
    setTrimming(true);
    try {
      const blob = await trimVideo(
        trimVideoRef.current,
        trimStart,
        MAX_VIDEO_SECONDS
      );
      const trimmedFile = new File([blob], trimSource.name.replace(/\.\w+$/, ".webm"), {
        type: "video/webm",
        lastModified: trimSource.lastModified,
      });
      setFile(trimmedFile);
      setPreviewUrl(URL.createObjectURL(trimmedFile));
      URL.revokeObjectURL(trimSourceUrl);
      setTrimSource(null);
      setTrimSourceUrl(null);
    } catch {
      setMessage(
        "이 브라우저에서는 영상 자르기가 지원되지 않아요. 폰의 사진 앱에서 미리 잘라서 올려주세요."
      );
      URL.revokeObjectURL(trimSourceUrl);
      setTrimSource(null);
      setTrimSourceUrl(null);
    } finally {
      setTrimming(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file || !user) return;

    setStatus("loading");
    setMessage("");

    const mediaType = file.type.startsWith("video/") ? "video" : "image";
    const capturedAt = await getCapturedDate(file);
    const path = `${user.id}/${Date.now()}-${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("moments")
      .upload(path, file);

    if (uploadError) {
      setStatus("error");
      setMessage(toKoreanError(uploadError));
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("moments").getPublicUrl(path);

    const { error: insertError } = await supabase.from("moments").insert({
      user_id: user.id,
      media_url: publicUrl,
      media_type: mediaType,
      caption,
      captured_at: capturedAt,
    });

    if (insertError) {
      setStatus("error");
      setMessage(toKoreanError(insertError));
      return;
    }

    setStatus("success");
    setMessage("오늘의 행복한 순간을 기록했어요!");
    setFile(null);
    setPreviewUrl(null);
    setCaption("");
    setTimeout(() => router.push("/home"), 900);
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm rounded-3xl border border-[#F0E2D3] bg-white p-8 shadow-sm">
        <div className="mb-4 flex items-center">
          <a
            href="/home"
            aria-label="뒤로가기"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FFF8EF] text-[#6B5C53] transition hover:bg-[#F0E2D3]"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </a>
        </div>

        {trimSource ? (
          <div className="flex flex-col gap-3">
            <p className="text-center text-sm font-semibold text-[#3A2F2A]">
              영상이 {MAX_VIDEO_SECONDS}초보다 길어요. 올릴 구간을
              선택해주세요
            </p>
            <video
              ref={trimVideoRef}
              src={trimSourceUrl}
              className="aspect-square w-full rounded-2xl bg-black object-contain"
              muted
              playsInline
              preload="auto"
              onLoadedMetadata={(e) => {
                e.target.currentTime = trimStart;
              }}
            />
            <input
              type="range"
              min={0}
              max={Math.max(trimDuration - MAX_VIDEO_SECONDS, 0)}
              step={0.1}
              value={trimStart}
              onChange={(e) => {
                const value = Number(e.target.value);
                setTrimStart(value);
                if (trimVideoRef.current) {
                  trimVideoRef.current.currentTime = value;
                }
              }}
            />
            <p className="text-center text-xs text-[#6B5C53]">
              {trimStart.toFixed(1)}초 ~ {(trimStart + MAX_VIDEO_SECONDS).toFixed(1)}
              초 구간이 저장돼요
            </p>
            <button
              type="button"
              disabled={trimming}
              onClick={handleConfirmTrim}
              className="h-11 rounded-full bg-[#CCFF00] text-sm font-semibold text-[#24330F] transition hover:bg-[#B8E600] disabled:opacity-60"
            >
              {trimming ? "자르는 중..." : "이 구간으로 자르기"}
            </button>
            <button
              type="button"
              onClick={() => {
                URL.revokeObjectURL(trimSourceUrl);
                setTrimSource(null);
                setTrimSourceUrl(null);
              }}
              className="h-9 rounded-full border border-[#F0E2D3] text-xs text-[#6B5C53]"
            >
              취소
            </button>
          </div>
        ) : (
          <>
            <p className="mb-6 text-center text-sm font-semibold text-[#3A2F2A]">
              오늘 행복한 순간을 기록해주세요
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <label className="flex aspect-square items-center justify-center overflow-hidden rounded-2xl bg-[#FFF8EF] text-sm text-[#B4A99C]">
                {previewUrl ? (
                  file?.type.startsWith("video/") ? (
                    <video
                      src={previewUrl}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <img
                      src={previewUrl}
                      className="h-full w-full object-cover"
                      alt=""
                    />
                  )
                ) : (
                  "사진/영상 선택하기"
                )}
                <input
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>

              <input
                type="text"
                placeholder="오늘 행복했던 한 줄"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                className="h-11 rounded-xl border border-[#F0E2D3] bg-[#FFF8EF] px-4 text-sm text-[#3A2F2A] outline-none focus:border-[#CCFF00]"
              />

              <button
                type="submit"
                disabled={status === "loading" || !file}
                className="mt-2 h-11 rounded-full bg-[#CCFF00] text-sm font-semibold text-[#24330F] transition hover:bg-[#B8E600] disabled:opacity-60"
              >
                {status === "loading" ? "기록 중..." : "기록하기"}
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
          </>
        )}
      </div>
    </div>
  );
}
