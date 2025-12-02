'use client';

import React, { useEffect, useRef, useState } from 'react';
import Pusher from 'pusher-js';

const SOKETI_KEY = process.env.NEXT_PUBLIC_SOKETI_KEY;
const WS_HOST = process.env.NEXT_PUBLIC_SOKETI_WS_HOST;
const WS_PORT = Number(process.env.NEXT_PUBLIC_SOKETI_WS_PORT || 443);
const FORCE_TLS = process.env.NEXT_PUBLIC_SOKETI_FORCE_TLS === 'true';

export default function EyesPage() {
  const leftEyeRef = useRef(null);
  const rightEyeRef = useRef(null);
  
  // We gebruiken refs om waarden bij te houden zonder re-renders (voor performance)
  const state = useRef({
    currentScale: 1,    // Huidige openheid
    targetScale: 1,     // Waar we naartoe willen (voor knipperen/mood)
    currentX: 0,        // Huidige oog positie X
    targetX: 0,         // Muis positie X
    currentY: 0,        // Huidige oog positie Y
    targetY: 0,         // Muis positie Y
    shake: 0,           // Hoeveelheid trillen (stress)
    mood: 'normal',
    sugar: 100
  });

  const [debugLabel, setDebugLabel] = useState('Laden...');

  useEffect(() => {
    let animationFrameId;
    let blinkTimeoutId;

    // --- 1. De "Game Loop" (Draait 60x per seconde) ---
    // Dit vervangt GSAP. Het zorgt voor soepele bewegingen.
    const animate = () => {
      const s = state.current;
      const leftEye = leftEyeRef.current;
      const rightEye = rightEyeRef.current;

      if (!leftEye || !rightEye) return;

      // A. Smoothness (Lerp): Beweeg de huidige waarde langzaam naar de doelwaarde
      // 0.1 betekent: verplaats 10% van de afstand per frame (zorgt voor vertraging/soepelheid)
      let speed = s.mood === 'sleepy' ? 0.05 : s.mood === 'stressed' ? 0.3 : 0.1;
      
      s.currentScale += (s.targetScale - s.currentScale) * 0.1;
      s.currentX += (s.targetX - s.currentX) * speed;
      s.currentY += (s.targetY - s.currentY) * speed;

      // B. Shake effect (voor stress)
      let offsetX = 0;
      let offsetY = 0;
      if (s.shake > 0) {
        offsetX = (Math.random() - 0.5) * s.shake * 5;
        offsetY = (Math.random() - 0.5) * s.shake * 5;
      }

      // C. Update de DOM (De daadwerkelijke stijl aanpassing)
      // We gebruiken transform, dat is heel licht voor de tablet processor
      const transformString = `translate(${s.currentX + offsetX}px, ${s.currentY + offsetY}px) scaleY(${s.currentScale})`;
      
      leftEye.style.transform = transformString;
      rightEye.style.transform = transformString;

      // Blijf deze functie herhalen
      animationFrameId = requestAnimationFrame(animate);
    };

    // Start de loop
    animate();


    // --- 2. Logica Functies ---

    const updateMood = (val) => {
      const s = state.current;
      s.sugar = val;
      
      let newMood = 'normal';
      if (val < 70) newMood = 'sleepy';
      else if (val > 200) newMood = 'stressed';

      if (s.mood !== newMood) {
        s.mood = newMood;
        // Zet de basis waarden voor de mood
        if (newMood === 'sleepy') {
          s.targetScale = 0.4;
          s.shake = 0;
        } else if (newMood === 'stressed') {
          s.targetScale = 1.2;
          s.shake = 2;
        } else {
          s.targetScale = 1;
          s.shake = 0;
        }
      }
    };

    const blink = () => {
      const s = state.current;
      const originalScale = s.targetScale; // Onthoud hoe open ze waren

      // Ogen dicht
      s.targetScale = 0.1;

      // Ogen weer open na 150ms
      setTimeout(() => {
        // Alleen terugzetten als we niet ondertussen van mood gewisseld zijn
        // (Simpele check: we zetten hem terug naar wat de mood dicteert)
        if (s.mood === 'sleepy') s.targetScale = 0.4;
        else if (s.mood === 'stressed') s.targetScale = 1.2;
        else s.targetScale = 1;
        
        scheduleBlink();
      }, 150);
    };

    const scheduleBlink = () => {
      clearTimeout(blinkTimeoutId);
      const s = state.current;
      
      let delay = Math.random() * 3000 + 2000;
      if (s.mood === 'sleepy') delay = Math.random() * 2000 + 500;
      if (s.mood === 'stressed') delay = Math.random() * 1000 + 200;

      blinkTimeoutId = setTimeout(blink, delay);
    };

    // Start eerste blink timer
    scheduleBlink();


    // --- 3. Events (Muis & Touch) ---

    const handleInput = (clientX, clientY) => {
      // Bereken afstand vanaf midden van scherm
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      
      // Beperk de beweging (delen door 15) zodat ogen niet uit de kassen vliegen
      state.current.targetX = (clientX - cx) / 15;
      state.current.targetY = (clientY - cy) / 15;
    };

    const onMouseMove = (e) => handleInput(e.clientX, e.clientY);
    const onTouchMove = (e) => {
       // Support voor touchscreens (tablets)
       if (e.touches[0]) {
         handleInput(e.touches[0].clientX, e.touches[0].clientY);
       }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('touchmove', onTouchMove);


    // --- 4. Pusher Verbinding ---
    let pusher;
    let channel;

    if (SOKETI_KEY && WS_HOST) {
        try {
            pusher = new Pusher(SOKETI_KEY, {
                wsHost: WS_HOST, wsPort: WS_PORT, wssPort: WS_PORT,
                forceTLS: FORCE_TLS, enabledTransports: ['ws', 'wss'], cluster: 'mt1',
            });
            channel = pusher.subscribe('public-chat');
            channel.bind('sugar-update', (payload) => {
                const val = payload.index;
                setDebugLabel(payload.lastLabel || '...');
                updateMood(val);
            });
        } catch (e) { console.error(e); }
    } else {
        // Fallback: update mood handmatig om te testen als er geen pusher is
        updateMood(100); 
    }

    // --- Cleanup ---
    return () => {
      cancelAnimationFrame(animationFrameId);
      clearTimeout(blinkTimeoutId);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('touchmove', onTouchMove);
      if (channel) channel.unbind_all();
      if (pusher) pusher.disconnect();
    };
  }, []);

  // --- STYLING (Inlines voor maximale compatibiliteit) ---
  const containerStyle = {
    position: 'fixed',
    top: 0, left: 0, width: '100%', height: '100%',
    backgroundColor: 'black',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden'
  };

  const eyeStyle = {
    width: '180px', // Pas aan indien te groot/klein op tablet
    height: '180px',
    backgroundColor: 'white',
    borderRadius: '50%',
    margin: '0 30px', // Vervangt gap
    boxShadow: '0 0 20px rgba(255,255,255,0.2)',
    // Will-change helpt de tablet processor te snappen dat dit beweegt
    willChange: 'transform' 
  };

  return (
    <div style={containerStyle}>
      {/* Debug text linksboven (optioneel) */}
      <div style={{ position: 'absolute', top: 10, left: 10, color: '#333', fontSize: '10px' }}>
         {debugLabel}
      </div>

      <div ref={leftEyeRef} style={eyeStyle}></div>
      <div ref={rightEyeRef} style={eyeStyle}></div>
    </div>
  );
};