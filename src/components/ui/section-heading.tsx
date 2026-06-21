interface SectionHeadingProps {
  title: string;
  copy?: string;
}

export function SectionHeading({ title, copy }: SectionHeadingProps) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      {copy ? <p className="mt-1 text-sm text-slate-300">{copy}</p> : null}
    </div>
  );
}
