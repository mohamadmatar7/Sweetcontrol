"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const TOKEN_KEY = "sweet_token";

export default function PlayClaimPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // New param: /play?intent=XXXX
  const intentId = searchParams.get("intent");

  const [status, setStatus] = useState("claiming"); // claiming | success | error
  const [error, setError] = useState("");

  useEffect(() => {
    let intervalId = null;
    let stopped = false;

    async function claimOnce() {
      try {
        if (!API_BASE_URL) {
          setStatus("error");
          setError("Missing NEXT_PUBLIC_API_BASE_URL in env.");
          return true; // stop polling
        }

        if (!intentId) {
          setStatus("error");
          setError("Missing intent ID.");
          return true; // stop polling
        }

        const res = await fetch(`${API_BASE_URL}/api/play/claim`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ intentId }),
        });

        const data = await res.json();

        // Pending (webhook not arrived yet) => keep polling
        if (res.status === 202 && data.status === "pending") {
          setStatus("claiming");
          return false;
        }

        if (!res.ok) {
          setStatus("error");
          setError(data?.error || "Claim failed.");
          return true; // stop polling
        }

        // Success
        localStorage.setItem(TOKEN_KEY, data.token);
        setStatus("success");

        setTimeout(() => router.replace("/arcade"), 800);
        return true; // stop polling
      } catch (err) {
        console.error(err);
        setStatus("error");
        setError("Network error while claiming.");
        return true; // stop polling
      }
    }

    // First try immediately
    claimOnce().then((done) => {
      if (done || stopped) return;

      // Poll every 2 seconds until paid
      intervalId = setInterval(async () => {
        if (stopped) return;
        const finished = await claimOnce();
        if (finished && intervalId) clearInterval(intervalId);
      }, 2000);
    });

    return () => {
      stopped = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [intentId, router]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#5a3ffb] to-[#2c0f74] flex justify-center p-4">
      <div className="w-full max-w-md my-auto">
        <div className="bg-[#0b0b1c]/85 border border-white/20 rounded-[2rem] px-6 py-7 shadow-xl text-center space-y-4 text-slate-100">
          {status === "claiming" && (
            <>
              <h1 className="text-2xl font-bold tracking-wide">
                Bezig met verifiëren...
              </h1>
              <p className="text-slate-300 text-sm">
                Dit kan enkele ogenblikken duren, bedankt voor je geduld!
              </p>
            </>
          )}

          {status === "success" && (
            <>
              <h1 className="text-2xl font-bold text-emerald-300 tracking-wide">
                Succes! 🎉
              </h1>
              <p className="text-slate-300 text-sm">
                Je wordt doorgestuurd naar de arcade…
              </p>
            </>
          )}

          {status === "error" && (
            <>
              <h1 className="text-2xl font-bold text-red-300 tracking-wide chewy-regular">
                Oeps ❌
              </h1>
              <p className="text-slate-300 text-sm">{error}</p>
              <button
                onClick={() => router.replace("/")}
                className="mt-3 p-3 rounded-lg font-bold text-white text-lg bg-gradient-to-r from-[#ffbb00] to-[#ff3b1f] hover:opacity-90 transition disabled:opacity-60 active:scale-95"
              >
                Terug naar home
              </button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
