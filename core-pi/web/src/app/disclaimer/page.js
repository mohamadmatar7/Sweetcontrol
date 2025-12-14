import React from "react";
import Image from "next/image";
import Link from "next/link";
import Footer from "../components/Footer";

export default function Disclaimer() {
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#5a3ffb] to-[#2c0f74] flex justify-center px-4 py-2">
      <div className="w-full max-w-3xl text-white flex flex-col gap-8">
        <div className="w-full pt-7 flex flex-col gap-8">
          {/* Header */}
          <header className="text-center space-y-2">
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
                text-white
                text-sm
                font-extrabold
                uppercase
                tracking-[0.28em]
                shadow-[0_0_18px_rgba(250,204,21,0.85)]
              "
            >
              Disclaimer
            </h2>
          </header>

          {/* Divider */}
          <div className="h-[3px] w-32 mx-auto bg-gradient-to-r from-transparent via-yellow-300 to-transparent opacity-80" />

          {/* Warmste Week logo */}
          <div className="flex flex-col items-center justify-center">
            <div className="rounded-2xl px-4 py-3 shadow-[0_0_28px_rgba(251,191,36,0.45)]">
              <Image
                src="/warmsteweeklogo.svg"
                alt="De Warmste Week"
                width={220}
                height={80}
                className="h-auto w-[190px] sm:w-[220px]"
                priority
              />
            </div>
          </div>

          {/* Divider */}
          <div className="h-[3px] w-32 mx-auto bg-gradient-to-r from-transparent via-yellow-300 to-transparent opacity-80" />

          <section className="space-y-5 text-slate-100/90 px-1">
            <div>
              <h3 className="text-lg sm:text-xl font-bold tracking-wide text-white">
                Waar gaan de donaties naartoe?
              </h3>
              <p className="mt-2 text-sm sm:text-base leading-relaxed">
                Alle donaties via Sweet Control gaan naar <b>De Warmste Week</b>,
                ter ondersteuning van initiatieven voor mensen met diabetes.
              </p>
            </div>

            <div>
              <h3 className="text-lg sm:text-xl font-bold tracking-wide text-white">
                Donatie-limiet
              </h3>
              <p className="mt-2 text-sm sm:text-base leading-relaxed">
                Om het eerlijk te houden is de <b>maximale donatie €5 per keer</b>.
              </p>
            </div>

            <div>
              <h3 className="text-lg sm:text-xl font-bold tracking-wide text-white">
                Geen terugbetaling
              </h3>
              <p className="mt-2 text-sm sm:text-base leading-relaxed">
                Donaties zijn <b>definitief</b> en worden <b>niet terugbetaald</b>.
                Controleer je gegevens vóór je bevestigt.
              </p>
            </div>

            <div>
              <h3 className="text-lg sm:text-xl font-bold tracking-wide text-white">
                Belangrijk
              </h3>
              <ul className="mt-2 text-sm sm:text-base leading-relaxed list-disc pl-5 space-y-2">
                <li>Sweet Control is een studentenproject en wordt “as-is” aangeboden.</li>
                <li>
                  Spelers winnen geen geld of prijzen, dit is volledig bedoeld als steunactie
                  voor het goede doel.
                </li>
                <li>
                  Bij technische problemen (bv. mislukte redirect) raden we aan opnieuw
                  te proberen of later nog eens te doneren.
                </li>
                <li>
                  We verwerken enkel de gegevens die nodig zijn voor de donatie
                  (bv. nickname en optioneel e-mail).
                </li>
              </ul>
            </div>
          </section>

          {/* Link to doneren */}
          <div className="text-center mt-4 mx-4 sm:mx-0">
            <Link
              href="/donate"
              className="inline-block w-full sm:w-auto sm:min-w-[260px] sm:px-10 p-3 md:p-4 rounded-lg bg-gradient-to-r from-[#ffbb00] to-[#ff3b1f] hover:opacity-90 transition active:scale-95 mb-2 md:mb-6 text-white font-black text-lg md:text-xl"
            >
              Terug naar doneren
            </Link>
          </div>

          {/* Footer */}
          <Footer />
        </div>
      </div>
    </div>
  );
}
