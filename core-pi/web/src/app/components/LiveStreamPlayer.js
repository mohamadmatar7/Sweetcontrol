"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const DEFAULT_ROOM = process.env.NEXT_PUBLIC_LIVEKIT_ROOM || "sweet-control";
const LIVEKIT_VIEWER_URL = process.env.NEXT_PUBLIC_LIVEKIT_VIEWER_URL;
const VISIBILITY_TIMEOUT_MS = Number(
  process.env.NEXT_PUBLIC_LIVEKIT_VISIBILITY_TIMEOUT_MS ?? 60_000
);
const MAX_SESSION_MS = Number(
  process.env.NEXT_PUBLIC_LIVEKIT_MAX_SESSION_MS ?? 4 * 60 * 60 * 1000
);

function buildViewerSrc(viewerBaseUrl, { roomName, nonce }) {
  if (!viewerBaseUrl) return "";
  try {
    const u = (() => {
      try {
        return new URL(viewerBaseUrl);
      } catch {
        // Support relative URLs in dev (client-only)
        return new URL(viewerBaseUrl, window.location.origin);
      }
    })();

    if (roomName) u.searchParams.set("room", roomName);
    u.searchParams.set("embedded", "1");
    u.searchParams.set("t", String(nonce ?? 0)); // cache-bust reloads
    return u.toString();
  } catch {
    return viewerBaseUrl;
  }
}

