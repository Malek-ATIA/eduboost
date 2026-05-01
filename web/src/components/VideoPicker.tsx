"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

type Props = {
  userId: string;
  onChange?: (videoKey: string) => void;
};

const ALLOWED = ["video/mp4", "video/webm", "video/quicktime"];
const MAX_BYTES = 100 * 1024 * 1024;

export function VideoPicker({ userId, onChange }: Props) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<{ url: string }>(`/teachers/${userId}/video-url`)
      .then((r) => {
        if (!cancelled) setPreviewUrl(r.url);
      })
      .catch(() => {
        if (!cancelled) setPreviewUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    if (!ALLOWED.includes(file.type)) {
      setError("Pick an MP4, WebM, or MOV video.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Video must be under 100 MB.");
      return;
    }
    setUploading(true);
    setProgress(0);
    try {
      const { uploadUrl, key } = await api<{ uploadUrl: string; key: string }>(
        `/teachers/me/video-upload-url`,
        {
          method: "POST",
          body: JSON.stringify({ mimeType: file.type, sizeBytes: file.size }),
        },
      );

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("content-type", file.type);
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) setProgress(Math.round((ev.loaded / ev.total) * 100));
        };
        xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`Upload failed: ${xhr.status}`)));
        xhr.onerror = () => reject(new Error("Upload failed"));
        xhr.send(file);
      });

      await api(`/teachers/me/video`, {
        method: "PATCH",
        body: JSON.stringify({ introVideoUrl: key }),
      });

      const fresh = await api<{ url: string }>(`/teachers/${userId}/video-url`);
      setPreviewUrl(fresh.url);
      onChange?.(key);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
      setProgress(0);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-3">
      {previewUrl && (
        <video
          src={previewUrl}
          controls
          className="w-full max-w-md rounded-lg border border-ink-faded/30"
          preload="metadata"
        />
      )}
      {!previewUrl && !uploading && (
        <div className="flex h-44 max-w-md items-center justify-center rounded-lg border-2 border-dashed border-ink-faded/30 bg-parchment-dark text-sm text-ink-faded">
          No intro video yet
        </div>
      )}
      {uploading && (
        <div className="max-w-md space-y-1">
          <div className="h-2 overflow-hidden rounded-full bg-ink-faded/20">
            <div
              className="h-full rounded-full bg-seal transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-ink-faded">Uploading... {progress}%</p>
        </div>
      )}
      <div>
        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED.join(",")}
          onChange={onFile}
          disabled={uploading}
          className="block text-sm text-ink-soft file:mr-3 file:rounded-md file:border file:border-ink-faded/40 file:bg-white/70 file:px-3 file:py-1.5 file:text-sm file:text-ink hover:file:bg-parchment-dark"
        />
        <p className="mt-1 text-xs text-ink-faded">
          MP4, WebM, or MOV. Under 100 MB. Introduce yourself to students.
        </p>
        {error && <p className="mt-1 text-xs text-seal">{error}</p>}
      </div>
    </div>
  );
}
