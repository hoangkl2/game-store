"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAudio } from "./provider";

export function AudioCaption() { const { playback, preferences } = useAudio(); return preferences.captionsEnabled && playback.lastCaption ? <p className="sr-only" role="status" aria-live="polite">{playback.lastCaption}</p> : null; }
export function EnableSoundControl() { const { playback, enableSound } = useAudio(); const [loading, setLoading] = useState(false); if (playback.unlocked) return <p className="text-sm text-muted-foreground" role="status">Sound enabled.</p>; return <div className="flex flex-wrap items-center gap-2"><Button size="compact" variant="outline" loading={loading} onClick={() => { setLoading(true); void enableSound().finally(() => setLoading(false)); }}>Enable sound</Button>{playback.lastError && <p className="text-sm text-muted-foreground" role="status">{playback.lastError}</p>}</div>; }
