"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) { return <main className="p-[var(--page-padding)]"><h1 className="text-2xl font-bold">Property Empire could not open</h1><p className="mt-2 text-muted-foreground">Your local save remains on this device.</p><Button className="mt-4" onClick={reset}>Try again</Button></main>; }
