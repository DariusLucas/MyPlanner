"use client";

import { Laptop, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

const themes = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Laptop },
] as const;

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className={`${compact ? "size-9" : "h-9 w-[112px]"} rounded-full bg-muted`} aria-hidden="true" />;
  }

  if (compact) {
    const currentIndex = themes.findIndex(({ value }) => value === theme);
    const current = themes[currentIndex >= 0 ? currentIndex : 2];
    const next = themes[(currentIndex >= 0 ? currentIndex + 1 : 0) % themes.length];
    const Icon = current.icon;

    return <button type="button" title={`${current.label} theme · switch to ${next.label}`} aria-label={`${current.label} theme. Switch to ${next.label}`} onClick={() => setTheme(next.value)} className="grid size-9 place-items-center rounded-xl border border-border bg-card/70 text-muted-foreground shadow-sm transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Icon size={15} strokeWidth={1.75} /></button>;
  }

  return (
    <div className="inline-flex rounded-full border border-border bg-card/80 p-1 shadow-sm" aria-label="Choose theme" role="group">
      {themes.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          title={label}
          aria-label={`${label} theme`}
          aria-pressed={theme === value}
          onClick={() => setTheme(value)}
          className={`rounded-full p-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            theme === value ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Icon size={15} strokeWidth={1.8} />
        </button>
      ))}
    </div>
  );
}
