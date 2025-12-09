"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import Hippo from "./components/Hippo";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-[#5a3ffb] to-[#2c0f74] flex justify-center p-2">
      <Hippo>
        {/* CLOUD-LIKE 404 PANEL INSIDE HIPPO */}
        <div className="relative w-full mt-6 md:mt-8">
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.35 }}
            className="relative bg-gradient-to-br from-white to-white/90 rounded-[2.5rem] shadow-lg px-6 py-7 md:px-8 md:py-9 border border-white/70 text-center text-[#141326]"
          >
            <p className="text-s uppercase tracking-[0.25em] text-yellow-700/80 mb-2">
              error · page not found
            </p>

            <div className="flex flex-col items-center gap-1 mb-3">
              <span className="jersey-10-regular text-[3rem] sm:text-[3.8rem] md:text-[4.4rem] leading-none text-[#2c0f74]">
                404
              </span>
              <span className="text-sm sm:text-base text-slate-700">
                De SweetControl heeft hier niets gevonden.
              </span>
            </div>

            <p className="max-w-md mx-auto text-[0.85rem] sm:text-[0.95rem] text-slate-700 mb-3">
              Deze pagina bestaat niet. Misschien is de link verplaatst of
              verkeerd getypt. Je kunt altijd terug naar het startscherm.
            </p>

            <p className="text-[0.7rem] sm:text-[0.75rem] text-slate-500 mb-5">
              Hint: controleer de URL, of ga gewoon terug naar home.
            </p>

            <Link href="/" className="inline-block w-full">
              <button className="w-full py-3 rounded-lg bg-gradient-to-r from-[#ffbb00] to-[#ff3b1f] text-white font-bold text-sm sm:text-base shadow-md hover:opacity-90 active:scale-95 transition">
                Tik om terug te gaan naar home
              </button>
            </Link>
          </motion.div>
        </div>
      </Hippo>
    </main>
  );
}
