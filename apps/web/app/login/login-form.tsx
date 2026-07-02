"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { LockIcon } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"

/**
 * Pantalla de candado: usuario + contraseña. Postea a /api/auth/login, que ante
 * credenciales válidas deja la cookie de sesión (JWT httpOnly). Tras entrar,
 * navega a `next` y refresca para que el middleware ya vea la sesión.
 */
export function LoginForm({ next }: { next: string }) {
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string
        } | null
        setError(data?.error ?? "No se pudo iniciar sesión.")
        setLoading(false)
        return
      }
      // Éxito: la cookie ya está puesta. Navegamos y refrescamos.
      router.replace(next)
      router.refresh()
    } catch {
      setError("Error de red. Intenta de nuevo.")
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <LockIcon className="size-5" />
        </div>
        <CardTitle className="font-heading">TCG Portfolio</CardTitle>
        <CardDescription>Ingresa para acceder a tu colección.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="username">Usuario</Label>
            <Input
              id="username"
              name="username"
              autoComplete="username"
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          {error && (
            <p
              role="alert"
              className="text-sm text-destructive"
              aria-live="polite"
            >
              {error}
            </p>
          )}

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Entrando…" : "Entrar"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
