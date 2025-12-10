import Image from "next/image";

export default function Footer() {
  return (
    <footer className="w-full max-w-2xl mb-3 px-1 mx-auto">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center justify-center">
          <Image
            src="/arteveldelogo.svg"
            alt="Arteveldehogeschool"
            width={200}
            height={48}
            className="h-14 md:h-20 w-auto object-contain"
          />
        </div>

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
