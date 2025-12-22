"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Hippo from "./components/Hippo";
import Footer from "./components/Footer";
import Pusher from "pusher-js";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export default function Homepage() {
  const [totalPlayed, setTotalPlayed] = useState(null);

  useEffect(() => {
    if (!API_BASE_URL) return;

    // 1) Initial fetch
    fetch(`${API_BASE_URL}/api/stats/mollie-total`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.ok) setTotalPlayed(Math.floor(Number(d.totalEur ?? 0)));
      })
      .catch(() => {});

    // 2) Realtime via Soketi
    const pusher = new Pusher(process.env.NEXT_PUBLIC_SOKETI_KEY, {
      wsHost: process.env.NEXT_PUBLIC_SOKETI_WS_HOST,
      wsPort: Number(process.env.NEXT_PUBLIC_SOKETI_WS_PORT),
      forceTLS: process.env.NEXT_PUBLIC_SOKETI_FORCE_TLS === "true",
      disableStats: true,
    });

    const channel = pusher.subscribe("public-stats");
    channel.bind("mollie-total-update", (data) => {
      if (typeof data?.totalEur === "number") {
        setTotalEur(data.totalEur);
      }
    });

    return () => {
      pusher.unsubscribe("public-stats");
      pusher.disconnect();
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#5a3ffb] to-[#2c0f74] flex flex-col items-center justify-between p-2">
      {/* MAIN CONTENT CENTERED */}
      <div className="flex-1 flex flex-col items-center justify-center w-full">
        <Hippo title="Sweet Control">
          {/* REALTIME DONATION TOTAL */}
          {totalPlayed !== null && (
            <div className="mb-2 text-center">
              <div className="inline-flex items-center px-4 py-1.5 rounded-lg bg-white/90 text-[#2c0f74] text-sm font-semibold shadow-sm">
                Aantal keer gespeeld: {totalPlayed}
              </div>
            </div>
          )}

          {/* INFO BLOCKS */}
          <div className="space-y-4 md:space-y-5 md:h-full flex flex-col">
            {/* 1) Diabetes -> Warmste Week */}
            <Link href="/warmste-week" className="flex items-stretch w-full">
              <div className="w-full py-3 md:py-4 rounded-lg bg-[#7bb4ff] hover:bg-[#6da2e6] hover:opacity-90 transition disabled:opacity-60 active:scale-95 text-white font-black text-lg md:text-xl flex items-center justify-center gap-2">
                <span>Ontdek het verhaal</span>
              </div>
            </Link>

            {/* 2) Doneer & speel fysiek */}
            <Link href="/donate" className="flex items-stretch w-full">
              <div className="w-full py-3 md:py-4 rounded-lg bg-gradient-to-r from-[#ffbb00] to-[#ff3b1f] hover:opacity-90 transition disabled:opacity-60 active:scale-95 text-white font-black text-lg md:text-xl flex items-center justify-center gap-2">
                <span>Doneer &amp; speel</span>
              </div>
            </Link>

            {/* 3) Livestream */}
            <Link href="/livestream" target="_blank" rel="noreferrer" className="flex items-stretch w-full">
              <div className="w-full py-3 md:py-4 rounded-lg bg-white/90 hover:opacity-90 transition disabled:opacity-60 active:scale-95 text-[#2c0f74] font-black text-lg md:text-xl flex items-center justify-center gap-2 shadow-sm mb-4 sm:mb-7">
                <span>Open livestream</span>
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
