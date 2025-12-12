"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Hippo from "../components/Hippo";
import Footer from "../components/Footer";

export default function HowToPlayPage() {
  const [step, setStep] = useState(0);
  const router = useRouter();

  const sections = [
    {
      title: "Spelen",
      lines: [
        "Doneer aan De Warmste Week <br /> en krijg credits.",
        "Geef balans aan ons en Hippo's leven",
        "Eén credit kost € 1 (max. 5 credits).",
      ],
    },
    {
      title: "Doel",
      lines: [
        "Help! <br /> Balanceer Hippo's suikerspiegel",
        "Laag -> Geef eten",
        "Hoog -> Sporten",
        "Te Hoog -> Insuline spuiten",
      ],
    },
    // {
    //   title: "Controls",
    //   lines: [
    //     "Gebruik de pijltjes om de kraan te bewegen.",
    //     "Gebruik de drop knop om de grijparm te verlagen.",
    //   ],
    // },
  ];

  const current = sections[step];

  const handleNext = () => {
    if (step < sections.length - 1) {
      setStep(step + 1);
    } else {
      router.push("/donate");
    }
  };

  const buttonLabel =
    step < sections.length - 1 ? "Volgende" : "Ga naar donatie";

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#5a3ffb] to-[#2c0f74] flex justify-center p-2">
      <div className="flex-1 flex flex-col items-center justify-center w-full">
        <Hippo>
          {/* CLOUD CONTAINER */}
          <div className="relative mx-auto mt-7 md:mt-9 z-10">
            {/* extra bubbles to make it look like a cloud, kept inside the mouth */}
            <span className="hidden md:block absolute top-0 left-6 w-7 h-7 bg-white/60 rounded-full blur-[1px]" />
            <span className="hidden md:block absolute top-1 right-10 w-9 h-9 bg-white/60 rounded-full blur-[1px]" />
            <span className="hidden md:block absolute bottom-0 right-4 w-6 h-6 bg-white/60 rounded-full blur-[1px]" />

            <div className="relative bg-gradient-to-br from-white to-white/80 rounded-[2.5rem] shadow-lg p-6 md:p-7 border border-white/70">
              <h2 className="text-center font-extrabold text-xl md:text-2xl mb-4 tracking-wider text-[#2c0f74] chewy-regular">
                {current.title}
              </h2>

              {/* PRETTY LIST */}
              {/* <ul className="space-y-3 text-sm md:text-base text-gray-800">
                {current.lines.map((line, index) => (
                  <li
                    key={index}
                    className=""
                  >
                    <span className="mt-1 text-sm">•</span>
                    <span className="pl-1">{line}</span>
                  </li>
                ))}
              </ul> */}

              {/* PRETTY LIST */}
              <ul className="space-y-2 text-sm md:text-base text-gray-800">
                {current.lines.map((line, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-2"
                  >
                    {/* Small fixed icon */}
                    <span className="mt-1 inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-[#ffbb00] to-[#ff3b1f] text-[0.55rem] font-bold text-amber-300">
                      ✓
                    </span>

                    {/* Text takes remaining width and wraps nicely */}
                    <span className="flex-1 leading-snug" dangerouslySetInnerHTML={{ __html: line }} />
                  </li>
                ))}
              </ul>


              {/* BUTTON */}
              <button
                onClick={handleNext}
                className="mt-5 mb-2 w-full py-3 rounded-lg font-bold text-white text-lg bg-gradient-to-r from-[#ffbb00] to-[#ff3b1f] hover:opacity-90 transition disabled:opacity-60 active:scale-95"
              >
                {buttonLabel}
              </button>
            </div>
          </div>
        </Hippo>

        {/* FOOTER WITH LOGOS */}
        <Footer />
      </div>
    </div>
  );
}
