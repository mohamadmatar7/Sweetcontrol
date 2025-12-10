"use client";
import React from "react";
import Image from "next/image";

import { useRouter } from "next/navigation";

const page = () => {
  const router = useRouter();
  const handleClick = () => {
    router.push("/how-to-play");
  };

  return (
    <>
      <div
        className="min-h-screen w-full bg-gradient-to-br from-[#FFB101] to-[#E62322] flex justify-center items-center"
        onClick={handleClick}>
        <div className="max-w-3xl text-center text-white text-2xl flex flex-col items-center justify-center p-5">
          <h3>Wij vragen jouw steun voor...</h3>
          <figure className="w-full my-4">
            <Image
              src="/warmsteweeklogo.svg"
              width={0}
              height={0}
              alt="Warmste week logo"
              className="w-full h-[20vh] sm:h-[35vh]"></Image>
          </figure>
          {/* <div className="caveat-brush-regular flex flex-col leading-[3.25rem]">
            <h2 className="text-left text-[3rem]">De</h2>
            <h1 className="text-[5rem]">Warmste</h1>
            <h2 className="text-right text-[3rem]">Week</h2>
          </div> */}
          <div className="px-2">
            <h3 className="text-left w-full">Waarom?</h3>
            <p className="text-left text-[1.3rem] leading-[1.75rem]">
              Met onze interactieve installatie willen we meer bewustzijn creëren
              rond diabetes. We laten spelers op een speelse manier ervaren hoe
              belangrijk het is om de suikerspiegel in balans te houden. Zo hopen
              we meer begrip en aandacht te brengen voor mensen die elke dag met
              diabetes leven.
            </p>
          </div>
          <div className="text-white text-2xl mt-7 border-2 border-white rounded-full px-6 py-2 hover:bg-white hover:text-[#E62322] transition-all duration-300 cursor-pointer">
            Tik om verder te gaan
          </div>
        </div>
      </div>
    </>
  );
};

export default page;