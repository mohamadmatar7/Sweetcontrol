"use client";

import { useEffect, useState, useRef } from "react";
import Pusher from "pusher-js";

export default function MotorPage() {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const positionRef = useRef({ x: 0, y: 0 });
  const [grab, setGrab] = useState(false);
  const [objects, setObjects] = useState([]);

  // 🎯 Setup Pusher (connect once)
  useEffect(() => {
    const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY, {
      wsHost: process.env.NEXT_PUBLIC_SOKETI_HOST,
      wsPort: Number(process.env.NEXT_PUBLIC_SOKETI_PORT),
      forceTLS: process.env.NEXT_PUBLIC_SOKETI_TLS === "true",
      enabledTransports: ["ws", "wss"],
    });

    const channel = pusher.subscribe("joystick-channel");

    // ✅ When connection is ready, initialize game
    pusher.connection.bind("connected", async () => {
      console.log("✅ Pusher connected — requesting objects...");
      await fetch(`${process.env.NEXT_PUBLIC_CORE_URL}/send-event`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: "joystick-channel",
          event: "init-game",
          data: {},
        }),
      });
    });

    // 🎮 Receive initial objects from server
    channel.bind("objects-init", (data) => {
      console.log("🎮 Received objects from server:", data);
      setObjects(data);
    });

    // ✋ Object grabbed from server
    channel.bind("object-grabbed", (obj) => {
      console.log("🎯 Grabbed from server:", obj);
      setObjects((prev) => prev.filter((o) => o.x !== obj.x || o.y !== obj.y));
    });

    // 🎮 Movement handler
    channel.bind("move", (data) => {
      const step = 20;
      setPosition((prev) => {
        const newX = Math.max(-120, Math.min(120, prev.x + (data.direction === "right" ? step : data.direction === "left" ? -step : 0)));
        const newY = Math.max(-120, Math.min(120, prev.y + (data.direction === "down" ? step : data.direction === "up" ? -step : 0)));
        const newPos = { x: newX, y: newY };
        positionRef.current = newPos;
        return newPos;
      });
    });

    // 🤚 Grab animation
    channel.bind("grab", (data) => {
      if (data.active) {
        setGrab(true);
        setTimeout(() => setGrab(false), 400);
      }
    });

    return () => {
      channel.unbind_all();
      pusher.unsubscribe("joystick-channel");
      pusher.disconnect();
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center text-white">
      <h1 className="text-3xl font-bold mb-8">Motor Simulation</h1>

      <div className="relative w-80 h-80 bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
        {/* Render objects */}
        {objects.map((obj, i) => (
          <div
            key={i}
            className={`absolute w-6 h-6 rounded-full shadow-lg ${
              obj.type === "food" ? "bg-red-500" : "bg-green-500"
            }`}
            style={{ left: `${obj.x}px`, top: `${obj.y}px` }}
            title={obj.type === "food" ? obj.food : obj.exercise}
          ></div>
        ))}

        {/* Claw */}
        <div
          className={`absolute w-12 h-12 rounded-full transition-all duration-150 flex items-center justify-center ${
            grab ? "bg-red-400 scale-90" : "bg-blue-400"
          }`}
          style={{
            left: `${position.x + 130}px`,
            top: `${position.y + 130}px`,
          }}
        ></div>
      </div>

      <p className="mt-6 text-gray-400 text-sm text-center max-w-xs">
        Move the joystick to collect bad foods (red) and good exercises (green).
      </p>
    </div>
  );
}