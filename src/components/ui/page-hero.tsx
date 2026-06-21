import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface PageHeroProps {
  eyebrow: string;
  title: string;
  description: string;
  chips?: ReactNode;
  className?: string;
  titleClassName?: string;
}

export function PageHero({
  eyebrow,
  title,
  description,
  chips,
  className,
  titleClassName,
}: PageHeroProps) {
  return (
    <section
      className={cn(
        "glass-panel gold-ring rounded-4xl overflow-hidden border-gold-300/10 bg-gradient-to-br from-white/5 via-white/[0.03] to-gold-300/10 p-6 md:p-8",
        className,
      )}
    >
      <p className="section-title">{eyebrow}</p>
      <h1
        className={cn(
          "mt-3 max-w-4xl text-3xl font-semibold leading-[1.08] text-white md:text-5xl md:leading-[1.04]",
          titleClassName,
        )}
      >
        {title}
      </h1>
      <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 md:text-base">
        {description}
      </p>
      {chips ? <div className="mt-6 flex flex-wrap gap-2">{chips}</div> : null}
    </section>
  );
}
