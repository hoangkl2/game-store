"use client";
import { AppShell } from "@/components/layout/app-shell";
import { ErrorState } from "@/components/feedback/states";
export default function Error() { return <AppShell><ErrorState title="The game library could not load" /></AppShell>; }
