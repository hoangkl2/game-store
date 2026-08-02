"use client";
import { Button } from "@/components/ui/button";
export default function ErrorState({ reset }: { reset: () => void }) { return <main className="p-[var(--page-padding)]"><h1 className="text-2xl font-bold">Moon Village could not open</h1><p className="mt-2">No private role information was retained in this error view.</p><Button className="mt-4" onClick={reset}>Try again</Button></main>; }
