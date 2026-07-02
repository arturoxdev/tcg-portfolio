import { LoginForm } from "./login-form"

export const dynamic = "force-dynamic"

/** Sanea el destino post-login: sólo rutas internas ("/algo"), nunca URLs
 * absolutas ni protocol-relative ("//evil.com") para evitar open-redirect. */
function safeNext(raw: string | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/"
  return raw
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next } = await searchParams
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <LoginForm next={safeNext(next)} />
    </div>
  )
}
