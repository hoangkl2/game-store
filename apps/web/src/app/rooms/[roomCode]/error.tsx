"use client";
import { AppShell } from "@/components/layout/app-shell";
import { ErrorState } from "@/components/feedback/states";
export default function Error() { return <AppShell><ErrorState title="This room could not load" description="The room may have expired or your connection may be unavailable. Retry is safe for this mock route." /></AppShell>; }
