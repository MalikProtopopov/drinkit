"use client";
import { useEffect, useRef, useState } from "react";
import { catalogApi } from "@/lib/adminApi";

const VIDEO_RE = /\.(mp4|webm|mov|m4v)(\?|#|$)/i;

type Props = {
  value?: string | null;
  onChange: (url: string | null) => void;
  accept?: "image" | "video" | "media";
  height?: number;
};

/** Drag-and-drop загрузка медиа: превью + удалить. Возвращает URL загруженного файла. */
export function MediaUpload({ value, onChange, accept = "image", height = 150 }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mediaErr, setMediaErr] = useState(false);
  useEffect(() => setMediaErr(false), [value]); // новый файл — сбрасываем ошибку превью

  const acceptAttr = accept === "video" ? "video/*" : accept === "media" ? "image/*,video/*" : "image/*";
  const isVideo = value ? VIDEO_RE.test(value) : accept === "video";
  const kindWord = accept === "video" ? "видео" : accept === "media" ? "изображение или видео" : "изображение";
  const fileName = value ? decodeURIComponent(value.split("/").pop() || value).split(/[?#]/)[0] : "";

  const handleFile = async (file?: File | null) => {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const { url } = await catalogApi.uploadMedia(file);
      onChange(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files?.[0]); }}
        style={{
          position: "relative", borderRadius: 12, minHeight: height, cursor: "pointer", overflow: "hidden",
          padding: value ? 8 : 0,
          border: `2px dashed ${drag ? "var(--a-accent)" : "var(--a-rule)"}`,
          background: drag ? "var(--a-accent-soft)" : "var(--a-panel-soft)",
          display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center",
          transition: "border-color .12s, background .12s",
        }}>
        {value && !mediaErr ? (
          isVideo ? (
            // #t=0.1 — показать первый кадр как постер даже если автоплей заблокирован
            <video key={value} src={`${value}#t=0.1`} muted loop playsInline autoPlay preload="metadata"
                   onError={() => setMediaErr(true)}
                   style={{ maxWidth: "100%", maxHeight: height, objectFit: "contain", display: "block" }} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" onError={() => setMediaErr(true)}
                 style={{ maxWidth: "100%", maxHeight: height, objectFit: "contain", display: "block" }} />
          )
        ) : value && mediaErr ? (
          // браузер не смог отрисовать превью (напр. .mov в Chrome) — но файл загружен
          <div style={{ padding: 16, color: "var(--a-ink-soft)" }}>
            <div style={{ fontSize: 26, lineHeight: 1 }}>{isVideo ? "🎬" : "🖼"}</div>
            <div style={{ fontWeight: 600, marginTop: 6 }}>{isVideo ? "Видео загружено" : "Файл загружен"}</div>
            <div className="admin-mono admin-meta" style={{ marginTop: 2, maxWidth: 220, overflow: "hidden",
                          textOverflow: "ellipsis", whiteSpace: "nowrap", marginInline: "auto" }}>{fileName}</div>
            <div className="admin-meta" style={{ marginTop: 4 }}>предпросмотр недоступен в браузере</div>
          </div>
        ) : (
          <div style={{ padding: 16, color: "var(--a-ink-soft)" }}>
            <div style={{ fontSize: 24, lineHeight: 1 }}>⬆</div>
            <div style={{ fontWeight: 600, marginTop: 6 }}>
              {busy ? "Загрузка…" : "Перетащите файл сюда или нажмите"}
            </div>
            <div className="admin-meta" style={{ marginTop: 2 }}>{kindWord} · до 60 МБ</div>
          </div>
        )}
        {busy && value && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,.7)",
                        display: "grid", placeItems: "center", fontWeight: 600 }}>Загрузка…</div>
        )}
      </div>

      <input ref={inputRef} type="file" accept={acceptAttr} style={{ display: "none" }}
             onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ""; }} />

      {value && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 6 }}>
          <span className="admin-mono admin-meta"
                style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "70%" }}>
            {value}
          </span>
          <button type="button" className="admin-btn ghost sm"
                  onClick={() => onChange(null)}>Удалить</button>
        </div>
      )}
      {error && <div className="admin-meta" style={{ color: "var(--a-danger)", marginTop: 4 }}>{error}</div>}
    </div>
  );
}
