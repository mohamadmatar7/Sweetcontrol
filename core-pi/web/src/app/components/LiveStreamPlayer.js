"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_ROOM = process.env.NEXT_PUBLIC_LIVEKIT_ROOM || "sweet-control";
const LIVEKIT_VIEW_URL =
  process.env.NEXT_PUBLIC_LIVEKIT_VIEW_URL || "https://livekit.maxwyn.be/view.html";

const VISIBILITY_TIMEOUT_MS = Number(
  process.env.NEXT_PUBLIC_LIVEKIT_VISIBILITY_TIMEOUT_MS ?? 60_000
);

// Zet deze op 1800000 (30 min) in .env.local als je dat wil
const MAX_SESSION_MS = Number(
  process.env.NEXT_PUBLIC_LIVEKIT_MAX_SESSION_MS ?? 4 * 60 * 60 * 1000
);

export default function LiveStreamPlayer({
  roomName = DEFAULT_ROOM,
  compact = false,
  className = "",
}) {
  const iframeRef = useRef(null);

  const [status, setStatus] = useState("connecting"); // connecting | live | error | disconnected
  const [error, setError] = useState("");
  const [connecting, setConnecting] = useState(false);

  // build iframe src (roomName currently not used by view.html, but future-proof)
  const src = `${LIVEKIT_VIEW_URL}?room=${encodeURIComponent(roomName)}&t=${Date.now()}`;

  const cleanup = useCallback(() => {
    // “Disconnect” by clearing iframe (stops network + stream)
    if (iframeRef.current) {
      try {
        iframeRef.current.src = "about:blank";
      } catch {}
    }
  }, []);

  const connect = useCallback(async () => {
    setConnecting(true);
    setError("");
    setStatus("connecting");

    try {
      if (!iframeRef.current) throw new Error("iframe ontbreekt");
      // reload iframe (forces a new token + connection inside view.html)
      iframeRef.current.src = src;
    } catch (e) {
      setStatus("error");
      setError(e?.message || "Kon stream niet starten");
    } finally {
      setConnecting(false);
    }
  }, [src]);

  useEffect(() => {
    connect();
    return () => cleanup();
  }, [connect, cleanup]);

  // Auto-disconnect when tab has been hidden for a while
  useEffect(() => {
    if (typeof document === "undefined") return;

    let visibilityTimeoutId = null;

    const scheduleDisconnect = () => {
      if (visibilityTimeoutId != null) return;
      visibilityTimeoutId = window.setTimeout(() => {
        cleanup();
        setStatus("disconnected");
      }, VISIBILITY_TIMEOUT_MS);
    };

    const clearScheduledDisconnect = () => {
      if (visibilityTimeoutId != null) {
        window.clearTimeout(visibilityTimeoutId);
        visibilityTimeoutId = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        scheduleDisconnect();
      } else {
        clearScheduledDisconnect();
        // Optionally reconnect when visible again:
        // connect();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    handleVisibilityChange();

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearScheduledDisconnect();
    };
  }, [cleanup /*, connect*/]);

  // Hard cap session length to avoid "overnight" viewers
  useEffect(() => {
    if (typeof window === "undefined") return;

    const timeoutId = window.setTimeout(() => {
      cleanup();
      setStatus("disconnected");
    }, MAX_SESSION_MS);

    return () => window.clearTimeout(timeoutId);
  }, [cleanup]);

  const statusLabel = (() => {
    if (status === "live") return "Live";
    if (status === "disconnected") return "Verbinding verbroken";
    if (status === "error") return "Niet beschikbaar";
    return "Verbinding maken…";
  })();

  const statusStyles =
    status === "live"
      ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/40"
      : status === "error"
        ? "bg-red-500/10 text-red-300 border border-red-400/40"
        : "bg-white/5 text-white/80 border border-white/10";

  return (
    <div
      className={`rounded-2xl bg-[#0b0b1c]/80 border border-white/10 ${
        compact ? "p-3 shadow-md" : "p-4 shadow-xl"
      } ${className}`}
    >
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

      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.14em] text-white/60">
            Live top-down cam
          </p>
          <p className="text-sm text-white/70 font-semibold">
            Room: {roomName}
          </p>
        </div>

        <div className={`px-3 py-1 rounded-full text-[11px] font-semibold ${statusStyles}`}>
          {statusLabel}
        </div>
      </div>

      <div className="relative w-full aspect-[9/16] overflow-hidden rounded-xl bg-black border border-white/10 flex items-center justify-center">
        {/* Viewer iframe */}
        <iframe
          ref={iframeRef}
          title="Sweet Control Livestream"
          src={src}
          className="absolute inset-0 w-full h-full"
          allow="autoplay; fullscreen; encrypted-media"
          allowFullScreen
          style={{ border: "0" }}
          onLoad={() => {
            // view.html will show a green dot when video is live;
            // we treat iframe load as "connected"
            setStatus("live");
          }}
          onError={() => {
            setStatus("error");
            setError("Kon view.html niet laden");
          }}
        />

        {/* Crosshair overlay (kept from your original component) */}
        <div
          className="pointer-events-none absolute left-[30%] top-[40%] -translate-x-1/2 -translate-y-1/2 z-10"
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

        {status !== "live" && (
          <div className="absolute inset-0 z-20 flex items-center justify-center text-white/80 text-sm bg-black/50 backdrop-blur-[1px]">
            {status === "error"
              ? "Stream niet beschikbaar"
              : status === "disconnected"
                ? "Verbinding verbroken"
                : "Verbinden met stream…"}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-3">
        <button
          onClick={connect}
          disabled={connecting}
          className="px-3 py-2 rounded-lg bg-gradient-to-r from-[#7bb4ff] to-[#5a3ffb] text-white text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed transition"
        >
          {connecting ? "Bezig…" : "Herstart stream"}
        </button>

        {error && (
          <span className="text-[12px] text-red-200 font-semibold">
            {error}
          </span>
        )}
      </div>
    </div>
  );
}
