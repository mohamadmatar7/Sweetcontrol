import React from "react";
import Image from "next/image";
import styles from "./page.css";

const page = () => {
  return (
    <div className="h-full w-full bg-linear-to-br from-[#5B3FEE] to-[#26196E] flex flex-col justify-center">
      <div className="content text-white p-5 text-center flex flex-col gap-5">
        <h2 className=" text-2xl caveat-brush-regular">
          Bedankt voor het spelen van
        </h2>
        <h1 className=" text-[3rem] jersey-10-regular">SweetControl</h1>
        <h3 className=" text-[1.2rem] caveat-brush-regular">
          Makers van SweetControl
        </h3>
        <div className="creators-grid jersey-10-regular text-[1.2rem] leading-4">
          <div className="creator-card">
            <div className="bg-amber-300"></div>
            <p>Sander Pollet</p>
          </div>
          <div className="creator-card">
            <div className="bg-amber-300"></div>
            <p>Emile Bergers</p>
          </div>
          <div className="creator-card">
            <div className="bg-amber-300"></div>
            <p>Mohamad Matar</p>
          </div>
          <div className="creator-card">
            <div className="bg-amber-300"></div>
            <p>Vik Sluijter</p>
          </div>
        </div>
        <div className="text-left flex flex-col gap-3">
          <h3 className="jersey-10-regular text-[1.2rem]">
            Interactive Media Development - IMD
          </h3>
          <p className="caveat-brush-regular text-[1rem]">
            In Interactive Media Development leer je creatieve digitale
            projecten maken, zoals websites, apps en interactieve installaties.
            Je combineert design met technologie en leert programmeren,
            prototypen en samenwerken aan echte projecten.
          </p>
        </div>
        <figure className="w-full h-full max-w-60 ml-auto">
          <Image
            className="w-full h-full"
            src="/arteveldelogo.svg"
            width={0}
            height={0}
            alt="arteveldehogeschool logo"></Image>
        </figure>
      </div>
    </div>
  );
};

export default page;
