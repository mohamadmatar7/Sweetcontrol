"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Pusher from "pusher-js";
import LiveStreamPlayer from "../components/LiveStreamPlayer";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler
);

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const SOKETI_KEY = process.env.NEXT_PUBLIC_SOKETI_KEY;
const WS_HOST = process.env.NEXT_PUBLIC_SOKETI_WS_HOST;
const WS_PORT = Number(process.env.NEXT_PUBLIC_SOKETI_WS_PORT || 443);
const FORCE_TLS = process.env.NEXT_PUBLIC_SOKETI_FORCE_TLS === "true";

const THEME = {
  bg: "#4a39a3",
  accent: "#FF6B00",
  white: "#ffffff",
  high: "#FF6B00",
};

export default function LiveStreamPage() {
  const [sugarState, setSugarState] = useState(null);
  const [history, setHistory] = useState([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const currentVal = sugarState?.index ?? 100;
  const scannedLabelRaw = sugarState?.lastLabel ?? "niks";

  const isHigh = currentVal > 180;
  const isLow = currentVal < 70;
  const isDanger = isHigh || isLow;

  let hippoImage = "/hippo-happy.png";
  let speechText = "ALLES GOED!";
  let bubbleBgAnimation = "";
  let hippoAnimation = "animate-breathe";

  if (isHigh) {
    hippoImage = "/hippo-sick.png";
    speechText = "HELP! TE HOOG!";
    hippoAnimation = "animate-shake";
    bubbleBgAnimation = "animate-wobble-hard";
  } else if (isLow) {
    hippoImage = "/hippo-sad.png";
    speechText = "HELP! TE LAAG!";
    hippoAnimation = "animate-dizzy";
    bubbleBgAnimation = "animate-wobble-hard";
  }

  // Fetch initial data
  useEffect(() => {
    if (!API_BASE_URL) return;
    async function fetchSugar() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/sugar?t=${Date.now()}`);
        if (res.ok) {
          const data = await res.json();
          if (data.ok && data.index != null) {
            setSugarState(data);
            setHistory([{ t: Date.now(), index: data.index }]);
          }
        }
      } catch (err) {
        console.error("API Fetch Error:", err);
      }
    }
    fetchSugar();
  }, []);

  // Realtime subscription
  useEffect(() => {
    if (!SOKETI_KEY || !WS_HOST) return;

    const pusher = new Pusher(SOKETI_KEY, {
      wsHost: WS_HOST,
      wsPort: WS_PORT,
      wssPort: WS_PORT,
      forceTLS: FORCE_TLS,
      enabledTransports: ["ws", "wss"],
      cluster: "mt1",
    });

    const channel = pusher.subscribe("public-chat");

    channel.bind("sugar-update", (payload) => {
      setSugarState({
        ok: true,
        index: payload.index ?? null,
        lastLabel: payload.lastLabel ?? null,
      });

      if (payload.index != null) {
        setHistory((prev) => {
          const next = [...prev, { t: Date.now(), index: payload.index }];
          return next.slice(-5);
        });
      }
    });

    return () => {
      channel?.unbind_all();
      pusher?.disconnect();
    };
  }, []);

  const customDrawingPlugin = {
    id: "customDrawing",
    beforeDraw: (chart) => {
      const {
        ctx,
        chartArea: { left, right },
        scales: { y },
      } = chart;
      if (!y) return;

      const drawLine = (value, color, text) => {
        const yPos = y.getPixelForValue(value);
        if (yPos < chart.chartArea.top || yPos > chart.chartArea.bottom)
          return;

        ctx.save();
        ctx.beginPath();
        ctx.lineWidth = 3;
        ctx.strokeStyle = color;
        ctx.setLineDash([8, 8]);
        ctx.moveTo(left, yPos);
        ctx.lineTo(right, yPos);
        ctx.stroke();

        ctx.fillStyle = color;
        ctx.textAlign = "left";
        ctx.font = 'bold 16px Arial';
        ctx.fillText(text, left + 5, yPos - 8);
        ctx.restore();
      };

      drawLine(180, THEME.high, "MAX (180)");
      drawLine(70, THEME.high, "MIN (70)");
    },
    afterDatasetsDraw: (chart) => {
      const { ctx } = chart;
      chart.data.datasets.forEach((dataset, i) => {
        const meta = chart.getDatasetMeta(i);
        meta.data.forEach((element, index) => {
          const value = dataset.data[index];
          const { x, y } = element.tooltipPosition();

          ctx.save();
          const isDangerPoint = value < 70 || value > 180;
          ctx.fillStyle = isDangerPoint ? THEME.high : THEME.white;

          ctx.font = "bold 14px Arial";
          ctx.textAlign = "center";
          ctx.textBaseline = "bottom";
          ctx.fillText(Math.round(value), x, y - 15);
          ctx.restore();
        });
      });
    },
  };

  const chartData = {
    labels: history.map(() => ""),
    datasets: [
      {
        data: history.map((p) => p.index),
        borderWidth: 6,
        tension: 0.4,
        pointRadius: 6,
        pointBackgroundColor: THEME.bg,
        pointBorderWidth: 3,
        pointHoverRadius: 8,
        fill: false,
        segment: {
          borderColor: (ctx) => {
            const val = ctx.p1.parsed?.y ?? 100;
            if (val < 70 || val > 180) return THEME.high;
            return THEME.white;
          },
        },
        pointBorderColor: (ctx) => {
          const val = ctx.parsed?.y ?? 100;
          if (val < 70 || val > 180) return THEME.high;
          return THEME.white;
        },
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    layout: { padding: { top: 20, bottom: 10, left: 10, right: 10 } },
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    scales: {
      y: {
        min: 40,
        max: 260,
        grid: { display: false },
        border: { display: true, color: "rgba(255,255,255,0.5)", width: 2 },
        ticks: { display: false },
      },
      x: {
        grid: { display: false },
        border: { display: true, color: "rgba(255,255,255,0.5)", width: 2 },
        ticks: { display: false },
      },
    },
  };

  if (!mounted) return <div className="w-screen h-screen bg-[#4a39a3]" />;

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#5a3ffb] to-[#2c0f74] text-slate-100">
      <style jsx>{`
        @keyframes shake {
          0%,
          100% {
            transform: translate(0, 0);
          }
          25% {
            transform: translate(-3px, 3px);
          }
          75% {
            transform: translate(3px, -3px);
          }
        }
        @keyframes wobble-hard {
          0%,
          100% {
            transform: scale(1) rotate(0deg);
          }
          25% {
            transform: scale(1.05) rotate(-4deg);
          }
          50% {
            transform: scale(1.05) rotate(4deg);
          }
          75% {
            transform: scale(1.05) rotate(-4deg);
          }
        }
        @keyframes dizzy {
          0%,
          100% {
            transform: rotate(-5deg);
            opacity: 0.85;
          }
          50% {
            transform: rotate(5deg);
            opacity: 1;
          }
        }
        @keyframes breathe {
          0%,
          100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.03);
          }
        }
        .animate-shake {
          animation: shake 0.4s infinite;
        }
        .animate-wobble-hard {
          animation: wobble-hard 0.5s infinite;
        }
        .animate-dizzy {
          animation: dizzy 2s infinite ease-in-out;
        }
        .animate-breathe {
          animation: breathe 3s infinite ease-in-out;
        }
        .comic-tail {
          position: absolute;
          bottom: -14px;
          left: 50%;
          transform: translateX(-50%);
          width: 0;
          height: 0;
          border-left: 14px solid transparent;
          border-right: 14px solid transparent;
          border-top: 20px solid white;
        }
      `}</style>

      {/* Back button - absolute positioned */}
      <Link
        href="/"
        className="absolute top-4 left-4 z-50 px-4 py-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg font-semibold transition-all active:scale-95 flex items-center gap-2"
      >
        <span>←</span>
        <span className="hidden sm:inline">Terug</span>
      </Link>

      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-4 lg:py-6 min-h-screen flex flex-col">
        {/* Title (centered) */}
        <header className="relative mb-6 lg:mb-8">
          <h1 className="text-center text-2xl sm:text-3xl lg:text-4xl font-bold">
            Speel online mee via je desktop
          </h1>
        </header>

        {/* Responsive layout: mobile stacked, desktop 65/35 */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-[13fr_7fr] gap-5 lg:gap-6 min-h-0 items-start lg:items-stretch">
          {/* LEFT (65%): Hippo + Graph + info */}
          <section className="min-h-0 flex flex-col gap-6 lg:gap-0 lg:h-full lg:justify-evenly">
            {/* Graph section with Hippo left */}
            <div className="bg-black/20 border-2 border-[#FF6B00]/50 rounded-2xl p-4 sm:p-6 flex flex-col lg:justify-center">
              <div className="flex flex-col lg:flex-row gap-6 min-h-0 lg:items-center">
                {/* Hippo */}
                <div className="lg:w-[34%] shrink-0 flex flex-col items-center justify-center">
                  <div className="relative w-full max-w-[260px] lg:max-w-[320px] mx-auto">
                    {/* Speech bubble */}
                    <div className="relative w-[200px] h-[86px] mb-4 mx-auto">
                      <div
                        className={`w-full h-full bg-white rounded-[40px] border-4 border-black shadow-[4px_4px_0px_#000] ${bubbleBgAnimation}`}
                      >
                        <div className="comic-tail" />
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center p-2">
                        <p
                          className={`text-center uppercase leading-none font-bold ${
                            isDanger ? "text-2xl text-[#FF6B00]" : "text-xl text-black"
                          }`}
                        >
                          {speechText}
                        </p>
                      </div>
                    </div>

                    <img
                      src={hippoImage}
                      alt="Hippo"
                      className={`w-full h-auto object-contain drop-shadow-[0_0_20px_rgba(0,0,0,0.25)] ${hippoAnimation}`}
                    />
                  </div>
                </div>

                {/* Graph + stats */}
                <div className="flex-1 flex flex-col min-h-0">
                  {/* Header */}
                  <div className="flex justify-between items-start gap-4 mb-4">
                    <div className="text-white/90 space-y-1">
                      <span className="text-[#FF6B00] block uppercase tracking-wide text-xl font-bold">
                        LIVE SUIKERSPIEGEL
                      </span>
                      <span className="text-lg leading-tight block opacity-80">
                        Hou de lijn tussen de stippels!
                      </span>
                    </div>

                    <div className="bg-white border-4 border-black px-4 py-2 rounded-xl shadow-lg shrink-0">
                      <span
                        className="text-5xl font-bold leading-none block text-right"
                        style={{ color: THEME.accent }}
                      >
                        {currentVal}
                      </span>
                      <span className="text-lg text-black block text-right">mg/dL</span>
                    </div>
                  </div>

                  {/* Chart */}
                  <div className="w-full h-[220px] sm:h-[260px] lg:h-[280px] xl:h-[320px]">
                    <Line
                      data={chartData}
                      options={chartOptions}
                      plugins={[customDrawingPlugin]}
                    />
                  </div>

                </div>
              </div>

              {/* Last scanned item (full width of the Hippo+Graph frame) */}
              {String(scannedLabelRaw || "")
                .trim()
                .toLowerCase() !== "niks" && (
                <div className="mt-4 bg-black border-2 border-[#FF6B00] rounded-xl p-4 w-full">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <span className="text-[#FF6B00] text-lg tracking-wide uppercase">
                      LAATST GEVANGEN:
                    </span>
                    <span className="text-2xl font-bold text-white uppercase">
                      {scannedLabelRaw}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* QR Code and Logos Section */}
            <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-4 mx-auto w-full max-w-4xl">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                {/* QR Code and text */}
                <div className="flex items-center gap-4">
                  <div className="bg-white rounded-lg p-2 shadow-lg shrink-0">
                    <div className="relative aspect-square w-20 sm:w-24">
                    <Image
                      src="/qr-code-controls.png"
                      alt="QR Code"
                      fill
                      sizes="96px"
                      className="object-contain"
                    />
                    </div>
                  </div>
                  <p className="text-base font-semibold">
                    Scan de QR code en bestuur de kraan via je gsm!
                  </p>
                </div>

                {/* Logos */}
                <div className="flex items-center gap-3">
                  <Image
                    src="/arteveldelogo.svg"
                    alt="Artevelde Logo"
                    width={100}
                    height={50}
                    className="h-10 w-auto"
                  />
                  <Image
                    src="/warmsteweeklogo.svg"
                    alt="Warmste Week Logo"
                    width={100}
                    height={50}
                    className="h-10 w-auto"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* RIGHT (35%): Livestream */}
          <aside className="min-h-0 flex flex-col lg:h-full lg:justify-evenly">
            {/* Cap the stream width on large screens so the 9:16 player doesn't overflow vertically */}
            <div className="w-full sm:max-w-md lg:max-w-[340px] xl:max-w-[380px] mx-auto lg:mx-0 lg:ml-auto">
              <LiveStreamPlayer compact />
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

