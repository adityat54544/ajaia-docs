import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ajaia Docs",
  description: "Lightweight collaborative document editor",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 antialiased flex flex-col min-h-screen">
        <div className="flex-1">{children}</div>
        <footer className="py-5 text-center text-xs text-gray-400 border-t border-gray-100">
          Ajaia Docs — Created by{" "}
          <span className="font-medium text-gray-500">Aditya Tiwari</span> ·{" "}
          <a href="mailto:adityat100810081008@gmail.com" className="hover:text-blue-500 hover:underline">
            adityat100810081008@gmail.com
          </a>{" "}
          ·{" "}
          <a href="https://github.com/adityat54544" target="_blank" rel="noreferrer" className="hover:text-blue-500 hover:underline">
            GitHub
          </a>
        </footer>
      </body>
    </html>
  );
}
