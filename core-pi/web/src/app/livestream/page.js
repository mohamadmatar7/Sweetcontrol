import Image from "next/image";
import Link from "next/link";
import LiveStreamPlayer from "../components/LiveStreamPlayer";

export default function LiveStreamPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-[#5a3ffb] to-[#2c0f74] text-slate-100 flex flex-col">
      {/* Header with back button and title */}
      <div className="relative text-center py-4 px-4">
                <Link
          href="/"
          className="absolute left-4 top-1/2 -translate-y-1/2 px-4 py-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg font-semibold transition-all active:scale-95 flex items-center gap-2"
                >
          <span>←</span>
          <span className="hidden sm:inline">Terug</span>
                </Link>
        <h1 className="text-2xl md:text-3xl font-bold">
          Speel online mee via je desktop
        </h1>
      </div>

      {/* Livestream - centered with space around it */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-8 md:px-12 py-6">
        <div className="w-full max-w-5xl">
          <LiveStreamPlayer />
        </div>
              </div>

      {/* QR Code section at the bottom */}
      <div className="bg-white/10 backdrop-blur-sm border-t border-white/20 py-4 px-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* QR Code and text */}
          <div className="flex flex-col sm:flex-row items-center gap-4 flex-1">
            <div className="bg-white rounded-lg p-2 shadow-lg">
              <Image
                src="/qr-code-controls.png"
                alt="QR Code"
                width={120}
                height={120}
                className="w-24 h-24 sm:w-32 sm:h-32"
              />
            </div>
            <p className="text-lg sm:text-xl font-semibold text-center sm:text-left">
              Scan de QR code en bestuur de kraan via je gsm!
            </p>
          </div>

          {/* Logos in bottom right */}
          <div className="hidden md:flex items-center gap-4">
            <Image
              src="/arteveldelogo.svg"
              alt="Artevelde Logo"
              width={120}
              height={60}
              className="h-12 w-auto"
            />
            <Image
              src="/warmsteweeklogo.svg"
              alt="Warmste Week Logo"
              width={120}
              height={60}
              className="h-12 w-auto"
            />
          </div>
        </div>
      </div>
    </main>
  );
}

