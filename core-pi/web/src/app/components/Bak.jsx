"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

const Bak = (props) => {
  const router = useRouter();

  const handleClick = () => {
    if (props.path) {
      router.push(props.path);
    }
  };

  return (
    <div className="BakComponent h-full w-full" onClick={handleClick}>
      <div className="bovenkant w-full h-[20%] bg-indigo-950 z-20 flex items-center justify-center">
        <h1 className="text-white text-[4rem] jersey-10-regular ">
          {props.name}
        </h1>
      </div>
      <div className="content w-full h-[60%] flex justify-between relative -z-10">
        <div className="lichtjeslinks h-full w-8 bg-indigo-950 absolute top-0 left-[2%] flex flex-col justify-evenly items-center">
          <div className="bg-blue-400 rounded-full w-5 h-5"></div>
          <div className="bg-blue-400 rounded-full w-5 h-5"></div>
          <div className="bg-blue-400 rounded-full w-5 h-5"></div>
          <div className="bg-blue-400 rounded-full w-5 h-5"></div>
          <div className="bg-blue-400 rounded-full w-5 h-5"></div>
          <div className="bg-blue-400 rounded-full w-5 h-5"></div>
          <div className="bg-blue-400 rounded-full w-5 h-5"></div>
          <div className="bg-blue-400 rounded-full w-5 h-5"></div>
        </div>
        <div className="lichtjesrechts h-full w-8 bg-indigo-950 absolute top-0 right-[2%] flex flex-col justify-evenly items-center">
          <div className="bg-blue-400 rounded-full w-5 h-5"></div>
          <div className="bg-blue-400 rounded-full w-5 h-5"></div>
          <div className="bg-blue-400 rounded-full w-5 h-5"></div>
          <div className="bg-blue-400 rounded-full w-5 h-5"></div>
          <div className="bg-blue-400 rounded-full w-5 h-5"></div>
          <div className="bg-blue-400 rounded-full w-5 h-5"></div>
          <div className="bg-blue-400 rounded-full w-5 h-5"></div>
          <div className="bg-blue-400 rounded-full w-5 h-5"></div>
        </div>
        <div className="w-[93%] h-full m-auto">{props.children}</div>
      </div>
      <div className="onderkant w-full h-[20%] bg-indigo-950">
        <div className="deel1 h-[50%] w-full bg-indigo-950 flex items-center justify-center">
          <figure className="flex g-5 items-center justify-center h-full w-[75%] p-1">
            <Image
              src="./joystick.svg"
              width={0}
              height={0}
              alt="joystick bak"
              className="h-full"></Image>
            <Image
              src="./Knoppen.svg"
              width={0}
              height={0}
              alt="knoppen bak"
              className="h-full"></Image>
          </figure>
        </div>
        <div className="deel2 h-[50%] w-full bg-indigo-900 flex items-center justify-center">
          <p className="text-white jersey-10-regular text-2xl">
            Tik om verder te gaan
          </p>
        </div>
      </div>
    </div>
  );
};

export default Bak;
