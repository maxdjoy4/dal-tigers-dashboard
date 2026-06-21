import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "@/lib/utils";

interface PanelProps extends ComponentPropsWithoutRef<"section"> {
  title?: string;
  eyebrow?: string;
  description?: string;
  actions?: ReactNode;
}

export function Panel({
  className,
  title,
  eyebrow,
  description,
  actions,
  children,
  ...props
}: PanelProps) {
  return (
    <section
      className={cn(
        "glass-panel gold-ring rounded-4xl p-5 md:p-6",
        className,
      )}
      {...props}
    >
      {(title || eyebrow || description || actions) && (
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            {eyebrow ? <p className="section-title">{eyebrow}</p> : null}
            {title ? <h2 className="mt-2 text-xl font-semibold">{title}</h2> : null}
            {description ? (
              <p className="mt-2 max-w-3xl text-sm text-slate-300">
                {description}
              </p>
            ) : null}
          </div>
          {actions ? <div>{actions}</div> : null}
        </div>
      )}
      {children}
    </section>
  );
}
