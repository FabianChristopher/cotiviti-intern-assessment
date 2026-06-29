/*
 * components/category-tag.tsx
 * -----------------------------------------------------------------------
 * A small pill badge labeling a TPO category (Treatment / Payment /
 * Operations), abbreviated to 3 letters and color-coded. Used both on
 * sample-record buttons (components/upload-panel.tsx) and on retrieved
 * reference snippet cards (components/step-content-panel.tsx) -- pulled
 * out into its own component specifically so that category-to-color
 * mapping exists in exactly one place rather than being duplicated
 * across both call sites.
 * -----------------------------------------------------------------------
 */

import type { TpoCategory } from "@/types/review";
import styles from "./category-tag.module.css";

const CATEGORY_DISPLAY: Record<TpoCategory, { text: string; className: string }> = {
  payment: { text: "PAY", className: styles.payment },
  treatment: { text: "TRT", className: styles.treatment },
  operations: { text: "OPS", className: styles.operations },
};

interface CategoryTagProps {
  category: TpoCategory;
}

export function CategoryTag({ category }: CategoryTagProps) {
  const { text, className } = CATEGORY_DISPLAY[category];
  return <span className={[styles.tag, className].join(" ")}>{text}</span>;
}
