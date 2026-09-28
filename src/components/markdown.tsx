"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function Markdown({
  content,
  streaming,
}: {
  content: string;
  streaming?: boolean;
}) {
  return (
    <div className="w-full min-w-0 text-sm leading-relaxed text-zinc-200 [&_a]:text-brand [&_a]:underline [&_a]:decoration-brand/40 [&_a:hover]:decoration-brand [&_blockquote]:border-l-2 [&_blockquote]:border-edge [&_blockquote]:pl-3 [&_blockquote]:text-zinc-400 [&_code:not(pre_code)]:rounded [&_code:not(pre_code)]:bg-edge [&_code:not(pre_code)]:px-1.5 [&_code:not(pre_code)]:py-0.5 [&_code:not(pre_code)]:font-mono [&_code:not(pre_code)]:text-[13px] [&_code:not(pre_code)]:text-amber-200 [&_h1]:mb-2 [&_h1]:mt-4 [&_h1]:text-lg [&_h1]:font-semibold [&_h1:first-child]:mt-0 [&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-base [&_h2]:font-semibold [&_h2:first-child]:mt-0 [&_h3]:mb-1.5 [&_h3]:mt-3 [&_h3]:font-semibold [&_h3:first-child]:mt-0 [&_hr]:my-4 [&_hr]:border-edge [&_li]:my-1 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:border [&_pre]:border-edge [&_pre]:bg-ink [&_pre]:p-3.5 [&_pre_code]:bg-transparent [&_pre_code]:font-mono [&_pre_code]:text-[13px] [&_pre_code]:text-zinc-200 [&_strong]:font-semibold [&_strong]:text-white [&_table]:my-3 [&_table]:w-full [&_td]:border-t [&_td]:border-edge [&_td]:px-2 [&_td]:py-1 [&_th]:border-t [&_th]:border-edge [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {streaming ? `${content} ▍` : content}
      </ReactMarkdown>
    </div>
  );
}
