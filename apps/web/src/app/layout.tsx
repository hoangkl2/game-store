import "./globals.css";
import { Be_Vietnam_Pro, Fredoka, Space_Grotesk } from "next/font/google";
import { ThemeProvider } from "@/providers/theme-provider";
import { AnimationProvider } from "@/features/animation/provider";
import { AudioProvider } from "@/features/audio/provider";

const bodyFont = Be_Vietnam_Pro({ subsets: ["latin", "vietnamese"], weight: ["400", "500", "600", "700"], variable: "--font-be-vietnam-pro", display: "swap" });
const displayFont = Fredoka({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-fredoka", display: "swap" });
const dataFont = Space_Grotesk({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-space-grotesk", display: "swap" });

export const metadata = {
  title: "Game Store · UNO",
  description: "Offline-first Game Store UNO MVP",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <html lang="en" suppressHydrationWarning><body className={`${bodyFont.variable} ${displayFont.variable} ${dataFont.variable} min-h-screen bg-background text-foreground antialiased`}><ThemeProvider><AnimationProvider><AudioProvider>{children}</AudioProvider></AnimationProvider></ThemeProvider></body></html>;
}
