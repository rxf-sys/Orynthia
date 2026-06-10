interface PageHeadProps {
  title: React.ReactNode;
  sub?: React.ReactNode;
  actions?: React.ReactNode;
}

export function PageHead({ title, sub, actions }: PageHeadProps) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="h-page m-0 mb-1">{title}</h1>
        {sub && <p className="m-0 text-sm text-ink-3">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
