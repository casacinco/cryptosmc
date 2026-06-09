import { useState } from 'react';
import type { TradeReport } from '../types';

interface Props {
  report: TradeReport;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button
      onClick={handleCopy}
      className="px-3 py-1 rounded-lg bg-bg-border text-text-secondary text-xs hover:text-text-primary hover:bg-bg-card transition-colors"
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

interface CollapseBlockProps {
  title: string;
  jsonText: string;
  defaultOpen?: boolean;
}

function CollapseBlock({ title, jsonText, defaultOpen = false }: CollapseBlockProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="bg-bg-card border border-bg-border rounded-xl overflow-hidden">
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-bg-border transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2">
          <span className="text-text-muted text-xs font-mono select-none">
            {open ? '▾' : '▸'}
          </span>
          <span className="text-text-secondary text-xs font-semibold uppercase tracking-wider">
            {title}
          </span>
          <span className="text-text-muted text-xs">
            ({(jsonText.length / 1024).toFixed(1)} KB)
          </span>
        </div>
        <div onClick={e => e.stopPropagation()}>
          <CopyButton text={jsonText} />
        </div>
      </div>

      {open && (
        <div className="border-t border-bg-border">
          <pre
            className="bg-bg-secondary text-accent-green text-xs font-mono p-4 overflow-x-auto overflow-y-auto"
            style={{ maxHeight: '600px' }}
          >
            {jsonText}
          </pre>
        </div>
      )}
    </div>
  );
}

export function DeveloperMode({ report }: Props) {
  const fullJson = JSON.stringify(report, null, 2);
  const auditJson = JSON.stringify(report.audit ?? null, null, 2);

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="bg-bg-card border border-bg-border rounded-xl p-4">
        <div className="text-text-secondary text-xs font-semibold uppercase tracking-wider mb-1">
          Developer Mode
        </div>
        <p className="text-text-muted text-xs">
          Raw JSON output from the <span className="font-mono text-accent-green">/api/analyze</span> endpoint.
          Use this to inspect all computed fields and verify correctness.
        </p>
      </div>

      <CollapseBlock
        title="Full Report JSON"
        jsonText={fullJson}
        defaultOpen={false}
      />

      <CollapseBlock
        title="Audit Data Only"
        jsonText={auditJson}
        defaultOpen={true}
      />
    </div>
  );
}
