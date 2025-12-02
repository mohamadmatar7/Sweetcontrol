"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation"; // Import useRouter
import Bak from "../components/Bak.jsx";
import Image from "next/image";

const page = () => {
  const images = ["./doeldoos.svg", "./controlsdoos.svg", "./donatiedoos.svg"];
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isGrabbing, setIsGrabbing] = useState(false); // arm going down/up
  const [isHeld, setIsHeld] = useState(false); // heeft de arm de doos vast
  const router = useRouter();

  const ANIM_DURATION = 300; // ms, hou consistent met de tailwind duration class

  const handleImageClick = () => {
    // Eerste klik: arm moet eerst de doos pakken (doos staat initieel laag)
    if (!isHeld) {
      setIsGrabbing(true);
      setTimeout(() => {
        setIsHeld(true); // doos wordt vastgehouden en omhoog getrokken
        setIsGrabbing(false);
      }, ANIM_DURATION);
      return;
    }

    // volgende kliks: standaard gedrag met animatie en wisselen van afbeelding / navigatie
    setIsGrabbing(true);
    if (currentImageIndex === images.length - 1) {
      setTimeout(() => {
        router.push("/donate");
        setIsGrabbing(false);
      }, ANIM_DURATION);
    } else {
      setTimeout(() => {
        setCurrentImageIndex((prevIndex) => prevIndex + 1);
        setIsGrabbing(false);
      }, ANIM_DURATION);
    }
  };

  return (
    <div className="h-full w-full" onClick={handleImageClick}>
      <Bak name="How to play">
        <figure className="h-full w-full relative">
          {/* grijparm: gaat omlaag bij grab, anders iets omhoog wanneer hij een doos vasthoudt */}
          <Image
            src="./grijparmlang.svg"
            width={0}
            height={0}
            alt="grijparm lang"
            className={`h-full relative transform transition-transform duration-300 ease-in-out ${
              isGrabbing
                ? "translate-y-4"
                : isHeld
                ? "-translate-y-70"
                : "-translate-y-70"
            }`}
          />

          {/* doos: start laag (translate-y-16). Als vastgehouden: omhoog mee (negatieve translate).
              Als arm even omlaag gaat terwijl hij de doos vasthoudt, laat de doos ook even meebewegen */}
          <Image
            src={images[currentImageIndex]}
            height={0}
            width={0}
            alt="Doos met text"
            className={`h-[70%] relative transform transition-transform duration-300 ease-in-out pb-5 pl-5 pr-5 ${
              !isHeld
                ? "translate-y-4"
                : isGrabbing
                ? "translate-y-70"
                : "-translate-y-70"
            }`}
          />
        </figure>
      </Bak>
    </div>
  );
};

export default page;
