import Link from "next/link";

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`font-display text-2xl leading-none text-ink transition-opacity hover:opacity-70 ${className}`} aria-label="Kit home">
      Kit
    </Link>
  );
}

/** Plain bar: wordmark, My Reels, one action. */
export function AppHeader({ action = true }: { action?: boolean }) {
  return (
    <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
      <Wordmark />
      <nav className="flex items-center gap-2 text-[15px]">
        <Link href="/reels" className="rounded-md px-3 py-2 font-medium text-ink-muted transition-colors hover:bg-red-100 hover:text-ink">
          My Reels
        </Link>
        {action && (
          <Link href="/new" className="rounded-md bg-ink px-4 py-2 font-medium text-white transition-transform active:scale-[0.97]">
            Make a Reel
          </Link>
        )}
      </nav>
    </header>
  );
}
