//voeg hier je code toe Sander
'use client';

/**
 * ------------------------------------------------------------------
 * PROJECT: DIABETES AWARENESS ARCADE (WARMSTE WEEK)
 * COMPONENT: Main Dashboard Page
 * DESCRIPTION: Displays real-time glucose levels and scanned objects
 * on a Raspberry Pi screen (15.5cm x 10.5cm).
 * ------------------------------------------------------------------
 */

import { useEffect, useState } from 'react';
import Pusher from 'pusher-js'; // Library for WebSocket connections (Soketi)
import { Chewy, Caveat_Brush, Jersey_10 } from 'next/font/google'; // Custom Google Fonts

// Chart.js imports for the glucose graph
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

// --- FONT CONFIGURATION ---
// We use 'Chewy' for big headers, 'Caveat' for handwriting style, and 'Jersey 10' for technical data.
const chewy = Chewy({ 
  weight: '400', 
  subsets: ['latin'],
  variable: '--font-chewy',
  display: 'swap',
});

const caveatBrush = Caveat_Brush({ 
  weight: '400', 
  subsets: ['latin'],
  variable: '--font-caveat',
  display: 'swap',
});

const jersey10 = Jersey_10({ 
  weight: '400', 
  subsets: ['latin'],
  variable: '--font-jersey',
  display: 'swap',
});

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler
);

// --- ENVIRONMENT VARIABLES ---
// Connection details for the backend API and Soketi WebSocket server
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const SOKETI_KEY = process.env.NEXT_PUBLIC_SOKETI_KEY;
const WS_HOST = process.env.NEXT_PUBLIC_SOKETI_WS_HOST;
const WS_PORT = Number(process.env.NEXT_PUBLIC_SOKETI_WS_PORT || 443);
const FORCE_TLS = process.env.NEXT_PUBLIC_SOKETI_FORCE_TLS === 'true';

// --- THEME COLORS ---
const THEME = {
  bg: '#4a39a3',       // Main Purple Background
  accent: '#FF6B00',   // Warmste Week Orange
  white: '#ffffff',
  black: '#000000',
  high: '#FF6B00',     // Orange/Red for Hyperglycemia
  low: '#3b82f6',      // Blue for Hypoglycemia
  good: '#22c55e',     // Green for Stable levels
};

// --- OBJECT MAPPING ---
// Maps the label received from the Vision Pi to a corresponding Emoji
const OBJECT_ICONS = {
    'donut': '🍩',
    'blikje cola': '🥤',
    'appel': '🍎',
    'doos insuline': '💉',
    'schoen': '👟',
    'kettlebell': '🏋️',
    'water': '💧',
    'niks': '...'
};

