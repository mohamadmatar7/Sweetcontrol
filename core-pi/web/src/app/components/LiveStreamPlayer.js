"use client";

import { useCallback, useMemo, useState } from "react";

const DEFAULT_ROOM = process.env.NEXT_PUBLIC_LIVEKIT_ROOM || "sweet-control";

// Self-hosted viewer page (served by your VM)
const LIVEKIT_VIEW_BASE =
  process.env.NEXT_PUBLIC_LIVEKIT_VIEW_URL || "https://livekit.maxwyn.be/view.html";

export default function LiveStreamPlayer({
  roomName = DEFAULT_ROOM,
  compact = false,
  className = "",
  background = false, // Background-only mode (video only)
}) {
  const [reloadKey, setReloadKey] = useState(0);
  const [iframeError, setIframeError] = useState(false);

  const viewUrl = useMemo(() => {
    // If your view.html supports a room param later, keep this.
    // It won't break if the page ignores it.
    const u = new URL(LIVEKIT_VIEW_BASE);
    u.searchParams.set("room", roomName);
    return u.toString();
  }, [roomName]);

  const reconnect = useCallback(() => {
    setIframeError(false);
    setReloadKey((k) => k + 1); // forces iframe reload
  }, []);

  const statusLabel = (() => {
    if (iframeError) return "Niet beschikbaar";
    return "Live";
  })();

  const statusStyles = iframeError
    ? "bg-red-500/10 text-red-300 border border-red-400/40"
    : "bg-emerald-500/15 text-emerald-300 border border-emerald-500/40";

  // Background-only mode: iframe fills container + crosshair overlay stays on top
  if (background) {
    return (
      <div className={`w-full h-full ${className}`}>
        <div className="relative w-full h-full bg-black overflow-hidden">
          {/* STREAM (iframe) */}
          <iframe
            key={reloadKey}
            src={viewUrl}
            title="Sweet Control Live Stream (background)"
            allow="autoplay; fullscreen"
            allowFullScreen
            referrerPolicy="no-referrer"
            className="absolute inset-0 w-full h-full border-0 z-0"
            onError={() => setIframeError(true)}
          />

          {/* 🎯 CROSSHAIR / ARROW OVERLAY */}
          <style jsx>{`
            @keyframes crosshair-rotate {
              from {
                transform: rotate(0deg);
              }
              to {
                transform: rotate(360deg);
              }
            }
            @keyframes crosshair-pulse {
              0%,
              100% {
                opacity: 0.75;
                transform: scale(0.96);
                filter: drop-shadow(0 0 0 rgba(74, 57, 163, 0));
              }
              50% {
                opacity: 0.95;
                transform: scale(1.06);
                filter: drop-shadow(0 0 10px rgba(74, 57, 163, 0.35));
              }
            }
            .crosshair-rotate {
              animation: crosshair-rotate 8s linear infinite;
              will-change: transform;
            }
            .crosshair-pulse {
              animation: crosshair-pulse 1.6s ease-in-out infinite;
              will-change: transform, opacity, filter;
            }
          `}</style>

          <div
            className="pointer-events-none absolute left-[30%] top-[40%] -translate-x-1/2 -translate-y-1/2 z-30"
            aria-hidden="true"
          >
            <div
              className={`crosshair-rotate relative ${compact ? "h-16 w-16" : "h-20 w-20"}`}
            >
              <div className="crosshair-pulse absolute inset-0">
                <div className="absolute inset-0 rounded-full border-[3px] border-[#4a39a3]" />
                {[0, 120, 240].map((deg) => (
                  <span
                    key={deg}
                    className="absolute left-1/2 top-1/2 block bg-[#4a39a3]"
                    style={{
                      width: "3px",
                      height: compact ? "10px" : "12px",
                      borderRadius: "2px",
                      transform: `translate(-50%, -50%) rotate(${deg}deg) translateY(${
                        compact ? "-30px" : "-38px"
                      })`,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Simple fallback overlay on iframe load error */}
          {iframeError && (
            <div className="absolute inset-0 z-40 flex items-center justify-center text-white/90 text-sm bg-black/70">
              Stream niet beschikbaar
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl bg-[#0b0b1c]/80 border border-white/10 ${
        compact ? "p-3 shadow-md" : "p-4 shadow-xl"
      } ${className}`}
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.14em] text-white/60">
            Live top-down cam
          </p>
          <p className="text-sm text-white/70 font-semibold">Room: {roomName}</p>
        </div>

        <div className={`px-3 py-1 rounded-full text-[11px] font-semibold ${statusStyles}`}>
          {statusLabel}
        </div>
      </div>

      <div className="relative w-full aspect-[9/16] overflow-hidden rounded-xl bg-black border border-white/10">
        <iframe
          key={reloadKey}
          src={viewUrl}
          title="Sweet Control Live Stream"
          allow="autoplay; fullscreen"
          allowFullScreen
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full border-0"
          onError={() => setIframeError(true)}
        />

        {iframeError && (
          <div className="absolute inset-0 z-20 flex items-center justify-center text-white/80 text-sm bg-black/70">
            Stream niet beschikbaar
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-3">
        <button
          onClick={reconnect}
          className="px-3 py-2 rounded-lg bg-gradient-to-r from-[#7bb4ff] to-[#5a3ffb] text-white text-sm font-semibold transition"
        >
          Herstart stream
        </button>
      </div>
    </div>
  );
}
