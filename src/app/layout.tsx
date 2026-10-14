import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cabo Sailing",
  description: "Cabo Sailing staff booking system",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full bg-slate-50 text-slate-900">{children}</body>
    </html>
  );
}