export default function ArcadePage() {
  // State to hold the current glucose data (index) and last scanned label
  const [sugarState, setSugarState] = useState(null);
  
  // State to store the history of data points for the graph
  const [history, setHistory] = useState([]);
  
  // State to handle client-side rendering checks
  const [mounted, setMounted] = useState(false);
  
  // State to drive the blinking animations (toggles every 500ms)
  const [blink, setBlink] = useState(false);

  // --- INITIAL MOUNT ---
  useEffect(() => {
    setMounted(true);
    // Start the blinking interval for animations
    const interval = setInterval(() => setBlink(b => !b), 500);
    return () => clearInterval(interval);
  }, []);

  // --- DERIVED STATE ---
  // Safely get current value, default to 100 if no data yet
  const currentVal = sugarState?.index ?? 100; 
  const scannedLabelRaw = sugarState?.lastLabel ?? "niks";
  const scannedLabel = scannedLabelRaw.toLowerCase();
  
  // Determine health status based on glucose thresholds
  const isHigh = currentVal > 180;
  const isLow = currentVal < 70;
  const isDanger = isHigh || isLow;

  // --- 1. INITIAL DATA FETCH ---
  // Fetches the latest known state from the API when the page loads
  useEffect(() => {
    if (!API_BASE_URL) return;
    
    async function fetchSugar() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/sugar?t=${Date.now()}`);
        if (res.ok) {
            const data = await res.json();
            if (data.ok && data.index != null) {
                setSugarState(data);
                // Initialize graph with the first point
                setHistory([{ t: Date.now(), index: data.index }]);
            }
        }
      } catch (err) { console.error("API Fetch Error:", err); }
    }
    fetchSugar();
  }, []);

  // --- 2. REALTIME SUBSCRIPTION (SOKETI) ---
  // Connects to the WebSocket to receive updates from the Vision Pi instantly
  useEffect(() => {
    if (!SOKETI_KEY || !WS_HOST) {
        console.warn("Missing Soketi Keys - Live updates disabled");
        return;
    }

    const pusher = new Pusher(SOKETI_KEY, {
      wsHost: WS_HOST,
      wsPort: WS_PORT,
      wssPort: WS_PORT,
      forceTLS: FORCE_TLS,
      enabledTransports: ['ws', 'wss'],
      cluster: 'mt1',
    });

    const channel = pusher.subscribe('public-chat');
    
    // Listen for 'sugar-update' events
    channel.bind('sugar-update', (payload) => {
      // Update the main state
      setSugarState({ 
          ok: true, 
          index: payload.index ?? null, 
          lastLabel: payload.lastLabel ?? null 
      });

      // Update graph history (keep max 5 points for cleanliness)
      if (payload.index != null) {
        setHistory((prev) => {
            const next = [...prev, { t: Date.now(), index: payload.index }];
            return next.slice(-5); 
        });
      }
    });

    // Cleanup on unmount
    return () => { 
        channel?.unbind_all(); 
        pusher?.disconnect(); 
    };
  }, []);

  // --- VISUAL LOGIC ---
  // Determine which Hippo image, text, and animations to show based on status
  let hippoImage = "/hippo-happy.png"; 
  let speechText = "ALLES GOED!";
  let bubbleBgAnimation = ""; 
  let hippoAnimation = "animate-breathe"; // Gentle breathing by default

  if (isHigh) {
    hippoImage = "/hippo-sick.png";
    speechText = "HELP! TE HOOG!";
    hippoAnimation = "animate-shake"; // Fast shaking for high sugar
    bubbleBgAnimation = "animate-wobble-hard"; 
  } else if (isLow) {
    hippoImage = "/hippo-sad.png";
    speechText = "HELP! TE LAAG!";
    hippoAnimation = "animate-dizzy"; // Slow dizzy wobble for low sugar
    bubbleBgAnimation = "animate-wobble-hard";
  }

  // Get the correct emoji icon
  const currentIcon = OBJECT_ICONS[scannedLabel] || OBJECT_ICONS[Object.keys(OBJECT_ICONS).find(key => scannedLabel.includes(key))] || '📦';

  // --- CUSTOM CHART PLUGIN ---
  // Custom logic to draw the limit lines (180/70) and values on the chart
  const customDrawingPlugin = {
    id: 'customDrawing',
    
    // Draw the Dashed Limit Lines (Background layer)
    beforeDraw: (chart) => {
      const { ctx, chartArea: { left, right }, scales: { y } } = chart;
      if (!y) return;

      const drawLine = (value, color, text) => {
        const yPos = y.getPixelForValue(value);
        if (yPos < chart.chartArea.top || yPos > chart.chartArea.bottom) return;

        ctx.save();
        ctx.beginPath();
        ctx.lineWidth = 3; 
        ctx.strokeStyle = color;
        ctx.setLineDash([8, 8]); // Create dashed effect
        ctx.moveTo(left, yPos);
        ctx.lineTo(right, yPos);
        ctx.stroke();
        
        // Draw label (MAX/MIN)
        ctx.fillStyle = color;
        ctx.textAlign = 'left';
        ctx.font = 'bold 16px "Jersey 10"'; 
        ctx.fillText(text, left + 5, yPos - 8);
        ctx.restore();
      };

      drawLine(180, THEME.high, 'MAX (180)');
      drawLine(70, THEME.high, 'MIN (70)');
    },

    // Draw the Numeric Values above the points (Foreground layer)
    afterDatasetsDraw: (chart) => {
        const { ctx } = chart;
        chart.data.datasets.forEach((dataset, i) => {
          const meta = chart.getDatasetMeta(i);
          meta.data.forEach((element, index) => {
            const value = dataset.data[index];
            const { x, y } = element.tooltipPosition();
            
            ctx.save();
            // Color logic: White if safe, Orange if dangerous
            const isDangerPoint = value < 70 || value > 180;
            ctx.fillStyle = isDangerPoint ? THEME.high : THEME.white;
            
            ctx.font = 'bold 14px "Jersey 10"';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(Math.round(value), x, y - 15); // Place text 15px above dot
            ctx.restore();
          });
        });
      }
  };

  // --- CHART CONFIGURATION ---
  const chartData = {
    labels: history.map(() => ""), // Empty labels on X-axis
    datasets: [{
        data: history.map((p) => p.index),
        borderWidth: 6,
        tension: 0.4, // Smooth curve
        pointRadius: 6,
        pointBackgroundColor: THEME.bg, 
        pointBorderWidth: 3,
        pointHoverRadius: 8,
        fill: false,
        // Segment coloring: Change line color based on value
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
        }
    }],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false, // Disable chart animation for performance on Pi
    layout: { padding: { top: 20, bottom: 10, left: 10, right: 10 } },
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    scales: {
      y: { 
        min: 40, max: 260, 
        grid: { display: false }, 
        border: { display: true, color: 'rgba(255,255,255,0.5)', width: 2 }, 
        ticks: { display: false } 
      },
      x: { 
        grid: { display: false }, 
        border: { display: true, color: 'rgba(255,255,255,0.5)', width: 2 }, 
        ticks: { display: false } 
      },
    },
  };

  // Prevent hydration errors by not rendering until mounted
  if (!mounted) return <div style={{backgroundColor: THEME.bg}} className="w-screen h-screen" />;

  return (
    <main className={`${chewy.variable} ${caveatBrush.variable} ${jersey10.variable} w-screen h-screen overflow-hidden relative select-none flex`}
          style={{ backgroundColor: THEME.bg }}>
      
      {/* --- INLINE STYLES FOR ANIMATIONS & COMIC TAIL --- */}
      <style jsx>{`
        /* Font Variables Mapping */
        .font-chewy { font-family: var(--font-chewy); }
        .font-caveat { font-family: var(--font-caveat); }
        .font-jersey { font-family: var(--font-jersey); }

        /* Animation Keyframes */
        @keyframes shake {
          0%, 100% { transform: translate(0, 0); }
          25% { transform: translate(-3px, 3px); }
          75% { transform: translate(3px, -3px); }
        }
        @keyframes wobble-hard {
          0%, 100% { transform: scale(1) rotate(0deg); }
          25% { transform: scale(1.1) rotate(-5deg); }
          50% { transform: scale(1.1) rotate(5deg); }
          75% { transform: scale(1.1) rotate(-5deg); }
        }
        @keyframes dizzy {
          0%, 100% { transform: rotate(-5deg); opacity: 0.8; }
          50% { transform: rotate(5deg); opacity: 1; }
        }
        @keyframes breathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.03); }
        }

        .text-xl { font-size: 2.25rem; }

        /* Animation Classes */
        .animate-shake { animation: shake 0.4s infinite; }
        .animate-wobble-hard { animation: wobble-hard 0.4s infinite; }
        .animate-dizzy { animation: dizzy 2s infinite ease-in-out; }
        .animate-breathe { animation: breathe 3s infinite ease-in-out; }

        /* CSS Triangle for the speech bubble tail */
        .comic-tail {
            position: absolute;
            bottom: -18px; 
            right: 30%; 
            width: 0; 
            height: 0; 
            border-left: 15px solid transparent;
            border-right: 15px solid transparent; 
            border-top: 25px solid white; 
        }
      `}</style>

      {/* --- LEFT PANEL: MASCOT & LOGO (45% Width) --- */}
      <div className="w-[45%] h-full relative z-10 p-4">
        
        {/* LOGO: Absolute Top Right */}
        <img 
            src="/dww-logo.svg" 
            alt="De Warmste Week"
            className="absolute top-4 left-28 h-24 w-auto object-contain drop-shadow-md z-30"
        />

        {/* SPEECH BUBBLE: Absolute Top Left */}
        <div className="absolute top-[12%] left-[5%] z-20 w-[180px] h-[90px]">
            {/* Layer 1: Moving Background (The Bubble) */}
            <div className={`w-full h-full bg-white rounded-[40px] border-4 border-black shadow-[4px_4px_0px_#000]
                    ${bubbleBgAnimation}`}>
                    <div className="comic-tail"></div>
            </div>
            {/* Layer 2: Static Text */}
            <div className="absolute inset-0 flex items-center justify-center p-2">
                <p className={`font-chewy text-center uppercase leading-none
                    ${isDanger ? 'text-2xl text-[#FF6B00]' : 'text-xl text-black'}`}>
                    {speechText}
                </p>
            </div>
        </div>

        {/* HIPPO MASCOT: Absolute Bottom Center */}
        <img 
            src={hippoImage} 
            alt="Hippo Mood" 
            className={`absolute bottom-2 left-1/2 -translate-x-1/2 max-h-[65%] w-auto h-auto object-contain drop-shadow-[0_0_20px_rgba(0,0,0,0.3)] z-10
                ${hippoAnimation}`} 
        />
      </div>

      {/* --- RIGHT PANEL: DATA & SCANNER (55% Width) --- */}
      <div className="w-[55%] h-full flex flex-col relative z-10 bg-black/20 border-l-4 border-[#FF6B00]/50">
        
        {/* TOP SECTION: CHART & SCORE */}
        <div className="flex-1 relative p-2 flex flex-col">
            
            {/* Header Flexbox */}
            <div className="flex justify-between items-start mb-2 shrink-0">
                {/* Information Text */}
                <div className="text-white/90 font-jersey space-y-1 drop-shadow-md max-w-[70%]">
                     <span className="text-[#FF6B00] block uppercase tracking-wide text-xl font-bold">LIVE SUIKERSPIEGEL</span>
                     <span className="text-xl leading-tight block opacity-80">Hou de lijn tussen de stippels!</span>
                </div>

                {/* Live Score Box */}
                <div className="bg-white border-4 border-black px-3 py-1 rounded-xl shadow-[3px_3px_0px_rgba(0,0,0,0.2)]">
                    <span className="font-chewy text-5xl leading-none block text-right" style={{ color: THEME.accent }}>
                        {currentVal}
                    </span>
                    <span className="font-jersey text-lg text-black block text-right">
                        mg/dL
                    </span>
                </div>
            </div>

            {/* Chart Container (Fills remaining height) */}
            <div className="flex-1 w-full min-h-0">
                <Line 
                    data={chartData} 
                    options={chartOptions} 
                    plugins={[customDrawingPlugin]} 
                />
            </div>
        </div>

        {/* BOTTOM SECTION: SCANNER BAR */}
        <div className="h-[70px] shrink-0 bg-black border-t-4 border-[#FF6B00] flex items-center justify-between px-6 z-30">
            <div className="flex items-center gap-4 w-full">
                
                {/* Scanned Icon */}
                <div className="w-12 h-12 shrink-0 rounded-full bg-white flex items-center justify-center border-2 border-[#FF6B00]">
                    <span className="text-2xl animate-breathe">
                        {currentIcon}
                    </span>
                </div>

                {/* Scanned Text */}
                <div className="flex flex-row justify-start items-center gap-4 flex-1 ml-2 overflow-hidden">
                    <span className="font-jersey text-xl text-[#FF6B00] mb-0.5 tracking-widest uppercase">
                        LAATST GEVANGEN:
                    </span>
                    <span className="font-chewy text-3xl uppercase tracking-wide text-white leading-none truncate">
                        {scannedLabelRaw}
                    </span>
                </div>
            </div>
        </div>

      </div>
    </main>
  );
}