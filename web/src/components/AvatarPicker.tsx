"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

type Props = {
  userId: string;
  // Called after a successful upload AND patch; parent can refresh whatever
  // needs to re-render.
  onChange?: (avatarUrl: string) => void;
};

const ALLOWED = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;

export function AvatarPicker({ userId, onChange }: Props) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Fetch the current avatar on mount. 404 means the user has no avatar yet
  // — suppress that specific error so the UI just shows the empty state.
  useEffect(() => {
    let cancelled = false;
    api<{ url: string }>(`/users/${userId}/avatar-url`)
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
      setError("Pick a JPEG, PNG, or WEBP image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Image must be under 5 MB.");
      return;
    }
    setUploading(true);
    try {
      const { uploadUrl, key } = await api<{ uploadUrl: string; key: string }>(
        `/users/me/avatar-upload-url`,
        {
          method: "POST",
          body: JSON.stringify({ mimeType: file.type, sizeBytes: file.size }),
        },
      );
      const put = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "content-type": file.type, "content-length": String(file.size) },
        body: file,
      });
      if (!put.ok) throw new Error(`S3 upload failed: ${put.status}`);
      await api(`/users/me`, {
        method: "PATCH",
        body: JSON.stringify({ avatarUrl: key }),
      });
      // Re-fetch the signed GET URL so the preview updates to the new image.
      const fresh = await api<{ url: string }>(`/users/${userId}/avatar-url`);
      setPreviewUrl(fresh.url);
      onChange?.(key);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border border-ink-faded/40 bg-parchment-dark">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt="Profile"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center font-display text-2xl text-ink-faded">
            ?
          </div>
        )}
      </div>
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
          {uploading ? "Uploading…" : "JPEG, PNG, or WEBP. Under 5 MB. Optional."}
        </p>
        {error && <p className="mt-1 text-xs text-seal">{error}</p>}
      </div>
    </div>
  );
}
