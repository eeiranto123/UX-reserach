import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Synthetic UX Research",
  description: "Run quick synthetic usability tasks with AI personas on staging sites.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <Link href="/" className="brand">Synthetic UX Research</Link>
          <nav>
            <Link href="/">New study</Link>
            <Link href="/studies">Studies</Link>
            <Link href="/personas">Personas</Link>
          </nav>
        </header>
        <main className="container">
          <div className="banner">
            Synthetic participants are AI agents role-playing personas. Treat results as directional signals for
            early iteration - validate important decisions with real users.
          </div>
          {children}
        </main>
      </body>
    </html>
  );
}
