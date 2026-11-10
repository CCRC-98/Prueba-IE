import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Prueba técnica | Electrolineras",
  description: "Prueba full-stack para el equipo de aplicativos.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
