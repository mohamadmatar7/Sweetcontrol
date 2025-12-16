import Link from "next/link";
import Hippo from "../components/Hippo";
import Footer from "../components/Footer";
import LiveStreamPlayer from "../components/LiveStreamPlayer";

export default function LiveStreamPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-[#5a3ffb] to-[#2c0f74] text-slate-100 flex justify-center p-3">
      <div className="w-full max-w-4xl flex flex-col items-center justify-center">
        <Hippo title="Live spelen">
          <div className="space-y-4 md:space-y-5">
            <LiveStreamPlayer />

            <div className="bg-white/90 border border-white/60 rounded-2xl p-4 sm:p-5 text-[#141326] shadow-lg">
              <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
                <span>🎥</span>
                <span>Speel mee van thuis</span>
              </h2>
              <p className="text-sm text-slate-700 mb-3">
                Dit is de live top-down cam op de grijparm. Open de stream op je
                laptop of desktop voor de beste latency en gebruik je donatie
                om meteen in de rij te komen.
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  href="/donate"
                  className="flex-1 text-center px-4 py-3 rounded-xl bg-gradient-to-r from-[#ffbb00] to-[#ff3b1f] text-white font-bold shadow-md active:scale-95 transition"
                >
                  Doneer &amp; speel meteen
                </Link>
                <Link
                  href="/how-to-play"
                  className="flex-1 text-center px-4 py-3 rounded-xl bg-[#0b0b1c] text-white font-bold border border-white/10 shadow-md active:scale-95 transition"
                >
                  Hoe werkt het?
                </Link>
              </div>

              <p className="text-xs text-slate-500 mt-3">
                Problemen met beeld? Klik op &ldquo;Herstart stream&rdquo; of
                ververs de pagina. Zorg dat je browser geluid mag afspelen als
                je audio wil horen.
              </p>
            </div>
          </div>
        </Hippo>
        <Footer />
      </div>
    </main>
  );
}

