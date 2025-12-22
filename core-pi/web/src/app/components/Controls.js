'use client';

import { useEffect, useRef, useState } from 'react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

// If a release event is lost, auto-release after this many ms
const STUCK_RELEASE_MS = 3500;

// Lock all controls for 7 seconds after GRAB (must match backend GRAB_FINISH_MS)
const GRAB_LOCK_MS = 7000;

/**
 * Arcade controls:
 * - Directions are "hold" while pressed
 * - Grab is allowed once per credit
 * - Includes safety releases for iOS / weak networks
 * - After GRAB, lock ALL inputs for 7 seconds (UI + logic)
 */
export default function Controls({ token, onFirstAction, creditSeq }) {
  const startedRef = useRef(false);
  const grabUsedRef = useRef(false);

  // Track currently held directions so we can release them on blur/visibility changes
  const heldDirectionsRef = useRef(new Set());

  // Track per-direction "stuck" timers (auto-release if pointerup is lost)
  const stuckTimersRef = useRef(new Map());

  // UI lock after GRAB (state-based so UI disables immediately)
  const [locked, setLocked] = useState(false);
  const grabLockTimerRef = useRef(null);

  // Reset per-credit state whenever a new credit starts
  useEffect(() => {
    startedRef.current = false;
    grabUsedRef.current = false;

    // Unlock UI on new credit
    setLocked(false);
    if (grabLockTimerRef.current) clearTimeout(grabLockTimerRef.current);
    grabLockTimerRef.current = null;

    // Clear held directions and any pending timers
    heldDirectionsRef.current.clear();
    for (const t of stuckTimersRef.current.values()) clearTimeout(t);
    stuckTimersRef.current.clear();
  }, [creditSeq]);

  function armStuckTimer(direction) {
    const old = stuckTimersRef.current.get(direction);
    if (old) clearTimeout(old);

    const t = setTimeout(() => {
      if (heldDirectionsRef.current.has(direction)) {
        release(direction).catch(() => {});
      }
    }, STUCK_RELEASE_MS);

    stuckTimersRef.current.set(direction, t);
  }

  function clearStuckTimer(direction) {
    const t = stuckTimersRef.current.get(direction);
    if (t) clearTimeout(t);
    stuckTimersRef.current.delete(direction);
  }

  async function press(direction) {
    if (locked) return;

    console.log('PRESS', direction);

    if (!startedRef.current) {
      startedRef.current = true;
      onFirstAction?.();
    }

    heldDirectionsRef.current.add(direction);
    armStuckTimer(direction);

    await fetch(`${API_BASE_URL}/api/control/press`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, direction }),
    });
  }

  async function release(direction) {
    console.log('RELEASE', direction);

    heldDirectionsRef.current.delete(direction);
    clearStuckTimer(direction);

    await fetch(`${API_BASE_URL}/api/control/release`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, direction }),
    });
  }

  // Release any stuck holds if iOS loses pointerup/touchend on bad networks
  async function releaseAllHeld() {
    const dirs = Array.from(heldDirectionsRef.current);
    heldDirectionsRef.current.clear();

    for (const t of stuckTimersRef.current.values()) clearTimeout(t);
    stuckTimersRef.current.clear();

    await Promise.all(
      dirs.map((d) =>
        fetch(`${API_BASE_URL}/api/control/release`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, direction: d }),
        }).catch(() => {})
      )
    );
  }

  // Global safety: if tab hides, page blurs, or unloads, release all holds
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) releaseAllHeld();
    };
    const onBlur = () => releaseAllHeld();
    const onPageHide = () => releaseAllHeld();

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    window.addEventListener('pagehide', onPageHide);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [token]);

  async function grab() {
    if (locked) return;

    // Local lock: only one grab per credit
    if (grabUsedRef.current) return;

    grabUsedRef.current = true;

    if (!startedRef.current) {
      startedRef.current = true;
      onFirstAction?.();
    }

    // Immediately release any held directions and lock UI for GRAB duration
    await releaseAllHeld();
    setLocked(true);

    if (grabLockTimerRef.current) clearTimeout(grabLockTimerRef.current);
    grabLockTimerRef.current = setTimeout(() => {
      setLocked(false);
      grabLockTimerRef.current = null;
    }, GRAB_LOCK_MS);

    const res = await fetch(`${API_BASE_URL}/api/control/grab`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });

    if (!res.ok) {
      // Backend rejected: unlock immediately so the user isn't stuck
      setLocked(false);
      if (grabLockTimerRef.current) clearTimeout(grabLockTimerRef.current);
      grabLockTimerRef.current = null;

      grabUsedRef.current = false;
    }
  }

  // D-pad hold button: stable hold on mobile via Pointer Capture
  function HoldButton({ direction, children }) {
    return (
      <button
        disabled={locked}
        aria-disabled={locked}
        className="select-none w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-[#0b061f]/70 border border-[#3b2a80]/70 text-white/90 text-xl sm:text-2xl font-semibold shadow-[0_8px_18px_rgba(0,0,0,0.6)] hover:border-[#facc15] hover:shadow-[0_0_20px_rgba(250,204,21,0.35)] active:opacity-100 active:translate-y-[2px] active:shadow-[0_3px_10px_rgba(0,0,0,0.8)] transition-all duration-100 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ touchAction: 'none' }}
        onPointerDown={(e) => {
          if (locked) return;
          e.preventDefault();

          // Ensure pointerup is delivered even if finger moves outside the button
          e.currentTarget.setPointerCapture(e.pointerId);

          press(direction);
        }}
        onPointerUp={(e) => {
          if (locked) return;
          e.preventDefault();

          try {
            e.currentTarget.releasePointerCapture(e.pointerId);
          } catch {}

          release(direction);
        }}
        onPointerCancel={(e) => {
          if (locked) return;

          try {
            e.currentTarget.releasePointerCapture(e.pointerId);
          } catch {}

          release(direction);
        }}
      >
        {children}
      </button>
    );
  }

  return (
    <div
      className="w-full flex justify-center"
      style={{
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
        WebkitTapHighlightColor: 'transparent',
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="w-full mt-3">
        <div className="flex flex-col items-center gap-3 sm:gap-4">
          {/* Up */}
          <HoldButton direction="up">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 4l-7 8h14z" />
            </svg>
          </HoldButton>

          {/* Middle row: left / grab / right */}
          <div className="flex items-center justify-center gap-3 sm:gap-4">
            <HoldButton direction="left">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
                <path d="M4 12l8-7v14z" />
              </svg>
            </HoldButton>

            <button
              disabled={locked || grabUsedRef.current}
              aria-disabled={locked || grabUsedRef.current}
              className="select-none w-20 h-20 rounded-full bg-gradient-to-br from-[#ffbb00]/80 to-[#ff3b1f]/80 text-[#1b123a] font-extrabold text-sm sm:text-base shadow-[0_0_24px_rgba(251,191,36,0.7)] border border-amber-300/80 active:scale-95 active:opacity-100 disabled:opacity-40 disabled:shadow-none disabled:cursor-not-allowed transition-all duration-75 flex items-center justify-center tracking-wide"
              onClick={grab}
            >
              GRAB
            </button>

            <HoldButton direction="right">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 12l-8 7V5z" />
              </svg>
            </HoldButton>
          </div>

          {/* Down */}
          <HoldButton direction="down">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 20l7-8H5z" />
            </svg>
          </HoldButton>

          {/* <p className="text-[0.7rem] sm:text-xs text-white text-center max-w-xs">
            Houd de pijltjes ingedrukt om de grijparm te bewegen en tik op <b>GRAB</b> om te grijpen.
          </p> */}
        </div>
      </div>
    </div>
  );
}
