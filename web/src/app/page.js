"use client";

import React from "react";
import Bak from "../app/components/Bak.jsx";
import Image from "next/image";
import { motion, useAnimation } from "framer-motion";
import { useRouter } from "next/navigation";

const Page = () => {
  const controls = useAnimation();
  const router = useRouter();

  // Fade-out + navigate after 3 sec
  const handleClick = async () => {
    await controls.start({
      opacity: 0,
      transition: { duration: 3, ease: "easeInOut" },
    });

    router.push("/warm");
  };

  return (
    <>
      <motion.div
        animate={controls}
        initial={{ opacity: 1 }}
        onClick={handleClick} // ⬅ Klik op de pagina triggert fade-out
        className="w-full h-full cursor-pointer">
        <Bak name="sweet control" path="/warm">
          <motion.figure
            animate={{ y: [0, -10, 0] }}
            transition={{
              duration: 5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="w-full h-full">
            <Image
              src="/grijparmkort.svg"
              width={0}
              height={0}
              alt="Grijparm"
              className="h-[40%]"
            />
            <Image
              src="/Dozen.svg"
              width={0}
              height={0}
              alt="Dozen"
              className="h-[60%] relative -bottom-30 -z-20"
            />
          </motion.figure>
        </Bak>
      </motion.div>
    </>
  );
};

export default Page;
