"use client";

import { useState } from "react";
import Hippo from "../components/Hippo";
import Footer from "../components/Footer";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export default function Donate() {
  const [name, setName] = useState("");
  const [amountEuros, setAmountEuros] = useState(1);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState(1);

  function toggleCustomInput() {
    setShowCustomInput(!showCustomInput);
    if (!showCustomInput) {
      setSelectedAmount(null);
    }
  }

  function handleCustomAmountChange(delta) {
    setAmountEuros(Math.max(1, amountEuros + delta));
  }

  function handleCustomAmountInput(e) {
    const value = e.target.value;
    if (value === "") {
      setAmountEuros("");
    } else {
      const num = Number(value);
      if (!Number.isNaN(num) && num > 0) {
        setAmountEuros(num);
      }
    }
  }

  function handleQuickAmount(amount) {
    setSelectedAmount(amount);
    setAmountEuros(amount);
    setShowCustomInput(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!API_BASE_URL) {
      setError("Missing NEXT_PUBLIC_API_BASE_URL in env.");
      return;
    }

    if (!name.trim()) {
      setError("Name is required.");
      return;
    }

    const amount = Number(amountEuros);
    if (Number.isNaN(amount) || amount <= 0) {
      setError("Amount must be a positive number.");
      return;
    }

    try {
      setLoading(true);

      const res = await fetch(`${API_BASE_URL}/api/donations/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          amountEuros: amount,
          email: email.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.error || "Payment creation failed.");
        return;
      }

      window.location.href = data.checkoutUrl;
    } catch (err) {
      console.error(err);
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#5a3ffb] to-[#2c0f74] flex justify-center p-2">
      <div className="flex-1 flex flex-col items-center justify-center w-full">
        <Hippo>
          {/* CLOUD-LIKE FORM CONTAINER INSIDE HIPPO */}
          <div className="relative w-full mt-7 md:mt-9 z-10">
            {/* bubbles to give a soft cloud feeling */}
            <span className="hidden md:block absolute -top-1 left-6 w-7 h-7 bg-white/60 rounded-full blur-[1px]" />
            <span className="hidden md:block absolute -top-2 right-10 w-9 h-9 bg-white/60 rounded-full blur-[1px]" />
            <span className="hidden md:block absolute bottom-0 right-4 w-6 h-6 bg-white/60 rounded-full blur-[1px]" />

            <form
              onSubmit={handleSubmit}
              className="relative w-full bg-gradient-to-br from-white to-white/85 rounded-[2.5rem] shadow-lg px-6 py-7 md:px-7 md:py-8 border border-white/70 text-[#141326]"
            >
              <h2 className="text-center text-2xl md:text-3xl font-extrabold mb-5 tracking-wider text-[#2c0f74] chewy-regular">
                STEUN EN SPEEL
              </h2>

              {/* NICKNAME */}
              <div className="mb-5">
                <label className="text-[0.65rem] md:text-xs opacity-70 tracking-wide block mb-1">
                  NICKNAME
                </label>
                <input
                  className="w-full p-3 md:p-3.5 bg-white/80 border border-[#d0d8ff] rounded-xl text-sm md:text-base text-[#141326] placeholder-black/40 outline-none focus:ring-2 focus:ring-[#5a3ffb50]"
                  placeholder="UW NICKNAME"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={40}
                  required
                />
              </div>

              {/* E-MAIL */}
              <div className="mb-5">
                <label className="text-[0.65rem] md:text-xs opacity-70 tracking-wide block mb-1">
                  E-MAIL (OPTIONEEL)
                </label>
                <input
                  className="w-full p-3 md:p-3.5 bg-white/80 border border-[#d0d8ff] rounded-xl text-sm md:text-base text-[#141326] placeholder-black/40 outline-none focus:ring-2 focus:ring-[#5a3ffb50]"
                  placeholder="UW E-MAIL"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                />
              </div>

              {/* QUICK AMOUNTS */}
              <div className="flex justify-between mb-5 gap-2">
                {[1, 3, 5].map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => handleQuickAmount(amount)}
                    className={`flex-1 py-3 font-bold rounded-xl text-sm md:text-base transition ${
                      selectedAmount === amount && !showCustomInput
                        ? "bg-[#3f27ff] text-white shadow-md"
                        : "bg-[#e0e4ff] text-[#18153a] hover:bg-[#d0d7ff]"
                    }`}
                  >
                    € {amount}
                  </button>
                ))}
              </div>

              {/* CUSTOM AMOUNT TOGGLER */}
              {/* <button
                type="button"
                className="w-full py-3 rounded-lg font-bold bg-[#7bb4ff] hover:bg-[#6da2e6] transition mb-4 text-white"
                onClick={toggleCustomInput}
              >
                Ander bedrag...
              </button> */}

              {/* CUSTOM AMOUNT INPUT */}
              {showCustomInput && (
                <div className="flex items-center mb-5">
                  <button
                    type="button"
                    onClick={() => handleCustomAmountChange(-1)}
                    className="px-4 py-2 bg-[#e0e4ff] hover:bg-[#d0d7ff] rounded-l-xl font-bold text-[#18153a]"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    value={amountEuros === "" ? "" : amountEuros}
                    onChange={handleCustomAmountInput}
                    className="w-full p-3 bg-white/80 border border-[#d0d8ff] text-[#141326] rounded-none text-center outline-none focus:ring-2 focus:ring-[#5a3ffb50]"
                    min="1"
                  />
                  <button
                    type="button"
                    onClick={() => handleCustomAmountChange(1)}
                    className="px-4 py-2 bg-[#e0e4ff] hover:bg-[#d0d7ff] rounded-r-xl font-bold text-[#18153a]"
                  >
                    +
                  </button>
                </div>
              )}

              {/* ERROR MESSAGE */}
              {error && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 p-3 rounded-xl mb-5">
                  {error}
                </div>
              )}

              {/* SUBMIT BUTTON */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-lg font-bold text-white text-lg bg-gradient-to-r from-[#ffbb00] to-[#ff3b1f] hover:opacity-90 transition disabled:opacity-60 active:scale-95"
              >
                {loading ? "Redirecting to payment..." : "Doneer"}
              </button>

              <p className="mt-4 text-center text-[0.7rem] md:text-xs opacity-70 text-[#141326]">
                * Maximaal aantal beurten bedraagt 5
              </p>
            </form>
          </div>
        </Hippo>
        {/* FOOTER WITH LOGOS */}
        <Footer />
      </div>
    </div>
  );
}
