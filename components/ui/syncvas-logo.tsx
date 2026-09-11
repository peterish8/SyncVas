import Image from "next/image";

type SyncvasMarkProps = {
  className?: string;
};

/** The transparent Syncvas shared-board mark, used across product and marketing. */
export function SyncvasMark({ className }: SyncvasMarkProps) {
  return (
    <Image
      src="/syncvas-mark.png"
      width={32}
      height={32}
      alt=""
      aria-hidden="true"
      className={["syncvas-logo-mark", className].filter(Boolean).join(" ")}
    />
  );
}

type SyncvasLogoProps = {
  className?: string;
  wordmarkClassName?: string;
};

export function SyncvasLogo({ className, wordmarkClassName }: SyncvasLogoProps) {
  return (
    <span className={["syncvas-logo", className].filter(Boolean).join(" ")} aria-hidden="true">
      <SyncvasMark />
      <span className={["syncvas-logo-wordmark", wordmarkClassName].filter(Boolean).join(" ")}>syncvas</span>
    </span>
  );
}
