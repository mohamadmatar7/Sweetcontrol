"use client";
import React from "react";
import Image from "next/image";

import { useRouter } from "next/navigation";

const page = () => {
  const router = useRouter();
  const handleClick = () => {
    router.push("/HTP");
  };

  return (
    <>
      <div
        className="page w-full h-full bg-linear-to-br from-[#FFB101] to-[#E62322] flex justify-center items-center"
        onClick={handleClick}>
        <div className="content jersey-10-regular h-[90%] w-[90%] text-center text-white text-2xl flex flex-col items-center justify-center p-5">
          <h3>Wij vragen jouw steun voor...</h3>
          <figure className="w-full h-[15%]">
            <Image
              src="/warmsteweeklogo.svg"
              width={0}
              height={0}
              alt="Warmste week logo"
              className="w-full h-full"></Image>
          </figure>
          <div className="titel caveat-brush-regular flex flex-col leading-13">
            <h2 className="text-left text-[3rem]">De</h2>
            <h1 className="text-[5rem]">Warmste</h1>
            <h2 className="text-right text-[3rem]">Week</h2>
          </div>
          <h3 className="text-left w-full">Waarom?</h3>
          <p className="text-left text-[1.3rem] ">
            Met onze interactieve installatie willen we meer bewustzijn creëren
            rond diabetes. We laten spelers op een speelse manier ervaren hoe
            belangrijk het is om de suikerspiegel in balans te houden. Zo hopen
            we meer begrip en aandacht te brengen voor mensen die elke dag met
            diabetes leven.
          </p>
          <p className="text-white jersey-10-regular text-2xl mt-10">
            Tik om verder te gaan
          </p>
        </div>
      </div>
    </>
  );
};

export default page;
