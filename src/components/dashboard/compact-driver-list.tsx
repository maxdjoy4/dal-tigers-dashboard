"use client";

export function CompactDriverList({
  title,
  items,
  tone = "positive",
}: {
  title: string;
  items: Array<{ name: string; impact: number }>;
  tone?: "positive" | "negative";
}) {
  const maxImpact = Math.max(...items.map((item) => Math.abs(item.impact)), 0);

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
      <p className="section-title">{title}</p>
      <div className="mt-4 space-y-4">
        {items.length ? (
          items.map((item) => {
            const width = maxImpact > 0 ? (Math.abs(item.impact) / maxImpact) * 100 : 0;

            return (
              <div key={item.name} className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-white">{item.name}</p>
                  <p className="text-xs font-semibold text-slate-300">
                    {item.impact >= 0 ? "+" : ""}
                    {item.impact.toFixed(2)}
                  </p>
                </div>
                <div className="h-2 rounded-full bg-white/5">
                  <div
                    className={`h-2 rounded-full ${
                      tone === "positive" ? "bg-gold-300" : "bg-rose-400"
                    }`}
                    style={{ width: `${width}%` }}
                  />
                </div>
              </div>
            );
          })
        ) : (
          <p className="text-sm text-slate-300">No KPI drivers are available in this view.</p>
        )}
      </div>
    </div>
  );
}
