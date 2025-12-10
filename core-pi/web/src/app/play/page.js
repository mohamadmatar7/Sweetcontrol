import { Suspense } from "react";
import PlayClient from "./PlayClient";

export default function PlayPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-gradient-to-br from-[#5a3ffb] to-[#2c0f74] flex justify-center p-4">
          <div className="w-full max-w-md">
            <div className="bg-[#0b0b1c]/85 border border-white/20 rounded-[2rem] px-6 py-7 shadow-xl text-center space-y-3 text-slate-100">
              <h1 className="text-2xl font-bold tracking-wide">
                Processing your payment…
              </h1>
              <p className="text-slate-300 text-sm">
                Please wait while we verify your donation.
              </p>
            </div>
          </div>
        </main>
      }
    >
      <PlayClient />
    </Suspense>
  );
}
