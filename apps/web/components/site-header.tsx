import * as React from "react";

import { Separator } from "@workspace/ui/components/separator";
import { SidebarTrigger } from "@workspace/ui/components/sidebar";
import { cn } from "@workspace/ui/lib/utils";

import { ThemeToggle } from "@/components/theme-toggle";
import { UpdatePricesButton } from "@/components/update-prices-button";

export type SiteHeaderProps = {
  /** Título de la página mostrado junto al trigger del sidebar. */
  title?: React.ReactNode;
  className?: string;
};

/**
 * Header superior dentro del SidebarInset. A la izquierda: trigger del sidebar
 * + separador + título de página. A la derecha: acciones globales.
 *
 * Es un Server Component (no necesita "use client"); renderiza los componentes
 * cliente `UpdatePricesButton` y `ThemeToggle` como hijos.
 */
export function SiteHeader({ title, className }: SiteHeaderProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-40 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/60",
        className,
      )}
    >
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-1 h-5" />
      {title != null && (
        <h1 className="font-heading text-sm font-medium truncate">{title}</h1>
      )}
      <div className="ml-auto flex items-center gap-1.5">
        <UpdatePricesButton />
        <ThemeToggle />
      </div>
    </header>
  );
}

export default SiteHeader;
