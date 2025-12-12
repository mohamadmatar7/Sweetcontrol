"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Footer() {
  const pathname = usePathname();
  const isTeamPage = pathname === "/team";
  const isDisclaimerPage = pathname === "/disclaimer";

  return (
    <footer className="w-full max-w-3xl mt-1 mb-3 px-1 mx-auto overflow-x-hidden">
      <div className="flex flex-nowrap items-center justify-between gap-2">
        {/* Left logo */}
        <div className="flex items-center justify-center shrink-0">
          <Image
            src="/arteveldelogo.svg"
            alt="Arteveldehogeschool"
            width={200}
            height={48}
            className="h-10 sm:h-12 md:h-20 w-auto object-contain"
          />
        </div>

        {/* Center links */}
        <div className="flex items-center justify-center gap-3 sm:gap-10 min-w-0">
          {/* Team */}
          {isTeamPage ? (
            <span className="text-[0.7rem] sm:text-base text-yellow-300 font-semibold whitespace-nowrap">
              Ons team
            </span>
          ) : (
            <Link
              href="/team"
              className="text-[0.7rem] sm:text-base text-white/80 hover:text-yellow-300 hover:underline underline-offset-2 whitespace-nowrap"
            >
              Ons team
            </Link>
          )}

          {/* spacer (invisible) */}
          <span aria-hidden="true" className="inline-block w-3 sm:w-6 select-none" />

          {/* Disclaimer */}
          {isDisclaimerPage ? (
            <span className="text-[0.7rem] sm:text-base text-yellow-300 font-semibold whitespace-nowrap">
              Disclaimer
            </span>
          ) : (
            <Link
              href="/disclaimer"
              className="text-[0.7rem] sm:text-base text-white/80 hover:text-yellow-300 hover:underline underline-offset-2 whitespace-nowrap"
            >
              Disclaimer
            </Link>
          )}
        </div>

        {/* Right logo */}
        <div className="flex items-center justify-center shrink-0">
          <Image
            src="/warmsteweeklogo.svg"
            alt="De Warmste Week"
            width={160}
            height={48}
            className="h-10 sm:h-12 md:h-20 w-auto object-contain"
          />
        </div>
      </div>
    </footer>
  );
}
