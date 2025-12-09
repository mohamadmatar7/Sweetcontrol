"use client";

import { useEffect } from "react";
import Image from "next/image";

export default function Hippo({ title, children }) {

  // Scroll down 25% of the page on mount to center the mouth area
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (typeof window === "undefined") return;

      const doc = document.documentElement;
      const scrollAmount = doc.scrollHeight * 0.25; // 25% of total height

      window.scrollTo({
        top: scrollAmount,
        behavior: "smooth",
      });
    }, 100); 

    return () => clearTimeout(timeout);
  }, []);
  return (
    <div className="w-full max-w-3xl overflow-hidden">
      {/* ---- MAIN SCREEN ---- */}
      <div className="">
        {/* ---- CONTENT ---- */}
        <div className="">
          <div className="grid items-start md:items-stretch">
            {/* HIPPO IMAGE (TOP) */}
                <Image
                  src="/face.png"
                  alt="Hippo Character"
                  width={500}
                  height={500}
                  className="object-contain max-w-2xl mx-auto z-10"
                  priority
                />


            {/* MOUTH AREA (BLACK WITH ROUNDED EDGES) */}
            <div className="bg-black rounded-[3rem] px-4 md:px-8 pt-12 pb-16 sm:pb-28 -mt-20 md:-mt-24 w-full md:max-w-2xl mx-auto">
              {/* TITLE (DYNAMIC / OPTIONAL) */}
              {title && (
                <div className="text-center mb-2 mt-6 md:mt-9">
                  <h1
                    className="text-5xl md:text-7xl font-black text-yellow-300 tracking-wider chewy-regular"
                    style={{ textShadow: "4px 4px 0px rgba(0,0,0,0.5)" }}
                  >
                    {title}
                  </h1>
                </div>
              )}

              {/* DYNAMIC CONTENT INSIDE THE MOUTH */}
              <div className="space-y-4 md:space-y-5 md:h-full flex flex-col">
                {children}
              </div>
            </div>

            {/* BOTTOM IMAGE */}
            <Image
              src="/bottom.png"
              alt="Hippo Character"
              width={500}
              height={500}
              className="object-contain -mt-[5.3rem] sm:-mt-[9.7rem] max-w-2xl mx-auto z-10"
              priority
            />
          </div>
        </div>
      </div>
    </div>
  );
}
