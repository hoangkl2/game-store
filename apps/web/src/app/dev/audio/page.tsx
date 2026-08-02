import { notFound } from "next/navigation";
import { AudioPreview } from "./preview";
export default function AudioPage() { if (process.env.NODE_ENV === "production") notFound(); return <AudioPreview />; }
