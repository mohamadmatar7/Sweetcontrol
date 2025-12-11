"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Footer() {
  const pathname = usePathname();
  const isTeamPage = pathname === "/team";

  return (
    <footer className="w-full max-w-3xl mt-1 mb-3 px-1 mx-auto">
      <div className="flex items-center justify-between gap-4">
        {/* Left logo */}
        <div className="flex items-center justify-center">
          <Image
            src="/arteveldelogo.svg"
            alt="Arteveldehogeschool"
            width={200}
            height={48}
            className="h-14 md:h-20 w-auto object-contain"
          />
        </div>

        {/* Center team link / active label */}
        <div className="flex items-center justify-center">
          {isTeamPage ? (
            <span className="text-sm sm:text-base text-yellow-300 font-semibold whitespace-nowrap">
              Ons team
            </span>
          ) : (
            <Link
              href="/team"
              className="text-sm sm:text-base text-white/80 hover:text-yellow-300 hover:underline underline-offset-2 whitespace-nowrap"
            >
              Ons team
            </Link>
          )}
        </div>

        {/* Right logo */}
        <div className="flex items-center justify-center">
          <Image
            src="/warmsteweeklogo.svg"
            alt="De Warmste Week"
            width={160}
            height={48}
            className="h-14 md:h-20 w-auto object-contain"
          />
        </div>
      </div>
    </footer>
  );
}
