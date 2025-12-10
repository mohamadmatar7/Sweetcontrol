"use client";

import Link from "next/link";
import Image from "next/image";
import Hippo from "./components/Hippo";
import Footer from "./components/Footer";

export default function Homepage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#5a3ffb] to-[#2c0f74] flex flex-col items-center justify-between p-2">
      {/* MAIN CONTENT CENTERED */}
      <div className="flex-1 flex flex-col items-center justify-center w-full">
        <Hippo title="Sweet Control">
          {/* INFO BLOCKS */}
          <div className="space-y-4 md:space-y-5 md:h-full flex flex-col">
            {/* 1) Diabetes -> Warmste Week */}
            <Link href="/warmste-week" className="flex items-stretch w-full">
              <div className="w-full py-3 md:py-4 rounded-lg bg-[#7bb4ff] hover:bg-[#6da2e6] hover:opacity-90 transition disabled:opacity-60 active:scale-95 text-white font-black text-lg md:text-xl flex items-center justify-center gap-2">
                <span>📖</span>
                <span>Ontdek het verhaal</span>
              </div>
            </Link>

            {/* 2) Doneer & speel meteen */}
            <Link href="/donate" className="flex items-stretch w-full">
              <div className="w-full py-3 md:py-4 rounded-lg bg-gradient-to-r from-[#ffbb00] to-[#ff3b1f] hover:opacity-90 transition disabled:opacity-60 active:scale-95 mb-2 md:mb-6 text-white font-black text-lg md:text-xl flex items-center justify-center gap-2">
                <span>💝</span>
                <span>Doneer &amp; speel meteen</span>
              </div>
            </Link>
          </div>
        </Hippo>
      </div>

      {/* FOOTER WITH LOGOS */}
      <Footer />
    </div>
  );
}
