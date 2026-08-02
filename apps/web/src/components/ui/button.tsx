import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "relative inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-button px-4 text-sm font-semibold transition-[background-color,color,border-color,box-shadow,transform] duration-[var(--duration-fast)] ease-[var(--ease-standard)] focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-[var(--focus-ring)] focus-visible:outline-offset-2 focus-visible:shadow-[var(--focus-glow)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none disabled:opacity-100",
  { variants: { variant: { primary: "bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-active", secondary: "bg-secondary text-secondary-foreground hover:bg-secondary-hover active:bg-secondary-active", accent: "bg-accent text-accent-foreground hover:bg-accent-hover active:bg-accent-active", success: "bg-success text-success-foreground hover:bg-success-hover active:bg-success-active", warning: "bg-warning text-warning-foreground hover:bg-warning-hover active:bg-warning-active", danger: "bg-danger text-danger-foreground hover:bg-danger-hover active:bg-danger-active", outline: "border border-border-strong bg-transparent text-foreground hover:bg-muted", ghost: "bg-transparent text-foreground hover:bg-muted", link: "min-h-0 px-0 text-primary underline-offset-4 hover:underline", "game-action": "bg-primary text-primary-foreground shadow-[var(--valid-action-glow)] hover:bg-primary-hover", icon: "w-11 px-0" }, size: { compact: "min-h-9 px-3 text-xs", sm: "min-h-10 px-3", md: "min-h-11 px-4", lg: "min-h-12 px-5 text-base", xl: "min-h-14 px-6 text-lg" }, selected: { true: "ring-2 ring-ring ring-offset-2 ring-offset-background", false: "" } }, defaultVariants: { variant: "primary", size: "md", selected: false } },
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> { loading?: boolean; }

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, selected, loading = false, disabled, children, ...props }, ref) => (
  <button ref={ref} className={cn(buttonVariants({ variant, size, selected }), className)} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
    {loading && <span aria-hidden="true" className="absolute size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
    <span className={cn(loading && "opacity-0")}>{children}</span>
  </button>
));
Button.displayName = "Button";
