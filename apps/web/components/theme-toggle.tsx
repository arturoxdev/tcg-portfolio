"use client";

import * as React from "react";
import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@workspace/ui/components/button";

/**
 * Botón de ícono que alterna entre tema claro y oscuro. Espera a montar
 * (`mounted`) para evitar mismatch de hidratación con el tema resuelto.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = resolvedTheme === "dark";

  function toggle() {
    setTheme(isDark ? "light" : "dark");
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label="Cambiar tema"
      title="Cambiar tema"
    >
      {mounted ? (
        isDark ? (
          <SunIcon />
        ) : (
          <MoonIcon />
        )
      ) : (
        // Placeholder estable durante SSR / pre-mount.
        <SunIcon className="opacity-0" />
      )}
      <span className="sr-only">Cambiar tema</span>
    </Button>
  );
}

export default ThemeToggle;
