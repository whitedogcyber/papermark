import { SparklesIcon } from "lucide-react";

/** AI assistant icon (replaces the upstream Papermark "P" mark). */
export default function PapermarkSparkle({
  className,
}: {
  className?: string;
}) {
  return <SparklesIcon className={className ?? "h-6 w-6"} />;
}
