import { notFound } from "next/navigation";
import { RealtimePreview } from "./preview";
export default function RealtimePage() { if (process.env.NODE_ENV === "production") notFound(); return <RealtimePreview />; }
