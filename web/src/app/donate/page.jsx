"use client";

import { useState } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export default function DonateForm() {
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
    <div className="min-h-screen bg-linear-to-br from-[#5a3ffb] to-[#2c0f74] flex items-center justify-center p-6">
      <form
        onSubmit={handleSubmit}
        className="bg-[#0b0b1c] border-2 border-dashed border-white/30 p-8 rounded-xl w-full max-w-sm text-white">
        <h2 className="text-2xl font-semibold mb-6">STEUN EN SPEEL</h2>

        <div className="mb-6">
          <label className="text-xs opacity-80">USERNAME</label>
          <input
            className="w-full p-3 bg-transparent border-2 border-dashed border-[#83b2ff80] rounded-lg text-white placeholder-white/50"
            placeholder="HIER KOMT DE USERNAME"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            required
          />
        </div>

        <div className="mb-6">
          <label className="text-xs opacity-80">EMAIL (OPTIONEEL)</label>
          <input
            className="w-full p-3 bg-transparent border-2 border-dashed border-[#83b2ff80] rounded-lg text-white placeholder-white/50"
            placeholder="HIER KOMT DE EMAIL"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
          />
        </div>

        <div className="flex justify-between mb-6 gap-2">
          {[1, 2, 5].map((amount) => (
            <button
              key={amount}
              type="button"
              onClick={() => handleQuickAmount(amount)}
              className={`flex-1 py-3 font-bold rounded-lg transition ${
                selectedAmount === amount && !showCustomInput
                  ? "bg-[#3f27ff]"
                  : "bg-[#6e7dfc] hover:bg-[#5c6bf0]"
              }`}>
              € {amount}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="w-full py-3 rounded-lg font-bold bg-[#7bb4ff] hover:bg-[#6da2e6] transition mb-6"
          onClick={toggleCustomInput}>
          Ander bedrag...
        </button>

        {showCustomInput && (
          <div className="flex items-center mb-6">
            <button
              type="button"
              onClick={() => handleCustomAmountChange(-1)}
              className="px-4 py-2 bg-[#6e7dfc] hover:bg-[#5c6bf0] rounded-l-lg font-bold">
              -
            </button>
            <input
              type="number"
              value={amountEuros === "" ? "" : amountEuros}
              onChange={handleCustomAmountInput}
              className="w-full p-3 bg-transparent border-2 border-dashed border-[#83b2ff80] rounded-lg text-white text-center placeholder-white/50"
              min="1"
            />
            <button
              type="button"
              onClick={() => handleCustomAmountChange(1)}
              className="px-4 py-2 bg-[#6e7dfc] hover:bg-[#5c6bf0] rounded-r-lg font-bold">
              +
            </button>
          </div>
        )}

        {error && (
          <div className="text-sm text-red-400 bg-red-950/40 p-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-lg font-bold text-white text-lg bg-linear-to-r from-[#ffbb00] to-[#ff3b1f] hover:opacity-90 transition disabled:opacity-60">
          {loading ? "Redirecting to payment..." : "Doneer"}
        </button>

        <p className="mt-4 text-center text-xs opacity-70">
          * Maximaal aantal beurten bedraagt 5
        </p>
      </form>
    </div>
  );
}
