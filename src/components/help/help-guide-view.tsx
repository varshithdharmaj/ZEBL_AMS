"use client";

import { useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import type { HelpAccent, HelpChapter } from "@/lib/help/types";
import { HelpBlockView } from "@/components/help/help-blocks";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ACCENT_TEXT: Record<HelpAccent, string> = {
  blue: "text-blue-600 dark:text-blue-400",
  purple: "text-purple-600 dark:text-purple-400",
  teal: "text-teal-600 dark:text-teal-400",
};

const ACCENT_ACTIVE_BG: Record<HelpAccent, string> = {
  blue: "bg-blue-50 dark:bg-blue-950/40",
  purple: "bg-purple-50 dark:bg-purple-950/40",
  teal: "bg-teal-50 dark:bg-teal-950/40",
};

function chapterAnchor(number: string) {
  return `chapter-${number}`;
}

export function HelpGuideView({
  chapters,
  accent,
  pdfHref,
}: {
  chapters: HelpChapter[];
  accent: HelpAccent;
  pdfHref: string;
}) {
  const [activeChapter, setActiveChapter] = useState(chapters[0]?.number ?? "");
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) {
          const number = visible.target.getAttribute("data-chapter-number");
          if (number) setActiveChapter(number);
        }
      },
      { rootMargin: "-96px 0px -70% 0px", threshold: 0 }
    );

    Object.values(sectionRefs.current).forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [chapters]);

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <nav className="hidden lg:block">
        <div className="sticky top-6 space-y-4">
          <ul className="space-y-1 border-l border-border pl-3">
            {chapters.map((chapter) => (
              <li key={chapter.number}>
                <a
                  href={`#${chapterAnchor(chapter.number)}`}
                  className={cn(
                    "block rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground",
                    activeChapter === chapter.number && cn("font-bold", ACCENT_TEXT[accent])
                  )}
                >
                  {chapter.number} · {chapter.title}
                </a>
              </li>
            ))}
          </ul>
          <a href={pdfHref} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="w-full gap-2">
              <Download className="h-3.5 w-3.5" />
              Download PDF
            </Button>
          </a>
        </div>
      </nav>

      <div className="space-y-10">
        <div className="lg:hidden">
          <a href={pdfHref} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="gap-2">
              <Download className="h-3.5 w-3.5" />
              Download PDF
            </Button>
          </a>
        </div>
        {chapters.map((chapter) => (
          <section
            key={chapter.number}
            id={chapterAnchor(chapter.number)}
            data-chapter-number={chapter.number}
            ref={(el) => {
              sectionRefs.current[chapter.number] = el;
            }}
            className="scroll-mt-24 border-b border-border pb-8 last:border-b-0"
          >
            <p className={cn("mb-1 text-xs font-bold uppercase tracking-wider", ACCENT_TEXT[accent])}>
              Chapter {chapter.number}
              {chapter.tag ? ` · ${chapter.tag}` : ""}
            </p>
            <h2 className="mb-1.5 text-xl font-bold text-foreground">{chapter.title}</h2>
            <p className="mb-4 text-sm text-muted-foreground">{chapter.intro}</p>
            <div className={cn("h-1 w-10 rounded-full mb-4", ACCENT_ACTIVE_BG[accent])} />
            {chapter.blocks.map((block, i) => (
              <HelpBlockView key={i} block={block} accent={accent} />
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
