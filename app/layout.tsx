import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ScienceBackdrop } from "@/components/ScienceBackdrop";

export const metadata: Metadata = {
  title: { default: "Aula de Ciencias", template: "%s · Aula de Ciencias" },
  description: "Lecciones de Física, Química y Biología.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#060a13",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" data-theme="dark" suppressHydrationWarning>
      <head>
        {/* Aplica el tema guardado antes de pintar, para que no parpadee */}
        <script dangerouslySetInnerHTML={{ __html: `try{if(localStorage.getItem("aula-tema")==="light")document.documentElement.dataset.theme="light"}catch(e){}` }} />
      </head>
      <body>
        <ScienceBackdrop />
        {children}
      </body>
    </html>
  );
}
