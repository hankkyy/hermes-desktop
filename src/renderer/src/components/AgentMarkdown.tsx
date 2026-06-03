import { useState, useEffect, memo } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChevronDown, ChevronUp, Copy } from "lucide-react";
import { useI18n } from "./useI18n";
import { MediaImage, DownloadChip } from "./MediaImage";
import { describeImageSrc } from "../screens/Chat/mediaUtils";

// Lazy-load the heavy syntax highlighter — only imported when a code block renders
let _highlighterMod: typeof import("react-syntax-highlighter") | null = null;
let _oneDark: Record<string, React.CSSProperties> | null = null;
let _loadingPromise: Promise<void> | null = null;

function loadHighlighter(): Promise<void> {
  if (_highlighterMod && _oneDark) return Promise.resolve();
  if (_loadingPromise) return _loadingPromise;
  _loadingPromise = Promise.all([
    import("react-syntax-highlighter"),
    import("react-syntax-highlighter/dist/esm/styles/prism/one-dark"),
  ]).then(([mod, style]) => {
    _highlighterMod = mod;
    _oneDark = style.default;
  });
  return _loadingPromise;
}

// Diff viewer with colored +/- lines
function DiffView({ code }: { code: string }): React.JSX.Element {
  const lines = code.split("\n");
  return (
    <div className="chat-diff-content">
      {lines.map((line, i) => {
        let cls = "chat-diff-line";
        if (line.startsWith("+")) cls += " chat-diff-add";
        else if (line.startsWith("-")) cls += " chat-diff-remove";
        else if (line.startsWith("@@")) cls += " chat-diff-hunk";
        return (
          <div key={i} className={cls}>
            {line || "\u00A0"}
          </div>
        );
      })}
    </div>
  );
}

const CODE_BLOCK_COLLAPSE_LINE_THRESHOLD = 16;
const CODE_BLOCK_LONG_LINE_LENGTH = 240;

function shouldCollapseCodeBlock(code: string): boolean {
  const lines = code.split("\n");
  return (
    lines.length > CODE_BLOCK_COLLAPSE_LINE_THRESHOLD ||
    lines.some((line) => line.length > CODE_BLOCK_LONG_LINE_LENGTH)
  );
}

// Code block with syntax highlighting and copy button (lazy-loaded highlighter)
function CodeBlock({
  className,
  children,
  collapseLongBlocks,
}: {
  className?: string;
  children?: React.ReactNode;
  collapseLongBlocks?: boolean;
}): React.JSX.Element {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const [highlighterReady, setHighlighterReady] = useState(
    () => _highlighterMod !== null && _oneDark !== null,
  );
  const code = String(children).replace(/\n$/, "");
  const match = /language-(\w+)/.exec(className || "");
  const language = match ? match[1] : "";
  const isDiff = language === "diff";
  const canCollapse = collapseLongBlocks && shouldCollapseCodeBlock(code);
  const [expanded, setExpanded] = useState(false);
  const isCollapsed = canCollapse && !expanded;

  // Trigger lazy load when code block mounts
  useEffect(() => {
    if (!highlighterReady) {
      loadHighlighter().then(() => setHighlighterReady(true));
    }
  }, [highlighterReady]);

  function handleCopy(): void {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const fallbackPre = (
    <pre
      style={{
        margin: 0,
        borderRadius: 0,
        fontSize: "13px",
        padding: "12px",
        background: "transparent",
        color: "#abb2bf",
        overflow: "auto",
      }}
    >
      {code}
    </pre>
  );

  return (
    <div
      className={`chat-code-block${
        canCollapse ? " chat-code-block--collapsible" : ""
      }${isCollapsed ? " chat-code-block--collapsed" : ""}`}
    >
      <div className="chat-code-header">
        <span className="chat-code-lang">
          {isDiff ? "diff" : language || "code"}
        </span>
        <div className="chat-code-actions">
          {canCollapse && (
            <button
              type="button"
              className="chat-code-toggle"
              onClick={() => setExpanded((value) => !value)}
            >
              {expanded ? (
                <>
                  <ChevronUp size={13} />
                  {t("chat.codeShowLess")}
                </>
              ) : (
                <>
                  <ChevronDown size={13} />
                  {t("chat.codeShowMore")}
                </>
              )}
            </button>
          )}
          <button type="button" className="chat-code-copy" onClick={handleCopy}>
            {copied ? t("common.copied") : <Copy size={13} />}
          </button>
        </div>
      </div>
      <div className="chat-code-content">
        {isDiff ? (
          <DiffView code={code} />
        ) : highlighterReady && _highlighterMod && _oneDark ? (
          <_highlighterMod.Prism
            style={_oneDark}
            language={language || "text"}
            PreTag="div"
            customStyle={{
              margin: 0,
              borderRadius: 0,
              fontSize: "13px",
              padding: "12px",
              background: "transparent",
            }}
          >
            {code}
          </_highlighterMod.Prism>
        ) : (
          fallbackPre
        )}
        {isCollapsed && <div className="chat-code-fade" aria-hidden="true" />}
      </div>
    </div>
  );
}

// Shared Markdown renderer that opens links externally
const AgentMarkdown = memo(function AgentMarkdown({
  children,
  collapseCodeBlocks = false,
}: {
  children: string;
  collapseCodeBlocks?: boolean;
}): React.JSX.Element {
  return (
    <Markdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ href, children }) => (
          <a
            href={href}
            onClick={(e) => {
              e.preventDefault();
              if (!href) return;
              try {
                const url = new URL(href, "https://placeholder.invalid");
                if (!["http:", "https:", "mailto:"].includes(url.protocol)) {
                  return;
                }
              } catch {
                return;
              }
              window.hermesAPI.openExternal(href);
            }}
          >
            {children}
          </a>
        ),
        img: ({ src }) => {
          if (typeof src !== "string" || src.length === 0) return null;
          // ![alt](file.pdf) parses as a markdown image but isn't an image —
          // route those to the download chip instead of letting MediaImage
          // try to load a non-image MIME and fail. (Follow-up from #303.)
          const token = describeImageSrc(src);
          return token.isImage ? (
            <MediaImage token={token} />
          ) : (
            <DownloadChip token={token} />
          );
        },
        code: ({ className, children, ...props }) => {
          const isInline =
            !className &&
            typeof children === "string" &&
            !children.includes("\n");
          if (isInline) {
            return (
              <code className={className} {...props}>
                {children}
              </code>
            );
          }
          return (
            <CodeBlock
              className={className}
              collapseLongBlocks={collapseCodeBlocks}
            >
              {children}
            </CodeBlock>
          );
        },
      }}
    >
      {children}
    </Markdown>
  );
});

export { AgentMarkdown };
export default AgentMarkdown;
