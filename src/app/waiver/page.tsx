import type { Metadata } from "next";
import { WaiverText } from "@/components/WaiverText";
import { WAIVER_TITLE } from "@/lib/waiver";

export const metadata: Metadata = { title: WAIVER_TITLE };

export default function WaiverPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="rounded-lg border border-line bg-surface p-6 sm:p-8">
        <WaiverText />
      </div>
    </div>
  );
}
