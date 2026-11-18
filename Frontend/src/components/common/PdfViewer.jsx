import { Download, ExternalLink, Printer, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { fetchPdfUrl } from '../../utils/files';
import Button from './Button';
import Loader from './Loader';

/**
 * In-app PDF viewer for receipts, admit cards, marksheets and certificates.
 * Opened from anywhere with openPdf(url, params, title) (utils/files.js).
 * Print uses the browser's print dialog on the embedded PDF.
 */
export default function PdfViewer() {
  const [doc, setDoc] = useState(null); // { title, src }
  const [loading, setLoading] = useState(false);
  const frame = useRef(null);
  const reqId = useRef(0);

  useEffect(() => {
    const onOpen = async (e) => {
      const { url, params, title } = e.detail;
      const id = ++reqId.current;
      setLoading(true);
      setDoc({ title: title || 'Document', src: null });
      try {
        const src = await fetchPdfUrl(url, params);
        if (id !== reqId.current) return URL.revokeObjectURL(src);
        setDoc({ title: title || 'Document', src });
      } catch (err) {
        if (id === reqId.current) setDoc(null);
        toast.error(err.message);
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    };
    window.addEventListener('pdf:open', onOpen);
    return () => window.removeEventListener('pdf:open', onOpen);
  }, []);

  // Free the object URL when the viewer closes or shows another file
  useEffect(() => () => doc?.src && URL.revokeObjectURL(doc.src), [doc?.src]);

  useEffect(() => {
    if (!doc) return;
    const onKey = (e) => e.key === 'Escape' && close();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  const close = () => {
    reqId.current++;
    setDoc(null);
    setLoading(false);
  };

  const print = () => {
    try {
      frame.current?.contentWindow?.focus();
      frame.current?.contentWindow?.print();
    } catch {
      window.open(doc.src, '_blank'); // some mobile browsers can't print an embedded PDF
    }
  };

  const download = () => {
    const a = document.createElement('a');
    a.href = doc.src;
    a.download = `${doc.title.replace(/[^\w.-]+/g, '-').replace(/-+/g, '-')}.pdf`;
    a.click();
  };

  if (!doc) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-stretch justify-center bg-ink/40 p-0 sm:p-4" role="dialog" aria-modal="true" aria-label={doc.title}>
      <div className="neu-card flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-none sm:rounded-neu">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/60 px-3 py-2.5 sm:px-5">
          <h2 className="min-w-0 truncate text-sm font-semibold sm:text-base">{doc.title}</h2>
          <div className="flex items-center gap-2">
            <Button variant="primary" size="sm" icon={Printer} disabled={!doc.src} onClick={print}>Print</Button>
            <Button size="sm" icon={Download} disabled={!doc.src} onClick={download}><span className="hidden sm:inline">Download</span></Button>
            <Button size="icon-sm" icon={ExternalLink} disabled={!doc.src} aria-label="Open in new tab" title="Open in new tab" onClick={() => window.open(doc.src, '_blank')} />
            <Button size="icon-sm" icon={X} aria-label="Close" onClick={close} />
          </div>
        </div>
        <div className="relative flex-1 bg-white">
          {loading || !doc.src ? <div className="absolute inset-0 flex items-center justify-center"><Loader label="Preparing…" /></div> : <iframe ref={frame} src={doc.src} title={doc.title} className="h-full w-full border-0" />}
        </div>
      </div>
    </div>
  );
}
