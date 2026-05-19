import React, { useRef, useState } from 'react';
import { Paperclip, Link, X, FileText, Image, File, Loader2, AlertCircle } from 'lucide-react';
import { parseAttachment, parseUrl, ParsedAttachment } from '../services/api';

export interface Attachment extends ParsedAttachment {
  id: string;
}

interface AttachmentManagerProps {
  attachments: Attachment[];
  onChange: (attachments: Attachment[]) => void;
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  pdf: <FileText className="w-3.5 h-3.5 shrink-0" />,
  docx: <FileText className="w-3.5 h-3.5 shrink-0" />,
  image: <Image className="w-3.5 h-3.5 shrink-0" />,
  url: <Link className="w-3.5 h-3.5 shrink-0" />,
};

function generateId() {
  return Math.random().toString(36).slice(2, 9);
}

function truncateName(name: string, max = 32): string {
  if (name.length <= max) return name;
  const ext = name.lastIndexOf('.');
  if (ext > 0 && name.length - ext <= 6) {
    return name.slice(0, max - (name.length - ext) - 1) + '…' + name.slice(ext);
  }
  return name.slice(0, max - 1) + '…';
}

export function AttachmentManager({ attachments, onChange }: AttachmentManagerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlValue, setUrlValue] = useState('');
  const [loading, setLoading] = useState<string[]>([]);
  const [errors, setErrors] = useState<{ id: string; message: string }[]>([]);

  const addError = (message: string) => {
    const id = generateId();
    setErrors((prev) => [...prev, { id, message }]);
    setTimeout(() => setErrors((prev) => prev.filter((e) => e.id !== id)), 6000);
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const pending = Array.from(files).map((f) => ({ file: f, id: generateId() }));
    setLoading((prev) => [...prev, ...pending.map((p) => p.id)]);

    await Promise.all(
      pending.map(async ({ file, id }) => {
        try {
          const formData = new FormData();
          formData.append('file', file);
          const parsed = await parseAttachment(formData);
          onChange([...attachments, { ...parsed, id }]);
        } catch (err: any) {
          addError(err.message || `Failed to parse "${file.name}"`);
        } finally {
          setLoading((prev) => prev.filter((lid) => lid !== id));
        }
      }),
    );
  };

  const handleUrlSubmit = async () => {
    const url = urlValue.trim();
    if (!url) return;
    const id = generateId();
    setLoading((prev) => [...prev, id]);
    setUrlValue('');
    setShowUrlInput(false);
    try {
      const parsed = await parseUrl(url);
      onChange([...attachments, { ...parsed, id }]);
    } catch (err: any) {
      addError(err.message || `Failed to crawl "${url}"`);
    } finally {
      setLoading((prev) => prev.filter((lid) => lid !== id));
    }
  };

  const removeAttachment = (id: string) => {
    onChange(attachments.filter((a) => a.id !== id));
  };

  const hasActivity = attachments.length > 0 || loading.length > 0 || showUrlInput;

  return (
    <div className="flex flex-col gap-1.5">
      {/* Chips row */}
      {(attachments.length > 0 || loading.length > 0) && (
        <div className="flex flex-wrap gap-1.5 px-1">
          {attachments.map((a) => (
            <span
              key={a.id}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-bronze-100 text-manuscript-800 border border-bronze-200 max-w-[220px]"
              title={a.name}
            >
              {TYPE_ICONS[a.type] ?? <File className="w-3.5 h-3.5 shrink-0" />}
              <span className="truncate">{truncateName(a.name)}</span>
              <button
                type="button"
                onClick={() => removeAttachment(a.id)}
                className="shrink-0 ml-0.5 text-manuscript-500 hover:text-red-600 transition-colors"
                aria-label={`Remove ${a.name}`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          {loading.map((id) => (
            <span
              key={id}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-parchment-100 text-manuscript-500 border border-bronze-200"
            >
              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
              <span>Parsing…</span>
            </span>
          ))}
        </div>
      )}

      {/* Error toasts */}
      {errors.map((e) => (
        <div
          key={e.id}
          className="flex items-start gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700"
        >
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" />
          <span>{e.message}</span>
        </div>
      ))}

      {/* URL input row */}
      {showUrlInput && (
        <div className="flex items-center gap-1.5 px-1">
          <input
            autoFocus
            type="url"
            placeholder="Paste a URL to crawl…"
            value={urlValue}
            onChange={(e) => setUrlValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleUrlSubmit();
              }
              if (e.key === 'Escape') {
                setShowUrlInput(false);
                setUrlValue('');
              }
            }}
            className="flex-1 min-w-0 px-3 py-1.5 text-sm rounded-lg border border-bronze-300 bg-white outline-none focus:ring-2 focus:ring-bronze-400 text-manuscript-900 placeholder:text-manuscript-400"
          />
          <button
            type="button"
            onClick={handleUrlSubmit}
            disabled={!urlValue.trim()}
            className="shrink-0 px-3 py-1.5 text-xs rounded-lg bg-bronze-600 hover:bg-bronze-700 disabled:bg-bronze-300 text-white font-medium transition-colors"
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => { setShowUrlInput(false); setUrlValue(''); }}
            className="shrink-0 text-manuscript-400 hover:text-manuscript-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Action buttons */}
      <div className={`flex items-center gap-1 ${hasActivity ? 'mt-0.5' : ''}`}>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.jpg,.jpeg,.png,.gif,.webp"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
          onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
        />
        <button
          type="button"
          title="Attach file (PDF, DOCX, or image)"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-manuscript-600 hover:text-manuscript-900 hover:bg-bronze-50 border border-transparent hover:border-bronze-200 transition-all"
        >
          <Paperclip className="w-3.5 h-3.5" />
          Attach file
        </button>
        <button
          type="button"
          title="Add URL to crawl"
          onClick={() => setShowUrlInput((v) => !v)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-manuscript-600 hover:text-manuscript-900 hover:bg-bronze-50 border border-transparent hover:border-bronze-200 transition-all"
        >
          <Link className="w-3.5 h-3.5" />
          Add URL
        </button>
      </div>
    </div>
  );
}

/** Build a concatenated context string from a list of attachments. */
export function buildAttachmentContext(attachments: Attachment[]): string {
  if (attachments.length === 0) return '';
  return attachments
    .map((a) => `[Source: ${a.name}]\n${a.text}`)
    .join('\n\n');
}
