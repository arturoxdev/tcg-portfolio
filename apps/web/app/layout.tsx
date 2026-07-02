import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"

import "@workspace/ui/globals.css"
import { cn } from "@workspace/ui/lib/utils"
import { Toaster } from "@workspace/ui/components/sonner"

import { ThemeProvider } from "@/components/theme-provider"

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" })

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export const metadata: Metadata = {
  title: "TCG Portfolio",
  description:
    "Seguimiento del valor y P&L de tu colección de cartas TCG en pesos mexicanos.",
}

/**
 * Layout raíz: sólo html/body, proveedores globales (tema) y el Toaster.
 * El shell con sidebar vive en `app/(app)/layout.tsx` para que la pantalla de
 * `/login` (fuera de ese grupo) se renderice limpia, sin navegación.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={cn("antialiased", fontMono.variable, "font-sans", geist.variable)}
    >
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
