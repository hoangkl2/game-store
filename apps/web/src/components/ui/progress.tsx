export function Progress({ value, label }: { value: number; label: string }) {
  const boundedValue = Math.max(0, Math.min(100, value));
  return <div aria-label={label} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={boundedValue} className="space-y-1"><div className="h-2 overflow-hidden rounded-pill bg-muted"><div className="h-full rounded-pill bg-primary transition-[width] duration-standard" style={{ width: `${boundedValue}%` }} /></div><span className="text-xs text-muted-foreground">{label}: {boundedValue}%</span></div>;
}
