'use client';

import { useEffect, useRef } from 'react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

/**
 * Arcade controls:
 * - Directions are "hold" while pressed
 * - Grab is allowed once per credit
 * - Includes safety releases for iOS / weak networks
 */
export default function Controls({ token, onFirstAction, creditSeq }) {
  const startedRef = useRef(false);
  const grabUsedRef = useRef(false);

  // Track currently held directions so we can release them on blur/visibility changes
  const heldDirectionsRef = useRef(new Set());

  // Reset per-credit state whenever a new credit starts
  useEffect(() => {
    startedRef.current = false;
    grabUsedRef.current = false;
  }, [creditSeq]);

  async function press(direction) {
    if (!startedRef.current) {
      startedRef.current = true;
      onFirstAction?.();
    }

    heldDirectionsRef.current.add(direction);

    await fetch(`${API_BASE_URL}/api/control/press`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, direction }),
    });
  }

  async function release(direction) {
    heldDirectionsRef.current.delete(direction);

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

    await Promise.all(
      dirs
        .map((d) =>
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
    // Local lock: only one grab per credit
    if (grabUsedRef.current) return;

    grabUsedRef.current = true;

    if (!startedRef.current) {
      startedRef.current = true;
      onFirstAction?.();
    }

    const res = await fetch(`${API_BASE_URL}/api/control/grab`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });

    if (!res.ok) {
      // If backend rejected (e.g. not active / already used),
      // unlock locally so user can try again next credit.
      grabUsedRef.current = false;
    }
  }

  // Pure presentational button for the D-pad (logic above is unchanged)
  function HoldButton({ direction, children }) {
    return (
      <button
        className="select-none w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-[#0b061f] border border-[#3b2a80] text-white text-xl sm:text-2xl font-semibold shadow-[0_8px_18px_rgba(0,0,0,0.75)] hover:border-[#facc15] hover:shadow-[0_0_20px_rgba(250,204,21,0.45)] active:translate-y-[2px] active:shadow-[0_3px_10px_rgba(0,0,0,0.8)] transition-all duration-100 flex items-center justify-center"
        style={{ touchAction: 'none' }}
        onPointerDown={(e) => {
          e.preventDefault();
          press(direction);
        }}
        onPointerUp={(e) => {
          e.preventDefault();
          release(direction);
        }}
        onPointerLeave={() => release(direction)}
        onPointerCancel={() => release(direction)}
      >
        {children}
      </button>
    );
  }

  return (
    <div className="w-full flex justify-center">
      <div className="w-full mt-3">
        {/* D-pad + grab layout */}
        <div className="flex flex-col items-center gap-5">
          {/* Up */}
<HoldButton direction="up">
  <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 4l-7 8h14z" />
  </svg>
</HoldButton>

          {/* Middle row: left / grab / right */}
          <div className="flex items-center justify-center gap-5">
              <HoldButton direction="left">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M4 12l8-7v14z" />
                </svg>
              </HoldButton>

              <button
                className="select-none w-20 h-20 rounded-full bg-gradient-to-br from-[#ffbb00] to-[#ff3b1f] text-[#1b123a] font-extrabold text-sm sm:text-base shadow-[0_0_32px_rgba(251,191,36,0.95)] border border-amber-300 active:scale-95 disabled:opacity-50 disabled:shadow-none transition-transform duration-75 flex items-center justify-center tracking-wide"
                onClick={grab}
                disabled={grabUsedRef.current}
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

          <p className="text-[0.7rem] sm:text-xs text-slate-600 text-center max-w-xs">
            Houd de pijltjes ingedrukt om de grijparm te bewegen en tik op <b>GRAB</b> om te grijpen.
          </p>
        </div>
      </div>
    </div>
  );
}
