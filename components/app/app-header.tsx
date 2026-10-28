import Link from "next/link";
import { SiteHeader } from "./site-header";

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`font-display text-[32px] leading-none text-ink transition-opacity hover:opacity-70 ${className}`} aria-label="Kit home">
      Kit
    </Link>
  );
}

/** The app's header: the same bar as the site, without the marketing links. */
export function AppHeader({ action = true }: { action?: boolean }) {
  return <SiteHeader variant="app" action={action} />;
}
