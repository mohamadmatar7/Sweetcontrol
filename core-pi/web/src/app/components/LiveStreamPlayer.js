"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const DEFAULT_ROOM = process.env.NEXT_PUBLIC_LIVEKIT_ROOM || "sweet-control";

export default function LiveStreamPlayer({ roomName = DEFAULT_ROOM, compact = false }) {
  const videoRef = useRef(null);
  const roomRef = useRef(null);
  const videoTrackRef = useRef(null);

  const [status, setStatus] = useState("connecting"); // connecting | waiting | live | error | disconnected
  const [error, setError] = useState("");
  const [muted, setMuted] = useState(true);
  const [connecting, setConnecting] = useState(false);

  const cleanup = useCallback(() => {
    if (videoTrackRef.current && videoRef.current) {
      try {
        videoTrackRef.current.detach(videoRef.current);
      } catch {}
    }
    videoTrackRef.current = null;

    if (roomRef.current) {
      try {
        roomRef.current.disconnect();
      } catch {}
    }
    roomRef.current = null;
  }, []);

  const connect = useCallback(async () => {
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
          setStatus("waiting");
        }
      });

      room.on(RoomEvent.Disconnected, () => {
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
  }, [cleanup, roomName]);

  useEffect(() => {
    connect();
    return () => cleanup();
  }, [connect, cleanup]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = muted;
    }
  }, [muted]);

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
      }`}
    >
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

      <div className="relative w-full overflow-hidden rounded-xl bg-black border border-white/10">
        <video
          ref={videoRef}
          className="w-full h-full object-contain"
          muted={muted}
          playsInline
          autoPlay
          style={{ minHeight: compact ? 220 : 280, backgroundColor: "#000" }}
        />

        {status !== "live" && (
          <div className="absolute inset-0 flex items-center justify-center text-white/80 text-sm bg-black/50 backdrop-blur-[1px]">
            {status === "error" ? "Stream niet beschikbaar" : "Verbinden met camera…"}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-3">
        <button
          onClick={() => {
            const nextMuted = !muted;
            setMuted(nextMuted);
            if (videoRef.current) {
              videoRef.current.muted = nextMuted;
              if (!nextMuted) videoRef.current.play().catch(() => {});
            }
          }}
          className="px-3 py-2 rounded-lg bg-white/10 text-white text-sm font-semibold hover:bg-white/20 transition"
        >
          {muted ? "Geluid aan" : "Geluid uit"}
        </button>

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

