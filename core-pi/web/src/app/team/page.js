import React from "react";
import Image from "next/image";
import Link from "next/link";
import Footer from "../components/Footer";

export default function Team() {
  const creators = [
    { name: "Sander Pollet", img: "/sander.png" },
    { name: "Emile Bergers", img: "/emile.png" },
    { name: "Mohamad Matar", img: "/mohamad.png" },
    { name: "Vik Sluijter", img: "/vik.png" },
  ];

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#5a3ffb] to-[#2c0f74] flex justify-center px-4 py-2">
      <div className="w-full max-w-3xl text-white flex flex-col gap-8">
        {/* Main card */}
        <div className="w-full py-7 flex flex-col gap-8">
          {/* Top text block */}
          <header className="text-center space-y-2 ">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-[0.08em] drop-shadow-lg uppercase text-yellow-300">
              Sweet Control
            </h1>
            <h2
            className="
                inline-flex items-center justify-center
                px-4 py-1.5
                mt-3
                rounded-full
                bg-gradient-to-r from-[#ffbb00] to-[#ff3b1f]
                text-[#2c0f74]
                text-white
                text-sm
                font-extrabold
                uppercase
                tracking-[0.28em]
                shadow-[0_0_18px_rgba(250,204,21,0.85)]">
            Makers
            </h2>
          </header>

          {/* Divider */}
          <div className="h-[3px] w-32 mx-auto bg-gradient-to-r from-transparent via-yellow-300 to-transparent opacity-80" />

          {/* Creators grid */}
          <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {creators.map((person) => (
              <div
                key={person.name}
                className="flex flex-col items-center gap-3 bg-white/8 hover:bg-white/12 border border-white/15 rounded-2xl py-5 px-3 shadow-md transition-colors"
              >
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden shadow-[0_0_28px_rgba(251,191,36,0.8)] ring-2 ring-amber-300/80 bg-[#160f45]">
                  <Image
                    src={person.img}
                    alt={person.name}
                    width={96}
                    height={96}
                    className="w-full h-full object-cover"
                  />
                </div>
                <p className="text-sm sm:text-base font-semibold text-white text-center leading-snug">
                  {person.name}
                </p>
              </div>
            ))}
          </section>

          {/* Divider */}
          <div className="h-[3px] w-32 mx-auto bg-gradient-to-r from-transparent via-yellow-300 to-transparent opacity-80" />
        
          {/* Text + description */}
          <section className="flex flex-col gap-4 sm:gap-5 text-left">
            <h3 className="text-lg sm:text-xl font-bold tracking-wide">
              Interactive Media Development – IMD
            </h3>
            <p className="text-sm sm:text-base leading-relaxed text-slate-100/90">
              In Interactive Media Development leer je creatieve digitale
              projecten maken, zoals websites, apps en interactieve
              installaties. Je combineert design met technologie en leert
              programmeren, prototypen en samenwerken aan echte projecten.
            </p>
          </section>

          {/* Link to home */}
            <div className="text-center mt-4">
            <Link href="/" className="w-full p-3 md:p-4 rounded-lg bg-gradient-to-r from-[#ffbb00] to-[#ff3b1f] hover:opacity-90 transition disabled:opacity-60 active:scale-95 mb-2 md:mb-6 text-white font-black text-lg md:text-xl">
                Terug naar home
            </Link>
            </div>

          {/* Footer */}
          <Footer />
        </div>
      </div>
    </div>
  );
}
