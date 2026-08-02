import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => <input ref={ref} className={cn("flex min-h-11 w-full rounded-input border border-input bg-surface px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-[var(--focus-ring)] focus-visible:outline-offset-2 focus-visible:shadow-[var(--focus-glow)] aria-invalid:border-danger aria-invalid:focus-visible:outline-danger disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100", className)} {...props} />);
Input.displayName = "Input";
