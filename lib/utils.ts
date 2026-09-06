type ClassValue = string | false | null | undefined;

/** Lightweight className joiner (no clsx/tailwind-merge dependency). */
export function cn(...parts: ClassValue[]): string {
  return parts.filter(Boolean).join(" ");
}
