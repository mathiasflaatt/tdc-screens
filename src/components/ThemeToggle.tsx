import { useState } from 'react';

const THEME_PARAMETER = 'theme';
type Theme = 'dark' | 'light';

function themeFromUrl(): Theme {
  return new URLSearchParams(window.location.search).get(THEME_PARAMETER) === 'light' ? 'light' : 'dark';
}

function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
}

// Apply before first render so there is no dark flash on light screens.
applyTheme(themeFromUrl());

/** Invisible bottom-left button that flips the theme and keeps it in the URL (?theme=light). */
export function ThemeToggle() {
  const [theme, setTheme] = useState(themeFromUrl);

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    const url = new URL(window.location.href);
    if (next === 'light') url.searchParams.set(THEME_PARAMETER, 'light');
    else url.searchParams.delete(THEME_PARAMETER);
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
    applyTheme(next);
    setTheme(next);
  }

  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      onClick={toggle}
    />
  );
}
