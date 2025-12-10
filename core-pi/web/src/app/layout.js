import { Caveat_Brush, Jersey_10 } from "next/font/google";
import "./globals.css";

export const caveatBrush = Caveat_Brush({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-caveat-brush",
});

export const jersey_10 = Jersey_10({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-jersey-10",
});

export const metadata = {
  title: "SweetControl",
  description: "IMD project for Artevelde",
};

export default function RootLayout({ children }) {
  return (
    <html>
      <body
        className={`${caveatBrush.variable} ${jersey_10.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
