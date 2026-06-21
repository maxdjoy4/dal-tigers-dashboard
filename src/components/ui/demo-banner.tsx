interface DemoBannerProps {
  isDemoMode: boolean;
}

export function DemoBanner({ isDemoMode }: DemoBannerProps) {
  if (!isDemoMode) {
    return null;
  }

  return (
    <div className="glass-panel gold-ring rounded-3xl border-gold-300/20 bg-gold-300/10 px-4 py-3 text-sm text-gold-50">
      Demo mode is active. The public dashboard is rendering from the bundled Dal Tigers sample data until Supabase is configured.
    </div>
  );
}
