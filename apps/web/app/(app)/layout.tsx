import { SidebarInset, SidebarProvider } from "@workspace/ui/components/sidebar"

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"

/**
 * Shell de la app autenticada: sidebar + header + contenido. Todo lo que cuelga
 * de este route group `(app)` queda detrás del middleware de sesión; `/login`
 * vive fuera del grupo y por eso no arrastra esta navegación.
 */
export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <SiteHeader />
        <main className="flex flex-1 flex-col gap-4 p-4 md:p-6">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
