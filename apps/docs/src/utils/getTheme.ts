import type { Theme } from "@/src/types/Theme";

export function getTheme(): Theme {
  if (typeof window === "undefined") return "light";

  const checkbox = document.getElementById(
    "theme-toggle"
  ) as HTMLInputElement | null;

  const isChecked = checkbox?.checked ?? false;
  const preferedTheme = window.matchMedia?.("(prefers-color-scheme: dark)")
    .matches
    ? "dark"
    : "light";

  switch (true) {
    case preferedTheme === "light" && !isChecked:
      return "light";
    case preferedTheme === "light" && isChecked:
      return "dark";
    case preferedTheme === "dark" && !isChecked:
      return "dark";
    case preferedTheme === "dark" && isChecked:
      return "light";
    default:
      return "light";
  }
}
