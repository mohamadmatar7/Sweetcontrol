"use client";

import { useEffect, useRef } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

/**
 * Arcade controls:
 * - Directions are "hold" while pressed
 * - Grab is allowed once per credit
 */
export default function Controls({ token, onFirstAction, creditSeq }) {
  const startedRef = useRef(false);
  const grabUsedRef = useRef(false);

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

    await fetch(`${API_BASE_URL}/api/control/press`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, direction }),
    });
  }

  async function release(direction) {
    await fetch(`${API_BASE_URL}/api/control/release`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, direction }),
    });
  }

  async function grab() {
    // Local lock: only one grab per credit
    if (grabUsedRef.current) return;

    grabUsedRef.current = true;

    if (!startedRef.current) {
      startedRef.current = true;
      onFirstAction?.();
    }

    const res = await fetch(`${API_BASE_URL}/api/control/grab`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });

    if (!res.ok) {
      // If backend rejected (e.g. not active / already used),
      // unlock locally so user can try again next credit.
      grabUsedRef.current = false;
    }
  }

  function ArrowInteractive({ dir, children }) {
    return (
      <div
        role="button"
        tabIndex={0}
        className="bg-indigo-900 rounded-full w-20 h-20 flex justify-center items-center border-10 border-white p-5 select-none"
        style={{ touchAction: "none" }}
        onPointerDown={(e) => {
          e.preventDefault();
          press(dir);
        }}
        onPointerUp={(e) => {
          e.preventDefault();
          release(dir);
        }}
        onPointerLeave={() => release(dir)}
        onPointerCancel={() => release(dir)}
        onKeyDown={(e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            press(dir);
          }
        }}
        onKeyUp={(e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            release(dir);
          }
        }}>
        {children}
      </div>
    );
  }

  return (
    // {Container van de knoppen en styling voor het in het midden te plaatsen}
    <div className="w-full h-full flex flex-col items-center justify-center text-center gap-5 text-white text-[2rem]">
      {/* {up arrow} */}
      <ArrowInteractive dir="up">&#8593;</ArrowInteractive>

      {/* {Container voor het zetten van de left, right en drop button op een rij} */}
      <div className="flex gap-5 items-center">
        {/* {Left button} */}
        <ArrowInteractive dir="left">&#8592;</ArrowInteractive>

        {/* {Drop button} */}
        <div
          className="jersey-10-regular bg-red-600 rounded-full w-20 h-20 flex justify-center items-center border-10 border-white p-10 cursor-pointer select-none"
          onClick={() => grab()}
          role="button"
          aria-disabled={!!grabUsedRef.current}>
          drop
        </div>

        {/* {Right button} */}
        <ArrowInteractive dir="right">&#8594;</ArrowInteractive>
      </div>

      <ArrowInteractive dir="down">&#8595;</ArrowInteractive>
    </div>
  );
}
