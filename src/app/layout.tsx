import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import RequireAuth from "@/components/RequireAuth";
import BottomNav from "@/components/BottomNav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Gym & Food Tracker",
  description: "Personal gym sessions and eating habit tracker",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <RequireAuth>
          <div className="flex min-h-full flex-1 flex-col">
            <main className="flex-1 pb-16">{children}</main>
            <BottomNav />
          </div>
        </RequireAuth>
      </body>
    </html>
  );
}
