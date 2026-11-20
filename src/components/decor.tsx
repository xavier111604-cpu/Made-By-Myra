import { cn } from "@/lib/format";

/** Hand-drawn style heart doodle, used as a delicate accent. */
export function HeartDoodle({ className, size = 22 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden className={className}>
      <path
        d="M16.2 27.5C10 23 4.6 18.2 4.9 11.9c.2-3.8 3.4-6.4 6.8-5.7 2.2.4 3.6 2 4.4 4 .9-2.3 2.7-4.3 5.3-4.4 3.5-.2 6.1 2.7 5.6 6.4-.7 5.6-5.8 10-10.8 15.3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Soft blush brushstroke behind a heading — echoes the logo. */
export function Brushstroke({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 60" preserveAspectRatio="none" aria-hidden className={cn("absolute inset-x-0 -z-10 h-[60%]", className)}>
      <path
        d="M6 34c40-14 110-22 190-22s150 4 198 12c4 1 4 8 0 9-60 10-140 16-210 16-60 0-120-3-176-6-6 0-8-7-2-9Z"
        fill="#F6DCE0"
        opacity="0.85"
      />
    </svg>
  );
}

export function ScriptHeading({
  children,
  as: Tag = "h2",
  className,
  brush = false,
}: {
  children: React.ReactNode;
  as?: "h1" | "h2" | "h3";
  className?: string;
  brush?: boolean;
}) {
  return (
    <Tag className={cn("heading-script relative inline-block", className)}>
      {brush && <Brushstroke className="bottom-0" />}
      {children}
    </Tag>
  );
}

export function FloatingHearts() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <HeartDoodle className="absolute left-[6%] top-[18%] animate-float text-blush-dusty" size={18} />
      <HeartDoodle className="absolute right-[8%] top-[30%] animate-float text-gold/60 [animation-delay:1.2s]" size={14} />
      <HeartDoodle className="absolute bottom-[14%] left-[42%] animate-float text-blush-hover [animation-delay:2.4s]" size={16} />
    </div>
  );
}
