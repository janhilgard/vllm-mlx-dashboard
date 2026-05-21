"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

interface MarkdownContentProps {
  content: string;
  className?: string;
}

export function MarkdownContent({ content, className }: MarkdownContentProps) {
  return (
    <div className={cn("text-sm leading-relaxed break-words", className)}>
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        strong: ({ children }) => (
          <strong className="font-semibold">{children}</strong>
        ),
        em: ({ children }) => <em className="italic">{children}</em>,
        h1: ({ children }) => (
          <h1 className="text-lg font-bold mb-2 mt-3 first:mt-0">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-base font-bold mb-1.5 mt-2.5 first:mt-0">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-sm font-bold mb-1 mt-2 first:mt-0">{children}</h3>
        ),
        ul: ({ children }) => (
          <ul className="list-disc pl-5 mb-2 space-y-0.5">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal pl-5 mb-2 space-y-0.5">{children}</ol>
        ),
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-border pl-3 my-2 text-muted-foreground italic">
            {children}
          </blockquote>
        ),
        code: ({ className: codeClassName, children, ...props }) => {
          const isInline = !codeClassName;
          if (isInline) {
            return (
              <code
                className="bg-background/50 border border-border/50 rounded px-1 py-0.5 text-xs font-mono"
                {...props}
              >
                {children}
              </code>
            );
          }
          return (
            <code className={cn("text-xs", codeClassName)} {...props}>
              {children}
            </code>
          );
        },
        pre: ({ children }) => (
          <pre className="bg-background/50 border border-border/50 rounded-md p-3 my-2 overflow-x-auto text-xs font-mono leading-relaxed">
            {children}
          </pre>
        ),
        table: ({ children }) => (
          <div className="overflow-x-auto my-2">
            <table className="min-w-full text-xs border-collapse">{children}</table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="border-b border-border">{children}</thead>
        ),
        th: ({ children }) => (
          <th className="px-2 py-1 text-left font-semibold">{children}</th>
        ),
        td: ({ children }) => (
          <td className="px-2 py-1 border-t border-border/50">{children}</td>
        ),
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:opacity-80"
          >
            {children}
          </a>
        ),
        hr: () => <hr className="my-3 border-border/50" />,
      }}
    >
      {content}
    </ReactMarkdown>
    </div>
  );
}
