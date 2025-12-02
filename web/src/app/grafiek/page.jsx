'use client';

import { useEffect, useState } from 'react';
import Pusher from 'pusher-js';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

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
const FORCE_TLS = process.env.NEXT_PUBLIC_SOKETI_FORCE_TLS === 'true';

const COLORS = {
  bg: '#1E1B4B',       
  lineRed: '#E62322',  
  axisBlue: '#76A6FB', 
};

export default function GraphicPage() {
  const [sugarState, setSugarState] = useState(null);
  const [history, setHistory] = useState([]);

  // 1) Ophalen eerste data
  useEffect(() => {
    if (!API_BASE_URL) return;
    let cancelled = false;
    async function fetchSugar() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/sugar?t=${Date.now()}`);
        if (cancelled || !res.ok) return;
        const data = await res.json();
        if (data.ok) {
          setSugarState(data);
          if (data.index != null) {
            setHistory([{ t: Date.now(), index: data.index }]);
          }
        }
      } catch (err) { console.error(err); }
    }
    fetchSugar();
    return () => { cancelled = true; };
  }, []);

  // 2) Realtime updates
  useEffect(() => {
    if (!SOKETI_KEY || !WS_HOST) return;
    const pusher = new Pusher(SOKETI_KEY, {
      wsHost: WS_HOST,
      wsPort: WS_PORT,
      wssPort: WS_PORT,
      forceTLS: FORCE_TLS,
      enabledTransports: ['ws', 'wss'],
      cluster: 'mt1',
    });

    const channel = pusher.subscribe('public-chat');
    channel.bind('sugar-update', (payload) => {
      const nextState = { 
        ok: true, 
        index: payload.index ?? null,
        lastLabel: payload.lastLabel ?? null 
      };
      
      setSugarState(nextState);

      if (nextState.index != null) {
        setHistory((prev) => {
          const next = [...prev, { t: Date.now(), index: nextState.index }];
          return next.slice(-5); // Max 5 bolletjes
        });
      }
    });

    return () => {
      channel?.unbind_all();
      pusher?.disconnect();
    };
  }, []);

  const currentVal = sugarState?.index ?? null;
  const scannedObject = sugarState?.lastLabel ?? null;
  const isDanger = currentVal && (currentVal < 70 || currentVal > 200);

  // --- CUSTOM PLUGIN ---
  const customDrawingPlugin = {
    id: 'customDrawing',
    beforeDraw: (chart) => {
      const { ctx, chartArea: { left, right }, scales: { y } } = chart;
      
      const drawLine = (value, color, isDashed, text) => {
        const yPos = y.getPixelForValue(value);
        if (yPos < chart.chartArea.top || yPos > chart.chartArea.bottom) return;

        ctx.save();
        ctx.beginPath();
        ctx.lineWidth = 1;
        ctx.strokeStyle = color;
        if (isDashed) ctx.setLineDash([4, 4]);
        ctx.moveTo(left, yPos);
        ctx.lineTo(right, yPos);
        ctx.stroke();

        ctx.fillStyle = color;
        ctx.textAlign = 'right';
        ctx.font = 'bold 10px monospace';
        ctx.fillText(text, right, yPos - 4);
        ctx.restore();
      };

      drawLine(200, COLORS.lineRed, true, '200 (Hoog)');
      drawLine(100, COLORS.axisBlue, true, '100 (Doel)');
      drawLine(70, COLORS.lineRed, true, '70 (Laag)');
    },
    afterDatasetsDraw: (chart) => {
      const { ctx } = chart;
      chart.data.datasets.forEach((dataset, i) => {
        const meta = chart.getDatasetMeta(i);
        meta.data.forEach((element, index) => {
          const value = dataset.data[index];
          const { x, y } = element.tooltipPosition();
          
          ctx.save();
          ctx.font = 'bold 12px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          
          if (value < 70 || value > 200) ctx.fillStyle = COLORS.lineRed;
          else ctx.fillStyle = COLORS.axisBlue;

          // Tekst iets hoger plaatsen (15px boven punt)
          ctx.fillText(Math.round(value), x, y - 15);
          ctx.restore();
        });
      });
    }
  };

  const chartData = {
    labels: history.map((p) => new Date(p.t).toLocaleTimeString([], { hour12: false, timeStyle: 'short' })),
    datasets: [{
        data: history.map((p) => p.index),
        borderWidth: 3,
        tension: 0.3,
        pointRadius: 5,
        pointBackgroundColor: COLORS.bg,
        pointBorderWidth: 2,
        pointHoverRadius: 7,
        fill: false,
        clip: false,
        segment: {
          borderColor: (ctx) => {
             const val = ctx.p1.parsed.y;
             if (val < 70 || val > 200) return COLORS.lineRed;
             return COLORS.axisBlue;
          },
        },
        pointBorderColor: (ctx) => {
            const val = ctx.parsed.y;
            if (val < 70 || val > 200) return COLORS.lineRed;
            return COLORS.axisBlue;
        }
    }],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 0 },
    layout: {
        padding: { right: 40, left: 10, top: 50, bottom: 5 }
    },
    interaction: { mode: 'nearest', axis: 'x', intersect: false },
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    scales: {
      y: {
        min: 50, max: 250,
        grid: { display: false },
        border: { display: true, color: COLORS.axisBlue },
        title: { display: true, text: 'Glucose (mg/dL)', color: COLORS.axisBlue, font: { size: 9, weight: 'bold' } },
        ticks: { display: false }, 
      },
      x: {
        grid: { display: false },
        border: { display: true, color: COLORS.axisBlue },
        title: { display: true, text: 'Tijd', color: COLORS.axisBlue, font: { size: 9 } },
        ticks: { color: COLORS.axisBlue, font: { size: 9 }, maxRotation: 0, autoSkip: false },
      },
    },
  };

  return (
    // AANPASSING: w-screen en h-screen zorgt dat het altijd 100% vult
    // Geen vaste afmetingen meer.
    <main 
        className="w-screen h-screen flex flex-col p-4 overflow-hidden relative"
        style={{ backgroundColor: COLORS.bg }}
    >
        
        {/* HEADER GEBIED - Vaste hoogte (ongeveer 25% van scherm) */}
        <div className="relative flex justify-between items-start mb-1 h-[25%] shrink-0">
            
            {/* 1. LINKS: Titel (Druppel weg, Tekst wit) */}
            <div className="flex flex-col justify-center h-full">
                <h1 className="text-white font-bold text-lg uppercase tracking-wider leading-none">
                    BLOEDSUIKER
                </h1>
                <span className="text-slate-400 text-[10px] mt-1">
                    Live Status
                </span>
            </div>

            {/* 2. MIDDEN: "GEVANGEN" */}
            <div className="absolute left-1/2 -translate-x-1/2 top-2 flex flex-col items-center z-10">
                <div className="bg-slate-900/90 border border-slate-700 px-5 py-2 rounded-xl text-center shadow-lg shadow-black/50">
                    <span className="block text-[9px] text-slate-400 uppercase tracking-[0.2em] mb-1">
                        GEVANGEN
                    </span>
                    <span 
                        className="block text-xl font-black uppercase leading-none tracking-wide truncate max-w-[140px] text-white"
                        style={{ textShadow: '0 0 15px rgba(255, 255, 255, 0.2)' }}
                    >
                        {scannedObject || '...'}
                    </span>
                </div>
            </div>

            {/* 3. RECHTS: Grote Waarde + Status */}
            <div className="text-right h-full flex flex-col justify-center">
                <div className="flex items-baseline justify-end gap-2">
                    <span 
                        className="text-6xl font-bold tabular-nums leading-none"
                        style={{ color: isDanger ? COLORS.lineRed : '#fff' }}
                    >
                        {currentVal ? currentVal.toFixed(0) : '--'}
                    </span>
                    <span className="text-sm font-medium text-slate-400">
                        mg/dL
                    </span>
                </div>
                <div className="mt-1">
                     {isDanger ? (
                        <span className="text-[#E62322] font-bold text-xs uppercase animate-pulse">
                            ⚠️ Let op!
                        </span>
                    ) : (
                        <span className="text-[#76A6FB] font-medium text-xs uppercase opacity-70">
                            ✔ Stabiel
                        </span>
                    )}
                </div>
            </div>
        </div>

        {/* GRAFIEK GEBIED - Vult de rest van het scherm */}
        <div className="flex-1 w-full relative border-t border-[#76A6FB]/20 pt-2 min-h-0">
             {!history.length ? (
                <div className="absolute inset-0 flex items-center justify-center text-[#76A6FB] opacity-50 text-sm">
                   Klaar om te vangen...
                </div>
             ) : (
                <Line 
                    data={chartData} 
                    options={chartOptions} 
                    plugins={[customDrawingPlugin]} 
                />
             )}
        </div>
    </main>
  );
}