"use client";
import { ErrorState } from "@/components/feedback/states";
export default function Error() { return <main className="mx-auto max-w-[var(--content-max)] p-[var(--page-padding)]"><ErrorState title="Royal Race could not start" description="Your offline save is unchanged. Reload to start a new local session." /></main>; }
