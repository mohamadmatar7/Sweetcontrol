"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Pusher from "pusher-js";
import Controls from "./../components/Controls";
import Hippo from "../components/Hippo";
import Footer from "../components/Footer";
import LiveStreamPlayer from "../components/LiveStreamPlayer";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

const SOKETI_KEY = process.env.NEXT_PUBLIC_SOKETI_KEY;
const WS_HOST = process.env.NEXT_PUBLIC_SOKETI_WS_HOST;
const WS_PORT = Number(process.env.NEXT_PUBLIC_SOKETI_WS_PORT || 443);
const FORCE_TLS = process.env.NEXT_PUBLIC_SOKETI_FORCE_TLS === "true";

const TOKEN_KEY = "sweet_token";
const CREDIT_SECONDS = 35;

export default function ArcadePage() {
  const router = useRouter();

  const [token, setToken] = useState(null);
  const [me, setMe] = useState(null);
  const [queue, setQueue] = useState([]);

  const [activeDonationId, setActiveDonationId] = useState(null);
  const [firstMoveDeadline, setFirstMoveDeadline] = useState(null);

  const [notice, setNotice] = useState(null);

  const [secondsLeft, setSecondsLeft] = useState(CREDIT_SECONDS);
  const [timerRunning, setTimerRunning] = useState(false);
  const timerRef = useRef(null);
  const endsAtRef = useRef(null);

  const [firstMoveSecondsLeft, setFirstMoveSecondsLeft] = useState(null);
  const firstMoveIntervalRef = useRef(null);

  const prevCreditsRef = useRef(null);
  const noticeTimerRef = useRef(null);

  // Sequence increments whenever a new credit starts (used to reset Controls state)
  const [creditSeq, setCreditSeq] = useState(0);

  // NEW: UI-only flag to show "session ended" screen before redirect
  const [sessionEnded, setSessionEnded] = useState(false);

  // Keep latest "me.id" in a ref for Pusher callbacks
  const meIdRef = useRef(null);
  useEffect(() => {
    meIdRef.current = me?.id ?? null;
  }, [me?.id]);

  // Keep the current token in a ref so we can compare against localStorage safely
  const tokenRef = useRef(null);
  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  // Initial token load from localStorage
  useEffect(() => {
    const t = localStorage.getItem(TOKEN_KEY);
    if (!t) {
      router.replace("/");
      return;
    }
    setToken(t);
  }, [router]);

  function startTimerWithEndsAt(endsAt) {
    if (!endsAt) return;

    endsAtRef.current = endsAt;
    if (timerRef.current) clearInterval(timerRef.current);

    setTimerRunning(true);

    timerRef.current = setInterval(() => {
      const left = Math.max(
        0,
        Math.ceil((endsAtRef.current - Date.now()) / 1000)
      );
      setSecondsLeft(left);
      if (left <= 0) stopTimer();
    }, 1000);

    const leftNow = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
    setSecondsLeft(leftNow);
  }

  function stopTimer() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    endsAtRef.current = null;
    setTimerRunning(false);
  }

  function showNotice(type, text, ms = 5000) {
    setNotice({ type, text });
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => setNotice(null), ms);
  }

  const isActive = useMemo(() => {
    return me && me.status === "active" && activeDonationId === me.id;
  }, [me, activeDonationId]);

  // Polling fallback to keep queue + "me" in sync (even if websocket drops)
  useEffect(() => {
    if (!token) return;

    const poll = setInterval(async () => {
      try {
        // Queue snapshot
        const qRes = await fetch(`${API_BASE_URL}/api/queue?t=${Date.now()}`, {
          cache: "no-store",
        });
        if (qRes.ok) {
          const qData = await qRes.json();
          setQueue(qData.queue || []);
          setActiveDonationId(qData.activeDonationId || null);
          setFirstMoveDeadline(qData.firstMoveDeadline || null);
        }

        // Fresh "me" snapshot
        const meRes = await fetch(
          `${API_BASE_URL}/api/me?token=${token}&t=${Date.now()}`,
          { cache: "no-store" }
        );

        if (meRes.ok) {
          const meData = await meRes.json();
          setMe(meData);
          prevCreditsRef.current = meData.creditsRemaining;
        } else if (meRes.status === 403 || meRes.status === 404) {
          // Token is no longer valid for THIS tab's token.
          // We only clear localStorage if it still matches the token this tab is using.
          const currentStorageToken =
            typeof window !== "undefined"
              ? localStorage.getItem(TOKEN_KEY)
              : null;

          if (currentStorageToken && currentStorageToken === tokenRef.current) {
            localStorage.removeItem(TOKEN_KEY);
          }

          router.replace("/");
        }
      } catch {
        // Ignore polling errors silently (weak networks, etc.)
      }
    }, 5000);

    return () => clearInterval(poll);
  }, [token, router]);

  // First-move countdown handling
  useEffect(() => {
    if (firstMoveIntervalRef.current) {
      clearInterval(firstMoveIntervalRef.current);
      firstMoveIntervalRef.current = null;
    }

    if (!isActive || timerRunning || !firstMoveDeadline) {
      setFirstMoveSecondsLeft(null);
      return;
    }

    const update = () => {
      const left = Math.max(
        0,
        Math.ceil((firstMoveDeadline - Date.now()) / 1000)
      );
      setFirstMoveSecondsLeft(left);
    };

    update();
    firstMoveIntervalRef.current = setInterval(update, 1000);

    return () => {
      if (firstMoveIntervalRef.current) {
        clearInterval(firstMoveIntervalRef.current);
        firstMoveIntervalRef.current = null;
      }
    };
  }, [isActive, timerRunning, firstMoveDeadline]);

  // Initial load + Pusher realtime bindings
  useEffect(() => {
    if (!token) return;

    let pusher;
    let channel;

    async function loadInitial() {
      // 1) Load queue snapshot first
      const qRes = await fetch(`${API_BASE_URL}/api/queue?t=${Date.now()}`, {
        cache: "no-store",
      });
      const qData = await qRes.json();

      setQueue(qData.queue || []);
      setActiveDonationId(qData.activeDonationId || null);
      setFirstMoveDeadline(qData.firstMoveDeadline || null);

      // 2) Then load "me" so we see updated DB status
      const meRes = await fetch(
        `${API_BASE_URL}/api/me?token=${token}&t=${Date.now()}`,
        { cache: "no-store" }
      );
      if (!meRes.ok) {
        // If our token no longer works, don't touch localStorage here.
        // Just redirect this tab away.
        router.replace("/");
        return;
      }

      const meData = await meRes.json();
      setMe(meData);
      prevCreditsRef.current = meData.creditsRemaining;

      // 3) If this player is active, sync timer correctly
      if (meData.status === "active" && qData.activeDonationId === meData.id) {
        if (qData.creditEndsAt) {
          startTimerWithEndsAt(qData.creditEndsAt);
        } else {
          // Active but no running credit yet => new credit cycle
          setCreditSeq((s) => s + 1);
        }
      }
    }

    loadInitial();

    pusher = new Pusher(SOKETI_KEY, {
      wsHost: WS_HOST,
      wsPort: WS_PORT,
      wssPort: WS_PORT,
      forceTLS: FORCE_TLS,
      enabledTransports: ["ws", "wss"],
      cluster: "mt1",
    });

    channel = pusher.subscribe("public-chat");

    // Queue updates (any change to queue / active donation)
    channel.bind("queue-update", (payload) => {
      setQueue(payload.queue || []);
      setActiveDonationId(payload.activeDonationId || null);
      setFirstMoveDeadline(payload.firstMoveDeadline || null);

      setMe((prev) => {
        if (!prev) return prev;
        const mine = (payload.queue || []).find((x) => x.id === prev.id);
        if (!mine) return prev;

        const updated = {
          ...prev,
          status: mine.status,
          creditsRemaining: mine.creditsRemaining,
        };

        // Credit consumed => new credit is ready
        if (
          updated.status === "active" &&
          prevCreditsRef.current !== null &&
          mine.creditsRemaining < prevCreditsRef.current
        ) {
          setSecondsLeft(CREDIT_SECONDS);
          stopTimer();
          setCreditSeq((s) => s + 1); // reset Controls per credit
        }

        prevCreditsRef.current = mine.creditsRemaining;
        return updated;
      });
    });

    // A player has become active
    channel.bind("player-start", (payload) => {
      setActiveDonationId(payload.donationId);
      setFirstMoveDeadline(payload.firstMoveDeadline || null);

      setMe((prev) => {
        if (!prev) return prev;
        if (payload.donationId === prev.id) {
          setSecondsLeft(CREDIT_SECONDS);
          stopTimer();
          setNotice(null);
          setCreditSeq((s) => s + 1); // new credit cycle on turn start
        }
        return prev;
      });
    });

    // A new credit has started (timer sync)
    channel.bind("credit-start", (payload) => {
      if (payload.donationId === meIdRef.current) {
        startTimerWithEndsAt(payload.creditEndsAt);
      }
    });

    // Player timed out without first move
    channel.bind("player-timeout", (payload) => {
      if (payload.donationId === meIdRef.current) {
        stopTimer();
        showNotice(
          "error",
          "Your turn expired because you did not move in time."
        );
      }
    });

    // Player session ended completely
    channel.bind("player-end", (payload) => {
      if (payload.donationId === meIdRef.current) {
        stopTimer();

        // NEW: show a short "session ended" screen before redirecting home
        setSessionEnded(true);

        // Again, only clear localStorage if it still holds this tab's token.
        const currentStorageToken =
          typeof window !== "undefined"
            ? localStorage.getItem(TOKEN_KEY)
            : null;

        if (currentStorageToken && currentStorageToken === tokenRef.current) {
          localStorage.removeItem(TOKEN_KEY);
        }

        setTimeout(() => router.replace("/"), 7000);
      }
    });

    return () => {
      channel?.unbind_all();
      pusher?.disconnect();
      stopTimer();

      if (firstMoveIntervalRef.current) {
        clearInterval(firstMoveIntervalRef.current);
        firstMoveIntervalRef.current = null;
      }

      if (noticeTimerRef.current) {
        clearTimeout(noticeTimerRef.current);
        noticeTimerRef.current = null;
      }
    };
  }, [token, router]);

  const myQueuePosition = useMemo(() => {
    if (!me) return null;
    const idx = queue.findIndex((q) => q.id === me.id);
    return idx >= 0 ? idx + 1 : null;
  }, [me, queue]);

  const visibleQueue = useMemo(() => {
    if (!queue || queue.length === 0) return [];
    if (!me) return queue.slice(0, 4);

    const idx = queue.findIndex((q) => q.id === me.id);
    if (idx === -1) {
      // If I'm not in the queue, just show top 4
      return queue.slice(0, 4);
    }

    const start = Math.max(0, idx - 3); // 3 before you at most
    return queue.slice(start, idx + 1);
  }, [queue, me]);

  if (!me) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-[#5a3ffb] to-[#2c0f74] text-slate-100 flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-[#050816]/90 border border-white/15 rounded-3xl px-6 py-6 shadow-[0_0_40px_rgba(0,0,0,0.85)] text-center">
          Laden...
        </div>
      </main>
    );
  }

  // Session ended screen shown briefly before redirecting home
  if (sessionEnded) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-[#5a3ffb] to-[#2c0f74] text-slate-100 flex justify-center p-2">
        <div className="w-full max-w-3xl flex flex-col items-center justify-center">
          <Hippo>
            <div className="relative w-full mt-6 md:mt-8">
              <div className="relative bg-gradient-to-br from-white to-white/90 rounded-[2.5rem] shadow-lg px-6 py-7 md:px-8 md:py-9 border border-white/70 text-[#141326] text-center">
                <p className="text-xs sm:text-sm text-yellow-700/80 uppercase tracking-[0.16em] mb-2">
                  spel afgelopen
                </p>
                <p className="text-lg sm:text-xl font-semibold text-[#2c0f74] mb-2">
                  Bedankt om te spelen{me?.name ? `, ${me.name}` : ""}!
                </p>
                <p className="text-[0.75rem] sm:text-xs text-slate-500">
                  Je sessie is afgelopen. Je wordt zo meteen teruggestuurd naar
                  het startscherm.
                </p>
              </div>
            </div>
          </Hippo>
          <Footer />
        </div>
      </main>
    );
  }

  // State when NOT active
  if (!isActive) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-[#5a3ffb] to-[#2c0f74] text-slate-100 flex justify-center p-2">
        <div className="w-full max-w-3xl flex flex-col items-center justify-center">
          <Hippo>
            {/* CLOUD-LIKE WAITLIST INSIDE HIPPO */}
            <div className="relative w-full mt-6 md:mt-8">
              <div className="relative bg-gradient-to-br from-white to-white/90 rounded-[2.5rem] shadow-lg px-6 py-7 md:px-8 md:py-9 border border-white/70 text-[#141326]">
                {/* Player name + status */}
                <div className="mb-4 text-center">
                  <p className="text-xs sm:text-sm text-yellow-700/80 uppercase tracking-[0.16em]">
                    huidige speler
                  </p>
                  <p className="text-lg sm:text-xl font-semibold text-[#2c0f74]">
                    {me.name}
                  </p>
                  <p className="text-[0.75rem] sm:text-xs text-slate-500 mt-1">
                    Jouw positie in de rij:{" "}
                    {myQueuePosition ? <b>#{myQueuePosition}</b> : "-"}
                  </p>
                </div>

                <div className="rounded-2xl px-3 pb-3 sm:px-4 sm:py-4 mb-4 max-h-60 overflow-y-auto">
                  <h2 className="text-sm sm:text-base font-semibold text-[#1b1740] mb-2 flex items-center gap-2">
                    <span className="text-yellow-500 mx-auto">Wachtrij</span>
                  </h2>

                  <div>
                    {visibleQueue.length === 0 && (
                      <div className="text-slate-500 text-xs sm:text-sm">
                        Geen spelers in de wachtrij.
                      </div>
                    )}

                    {visibleQueue.map((p) => {
                      const isMeRow = me && p.id === me.id;
                      const isPlaying = p.status === "active";

                      return (
                        <div
                          key={p.id}
                          className={`flex items-center justify-between px-3 py-2 text-xs sm:text-sm
                            ${
                              isPlaying
                                ? "bg-emerald-100 border border-emerald-300"
                                : "bg-white border border-[#dde1ff]"
                            }
                            ${isMeRow ? "ring-1 ring-yellow-400/70" : ""}`}
                        >
                          <div>
                            <div className="font-semibold text-[#1b1740]">
                              {p.position}. {p.name}
                            </div>
                            <div className="text-[0.7rem] text-slate-500">
                              Credits: {p.creditsRemaining}
                            </div>
                          </div>

                          <div className="text-[0.65rem] text-right uppercase tracking-[0.16em]">
                            <span
                              className={
                                isPlaying
                                  ? "text-emerald-500"
                                  : "text-slate-500"
                              }
                            >
                              {isPlaying ? "playing" : "waiting"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <p className="text-[0.75rem] sm:text-xs text-slate-500 text-center">
                  De machine kiest automatisch de volgende speler. Blijf even
                  staan, je bent bijna aan de beurt.
                </p>
              </div>
            </div>

            {notice && (
              <div
                className={`mt-4 rounded-xl px-4 py-2 text-xs sm:text-sm font-semibold text-center
                  ${
                    notice.type === "error"
                      ? "bg-red-600/10 border border-red-400/70 text-red-600"
                      : "bg-[#272153]/10 border border-[#3b347c] text-[#272153]"
                  }`}
              >
                {notice.text}
              </div>
            )}
          </Hippo>
          {/* FOOTER WITH LOGOS */}
          <Footer />
        </div>
      </main>
    );
  }

// State when ACTIVE
return (
  <main className="min-h-screen bg-gradient-to-br from-[#5a3ffb] to-[#2c0f74] text-slate-100 flex justify-center p-2">
    <div className="w-full max-w-3xl flex flex-col items-center justify-center">
      <Hippo>
        {/* CLOUD-LIKE ACTIVE PANEL INSIDE HIPPO */}
        <div className="relative w-full mt-6 md:mt-8">
          {/* More "open" theme: lighter cloud */}
          <div className="relative rounded-[2.5rem] shadow-lg px-3 py-7 md:px-8 md:py-9 border border-white/70 text-[#141326] overflow-hidden bg-white/35">
            {/* Background livestream video (fills full cloud) */}
            <div className="absolute inset-0 z-0">
              <LiveStreamPlayer background className="w-full h-full" />
              {/* Very light overlay (no blur) to keep text readable */}
              <div className="absolute inset-0 bg-black/5" />
            </div>

            {/* Foreground content */}
            <div className="relative z-10">
              {/* Header / status */}
              <div className="text-center mb-3">
                <p className="text-xs sm:text-sm text-white uppercase tracking-[0.16em] drop-shadow-[0_2px_8px_rgba(255,255,255,0.95)]">
                  jouw beurt
                </p>
                <p className="text-xs sm:text-sm text-white drop-shadow-[0_2px_8px_rgba(255,255,255,0.95)]">
                  Credits over: <b>{me.creditsRemaining}</b>
                </p>

                {timerRunning && (
                  <p className="text-[0.7rem] sm:text-xs text-white mt-2 drop-shadow-[0_2px_8px_rgba(255,255,255,0.95)]">
                    Tijd over deze beurt: <b>{secondsLeft}s</b>
                  </p>
                )}

                {!timerRunning && (
                  <p className="text-[0.7rem] sm:text-xs text-white mt-2 drop-shadow-[0_2px_8px_rgba(255,255,255,0.95)]">
                    {firstMoveSecondsLeft !== null && (
                      <>
                        {" "}
                        Maak je eerste beweging in <b>{firstMoveSecondsLeft}s</b>
                      </>
                    )}
                  </p>
                )}
              </div>

              {/* CONTROLS INSIDE CLOUD */}
              {/* Push controls down a bit so they are not centered in the stream */}
              <div className="w-full max-w-md mx-auto mt-[7.5rem] sm:mt-16 mb-6 opacity-95">
                <Controls
                  token={token}
                  creditSeq={creditSeq}
                  onFirstAction={() => {
                    // Optimistic local UX start (server will resync anyway)
                    if (!timerRunning && !endsAtRef.current) {
                      startTimerWithEndsAt(Date.now() + CREDIT_SECONDS * 1000);
                    }
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* NOTICE UNDER CLOUD (IF ANY) */}
        {notice && (
          <div
            className={`mt-4 rounded-xl px-4 py-2 text-xs sm:text-sm font-semibold text-center
              ${
                notice.type === "error"
                  ? "bg-red-600/10 border border-red-400/70 text-red-600"
                  : "bg-[#272153]/10 border border-[#3b347c] text-[#272153]"
              }`}
          >
            {notice.text}
          </div>
        )}
      </Hippo>

      {/* FOOTER WITH LOGOS */}
      <Footer />
    </div>
  </main>
);

}
