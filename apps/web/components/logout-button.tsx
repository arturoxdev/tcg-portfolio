"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { LogOutIcon } from "lucide-react"

import { SidebarMenuButton } from "@workspace/ui/components/sidebar"

/**
 * Botón de "cerrar sesión" (re-bloquear la app desde adentro). Postea a
 * /api/auth/logout para borrar la cookie y regresa a /login.
 */
export function LogoutButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function onLogout() {
    setLoading(true)
    try {
      await fetch("/api/auth/logout", { method: "POST" })
    } catch {
      // Aun si el POST falla, forzamos la vuelta a /login: el middleware
      // volverá a exigir credenciales si la cookie sigue viva.
    } finally {
      router.replace("/login")
      router.refresh()
    }
  }

  return (
    <SidebarMenuButton
      onClick={onLogout}
      disabled={loading}
      tooltip="Cerrar sesión"
    >
      <LogOutIcon />
      <span>{loading ? "Saliendo…" : "Cerrar sesión"}</span>
    </SidebarMenuButton>
  )
}
