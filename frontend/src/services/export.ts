import jsPDF from "jspdf";
import type { AnalyzeResponse } from "../types/contract";

function severityColor(severity: string): [number, number, number] {
  if (severity === "HIGH") return [254, 226, 226];
  if (severity === "MEDIUM") return [255, 237, 213];
  return [254, 249, 195];
}

export function exportAnalysisJson(data: AnalyzeResponse): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${data.document_id || "analysis"}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportAnalysisPdf(data: AnalyzeResponse): void {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const usableWidth = pageWidth - margin * 2;
  let y = margin;
  const checkPage = (needed: number) => {
    if (y + needed > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(data.document_id || "Contract Analysis", margin, y);
  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`${data.clauses.length} clauses and Risk score ${data.executive_summary?.risk_score ?? "-"}`, margin, y);
  y += 20;
  doc.setTextColor(0, 0, 0);

  const intervals = data.verified_findings
    .map((f) => ({ start: f.char_start, end: f.char_end, severity: f.severity }))
    .filter((x) => typeof x.start === "number" && typeof x.end === "number" && x.end > x.start)
    .sort((a, b) => a.start - b.start);

  const findSeverity = (offset: number): string | null => {
    for (let i = 0; i < intervals.length; i++) {
      const iv = intervals[i];
      if (offset >= iv.start && offset < iv.end) return iv.severity;
    }
    return null;
  };

  const raw = data.raw_text || "";
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(20, 20, 20);
  const lineHeight = 11;

  // Helpers without regex
  const isSpaceChar = (ch: string): boolean => ch === " " || ch === "\n" || ch === "\t" || ch === "\r" || ch === "\f";
  const splitKeepWhitespace = (t: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let curIsSpace: boolean | null = null;
    for (let i = 0; i < t.length; i++) {
      const ch = t[i];
      const sp = isSpaceChar(ch);
      if (curIsSpace === null) {
        cur = ch;
        curIsSpace = sp;
      } else if (sp === curIsSpace) {
        cur += ch;
      } else {
        out.push(cur);
        cur = ch;
        curIsSpace = sp;
      }
    }
    if (cur) out.push(cur);
    return out;
  };
  const isAllWhitespace = (s: string): boolean => {
    if (!s.length) return false;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (ch !== " " && ch !== "\n" && ch !== "\t" && ch !== "\r" && ch !== "\f") return false;
    }
    return true;
  };
  const countNewlines = (s: string): number => {
    let c = 0;
    for (let i = 0; i < s.length; i++) if (s[i] === "\n") c++;
    return c;
  };

  const tokens = splitKeepWhitespace(raw);
  // Build an array of tokens with sev and width prep (width lazy due to measure needing doc state)
  // First annotate each token with its starting offset sev
  const getWidth = (t: string): number => {
    const w = (doc as unknown as { getTextWidth: (s: string) => number }).getTextWidth(t);
    // fallback if jsPDF returns 0 for spaces
    if (w === 0 && t.length) {
      const spaceW = (doc as unknown as { getTextWidth: (s: string) => number }).getTextWidth(" ");
      return spaceW * t.length;
    }
    return w;
  };

  // Create list of {text, sev}
  const annotated: Array<{ text: string; sev: string | null }> = [];
  let offset = 0;
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    const sev = findSeverity(offset);
    annotated.push({ text: tok, sev });
    offset += tok.length;
  }

  // Build lines respecting usableWidth and newlines
  type LineToken = { text: string; width: number; sev: string | null };
  const lines: LineToken[][] = [[]];
  let curW = 0;
  for (let i = 0; i < annotated.length; i++) {
    const { text, sev } = annotated[i];
    const allWs = isAllWhitespace(text);
    if (allWs && text.includes("\n")) {
      const nl = countNewlines(text);
      for (let k = 0; k < nl; k++) {
        lines.push([]);
        curW = 0;
      }
      // any trailing spaces after last \n are part of same token but we already consumed nl count; we ignore extra carriage returns
      continue;
    }
    if (allWs) {
      const w = getWidth(text);
      // skip leading space at line start
      if (curW === 0 && lines[lines.length - 1].length === 0) continue;
      if (curW + w > usableWidth) {
        // space would overflow -> wrap to next line and drop this leading space
        lines.push([]);
        curW = 0;
        continue;
      }
      lines[lines.length - 1].push({ text, width: w, sev });
      curW += w;
      continue;
    }
    // word token
    const w = getWidth(text);
    // word longer than line? split naively by wrapping (jsPDF will clip but we force new line)
    if (w > usableWidth) {
      // break word char by char to fit? For now, put on new line alone (will overflow but we handle)
      if (curW !== 0) {
        lines.push([]);
        curW = 0;
      }
      lines[lines.length - 1].push({ text, width: w, sev });
      curW += w;
      // if still over, next token will wrap
      if (curW > usableWidth) {
        lines.push([]);
        curW = 0;
      }
      continue;
    }
    if (curW + w > usableWidth) {
      lines.push([]);
      curW = 0;
    }
    lines[lines.length - 1].push({ text, width: w, sev });
    curW += w;
  }
  // Remove trailing empty lines
  while (lines.length > 1 && lines[lines.length - 1].length === 0) lines.pop();

  // Render lines with continuous highlight rects (one rect per contiguous same-sev run per line)
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    if (line.length === 0) {
      y += lineHeight;
      checkPage(lineHeight);
      continue;
    }
    checkPage(lineHeight + 4);
    // First pass: draw background rects for runs
    // Merge adjacent tokens with same non-null sev into one run (including spaces whose sev matches)
    let x = margin;
    // Precompute x offsets for tokens
    const xOffsets: number[] = [];
    let acc = margin;
    for (let t = 0; t < line.length; t++) {
      xOffsets.push(acc);
      acc += line[t].width;
    }
    // Now find runs
    let runStart = -1;
    let runSev: string | null = null;
    let runWidth = 0;
    const flushRun = (endIdx: number) => {
      if (runStart === -1 || !runSev) return;
      const rx = xOffsets[runStart];
      doc.setFillColor(...severityColor(runSev));
      // Use slight padding that does NOT create white gaps between words: we extend rect to cover inter-word space already included as token widths
      // For continuous highlight, rect should be exactly runWidth with tiny 1pt padding on both sides to avoid clipping
      doc.rect(rx - 1, y - 8.5, runWidth + 2, lineHeight + 1, "F");
      runStart = -1;
      runSev = null;
      runWidth = 0;
      void endIdx;
    };
    for (let ti = 0; ti < line.length; ti++) {
      const tok = line[ti];
      if (tok.sev) {
        if (runStart === -1) {
          runStart = ti;
          runSev = tok.sev;
          runWidth = tok.width;
        } else if (tok.sev === runSev) {
          runWidth += tok.width;
        } else {
          flushRun(ti);
          runStart = ti;
          runSev = tok.sev;
          runWidth = tok.width;
        }
      } else {
        flushRun(ti);
      }
    }
    flushRun(line.length);

    // Second pass: draw text
    x = margin;
    for (let ti = 0; ti < line.length; ti++) {
      const tok = line[ti];
      doc.setTextColor(20, 20, 20);
      doc.text(tok.text, x, y);
      x += tok.width;
    }
    y += lineHeight;
  }

  if (data.executive_summary) {
    doc.addPage();
    y = margin;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Overall Analysis", margin, y);
    y += 18;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Risk score: ${data.executive_summary.risk_score}/100`, margin, y);
    y += 14;
    if (data.executive_summary.negotiation_priorities?.length) {
      doc.text("Negotiation priorities:", margin, y);
      y += 12;
      for (const p of data.executive_summary.negotiation_priorities) {
        const lines2 = doc.splitTextToSize(`- ${p}`, usableWidth - 10);
        doc.text(lines2, margin + 10, y);
        y += lines2.length * 10 + 2;
        checkPage(20);
      }
    }
    if (data.executive_summary.missing_protections?.length) {
      y += 8;
      doc.text("Missing protections:", margin, y);
      y += 12;
      for (const m of data.executive_summary.missing_protections) {
        const lines2 = doc.splitTextToSize(`- ${m}`, usableWidth - 10);
        doc.text(lines2, margin + 10, y);
        y += lines2.length * 10 + 2;
        checkPage(20);
      }
    }
  }
  doc.save(`${data.document_id || "analysis"}.pdf`);
}
