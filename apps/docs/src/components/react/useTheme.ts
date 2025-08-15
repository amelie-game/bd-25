import { getTheme } from "@utils/getTheme";
import type { Theme } from "@/src/types/Theme";
import { useEffect, useState } from "react";

type Result = Theme;

export function useTheme(): Result {
  const [theme, setTheme] = useState<Theme>(getTheme());

  useEffect(() => {
    const onChange = () => setTheme(getTheme());

    // Listen for checkbox changes
    const checkbox = document.getElementById(
      "theme-toggle"
    ) as HTMLInputElement | null;
    checkbox?.addEventListener("change", onChange);

    // Listen for system preference changes
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    mql.addEventListener("change", onChange);

    return () => {
      // Cleanup event listener
      checkbox?.removeEventListener("change", onChange);
      mql.removeEventListener("change", onChange);
    };
  }, []);

  return theme;
}
