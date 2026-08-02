import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center gap-1 rounded-pill px-2 py-1 text-xs font-semibold", { variants: { variant: { neutral: "bg-muted text-foreground", online: "bg-success-subtle text-success", offline: "bg-muted text-muted-foreground", guest: "bg-secondary-subtle text-secondary", host: "bg-primary-subtle text-primary", ready: "bg-success-subtle text-success", bot: "bg-accent-subtle text-accent", warning: "bg-warning-subtle text-warning", danger: "bg-danger-subtle text-danger", info: "bg-info-subtle text-info" } }, defaultVariants: { variant: "neutral" } });
export type BadgeProps = HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>;
export function Badge({ className, variant, ...props }: BadgeProps) { return <span className={cn(badgeVariants({ variant }), className)} {...props} />; }
