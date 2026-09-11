"use client";

import { Laptop, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

const themes = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Laptop },
] as const;

export function ThemeToggle({ compact = false, labelled = false }: { compact?: boolean; labelled?: boolean }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className={`${compact ? "size-9" : labelled ? "h-[46px] w-[228px]" : "h-[46px] w-[132px]"} rounded-full bg-muted`} aria-hidden="true" />;
  }

  if (compact) {
    const currentIndex = themes.findIndex(({ value }) => value === theme);
    const current = themes[currentIndex >= 0 ? currentIndex : 2];
    const next = themes[(currentIndex >= 0 ? currentIndex + 1 : 0) % themes.length];
    const Icon = current.icon;

    return <button type="button" title={`${current.label} theme · switch to ${next.label}`} aria-label={`${current.label} theme. Switch to ${next.label}`} onClick={() => setTheme(next.value)} className="theme-compact-button grid size-9 place-items-center rounded-xl border border-border bg-card/70 text-muted-foreground shadow-sm transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Icon size={15} strokeWidth={1.75} /></button>;
  }

  const themeIndex = themes.findIndex(({ value }) => value === theme);
  const selectedIndex = themeIndex >= 0 ? themeIndex : 2;

  return (
    <div className={`theme-toggle ${labelled ? "theme-toggle-labelled" : ""}`} data-theme={theme} aria-label="Choose theme" role="group">
      <span className="theme-toggle-indicator" style={{ transform: `translateX(${selectedIndex * 100}%)` }} aria-hidden="true" />
      {themes.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          title={label}
          aria-label={`${label} theme`}
          aria-pressed={theme === value}
          onClick={() => setTheme(value)}
          className="theme-option-button"
        >
          <Icon size={15} strokeWidth={1.8} />
          {labelled && <span>{label}</span>}
        </button>
      ))}
    </div>
  );
}
