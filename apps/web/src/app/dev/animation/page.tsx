import { notFound } from "next/navigation";
import { AnimationPreview } from "./preview";
export default function AnimationPage() { if (process.env.NODE_ENV === "production") notFound(); return <AnimationPreview />; }
