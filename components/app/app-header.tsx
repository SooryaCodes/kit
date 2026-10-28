import Link from "next/link";

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`font-display text-[32px] leading-none text-ink transition-opacity hover:opacity-70 ${className}`} aria-label="Kit home">
      Kit
    </Link>
  );
}

/** Quiet bar: wordmark, My shops, one action. */
export function AppHeader({ action = true }: { action?: boolean }) {
  return (
    <header className="relative z-20 mx-auto flex h-20 w-full max-w-[1320px] items-center justify-between px-5 sm:px-8">
      <Wordmark />
      <nav className="flex items-center gap-1 text-[15px]">
        <Link href="/dashboard" className="rounded-full px-4 py-2.5 font-medium text-ink-muted transition-colors hover:text-ink">
          My shops
        </Link>
        {action && (
          <Link href="/new" className="rounded-full bg-ink px-5 py-2.5 font-medium text-white transition-transform active:scale-[0.97]">
            Make a shop link
          </Link>
        )}
      </nav>
    </header>
  );
}