export default function LiveStreamPlayer({
  roomName = DEFAULT_ROOM,
  compact = false,
  className = "",
}) {
  const videoRef = useRef(null);
  const roomRef = useRef(null);
  const videoTrackRef = useRef(null);

  const [status, setStatus] = useState("connecting"); // connecting | waiting | live | error | disconnected
  const [error, setError] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [hasVideoTrack, setHasVideoTrack] = useState(false);
  const [viewerNonce, setViewerNonce] = useState(0);
  const [embeddedEnabled, setEmbeddedEnabled] = useState(true);

  const useEmbeddedViewer = Boolean(LIVEKIT_VIEWER_URL);

  const cleanup = useCallback(() => {
    if (useEmbeddedViewer) return;
    if (videoTrackRef.current && videoRef.current) {
      try {
        videoTrackRef.current.detach(videoRef.current);
      } catch {}
    }
    videoTrackRef.current = null;
    setHasVideoTrack(false);

    if (roomRef.current) {
      try {
        roomRef.current.disconnect();
      } catch {}
    }
    roomRef.current = null;
  }, [useEmbeddedViewer]);

  const connect = useCallback(async () => {
    // New system: embed the dedicated LiveKit viewer page (no token minting here).
    if (useEmbeddedViewer) {
      setError("");
      setConnecting(true);
      setStatus("connecting");
      setEmbeddedEnabled(true);
      setViewerNonce((n) => n + 1);
      return;
    }

    if (!API_BASE_URL) {
      setStatus("error");
      setError("NEXT_PUBLIC_API_BASE_URL ontbreekt.");
      return;
    }

    setConnecting(true);
    setError("");
    setStatus("connecting");
    cleanup();

    try {
      const res = await fetch(
        `${API_BASE_URL}/api/livekit/token?room=${encodeURIComponent(roomName)}`
      );

      if (!res.ok) {
        let errorMsg = `Token endpoint gaf status ${res.status}`;
        try {
          const data = await res.json();
          if (data?.error) errorMsg = data.error;
        } catch {}
        throw new Error(errorMsg);
      }

      const { url, token } = await res.json();
      if (!url || !token) {
        throw new Error("Ongeldige reactie van LiveKit token endpoint.");
      }

      const { Room, RoomEvent } = await import("livekit-client");
      const room = new Room({
        autoSubscribe: true,
        adaptiveStream: true,
        dynacast: true,
      });

      roomRef.current = room;

      room.on(RoomEvent.TrackPublished, (publication) => {
        if (publication.kind === "video") {
          publication.setSubscribed(true);
        }
      });

      room.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === "video" && videoRef.current) {
          if (videoTrackRef.current && videoTrackRef.current !== track) {
            try {
              videoTrackRef.current.detach(videoRef.current);
            } catch {}
          }

          track.attach(videoRef.current);
          videoTrackRef.current = track;
          setHasVideoTrack(true);
          setStatus("live");
          videoRef.current.play().catch(() => {});
        }
      });

      room.on(RoomEvent.TrackUnsubscribed, (track) => {
        if (track.kind === "video" && videoTrackRef.current === track) {
          try {
            track.detach(videoRef.current);
          } catch {}
          videoTrackRef.current = null;
          setHasVideoTrack(false);
          setStatus("waiting");
        }
      });

      room.on(RoomEvent.Disconnected, () => {
        setHasVideoTrack(false);
        setStatus("disconnected");
      });

      await room.connect(url, token);
      setStatus("waiting");
    } catch (err) {
      console.error("LiveKit viewer error", err);
      setError(err?.message || "Kon niet verbinden met LiveKit");
      setStatus("error");
      cleanup();
    } finally {
      setConnecting(false);
    }
  }, [cleanup, roomName, useEmbeddedViewer]);

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
        if (useEmbeddedViewer) setEmbeddedEnabled(false);
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
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // In case the page is already hidden when mounted
    handleVisibilityChange();

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearScheduledDisconnect();
    };
  }, [cleanup, useEmbeddedViewer]);

  // Hard cap session length to avoid "overnight" viewers
  useEffect(() => {
    if (typeof window === "undefined") return;

    const startedAt = Date.now();
    const intervalId = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      if (elapsed >= MAX_SESSION_MS) {
        window.clearInterval(intervalId);
        cleanup();
        if (useEmbeddedViewer) setEmbeddedEnabled(false);
        setStatus("disconnected");
      }
    }, 60_000); // check every minute

    return () => window.clearInterval(intervalId);
  }, [cleanup, useEmbeddedViewer]);

  const statusLabel = (() => {
    if (status === "live") return "Live";
    if (status === "waiting") return "Wachten op video";
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
        {useEmbeddedViewer ? (
          embeddedEnabled ? (
            <iframe
              key={viewerNonce}
              title="LiveKit viewer"
              className="absolute inset-0 h-full w-full"
              src={buildViewerSrc(LIVEKIT_VIEWER_URL, {
                roomName,
                nonce: viewerNonce,
              })}
              allow="autoplay; fullscreen; microphone; camera; display-capture"
              referrerPolicy="no-referrer-when-downgrade"
              onLoad={() => {
                setConnecting(false);
                setStatus("live");
              }}
            />
          ) : (
            <div className="absolute inset-0 z-20 flex items-center justify-center text-white/80 text-sm bg-black/50 backdrop-blur-[1px]">
              Verbinding verbroken
            </div>
          )
        ) : (
          <video
            ref={videoRef}
            className="h-full object-contain"
            muted
            playsInline
            autoPlay
            style={{
              backgroundColor: "#000",
              transform: "rotate(-270deg) scale(0.56)",
              maxWidth: "none",
            }}
          />
        )}

        <div
          className="pointer-events-none absolute left-[30%] top-[40%] -translate-x-1/2 -translate-y-1/2 z-10"
          aria-hidden="true"
        >
          <div
            className={`crosshair-rotate relative ${compact ? "h-16 w-16" : "h-20 w-20"}`}
          >
            <div className="crosshair-pulse absolute inset-0">
              {/* Ring */}
              <div className="absolute inset-0 rounded-full border-[3px] border-[#4a39a3]" />

              {/* 3 ticks on the edge (0°, 120°, 240°) */}
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

        {!useEmbeddedViewer && !hasVideoTrack && status !== "live" && (
          <div className="absolute inset-0 z-20 flex items-center justify-center text-white/80 text-sm bg-black/50 backdrop-blur-[1px]">
            {status === "error"
              ? "Stream niet beschikbaar"
              : status === "waiting"
                ? "Wachten op stream…"
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

