import toast from 'react-hot-toast';
import axiosInstance from './axiosInstance';

/** Error bodies of blob requests arrive as Blobs — turn them back into a message */
async function blobError(err) {
  try {
    if (err?.data instanceof Blob) {
      const j = JSON.parse(await err.data.text());
      return Array.isArray(j.message) ? j.message.join(', ') : j.message;
    }
  } catch {
    /* ignore */
  }
  return err?.message || 'Could not load the file';
}

async function fetchBlob(url, params) {
  // Interceptor unwraps res.data, so this resolves to the Blob itself
  return axiosInstance.get(url, { params, responseType: 'blob' });
}

/** Fetches a PDF (with the auth header) and returns an object URL; caller revokes it */
export async function fetchPdfUrl(url, params) {
  try {
    const blob = await fetchBlob(url, params);
    return URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
  } catch (err) {
    throw new Error(await blobError(err));
  }
}

/**
 * Shows a PDF inside the app (PdfViewer: preview + Print + Download), the way the
 * old site showed the receipt / marksheet on screen with a Print button.
 * `title` names the viewer and the downloaded file.
 */
export function openPdf(url, params, title) {
  window.dispatchEvent(new CustomEvent('pdf:open', { detail: { url, params, title } }));
}

export async function downloadFile(url, filename, params) {
  try {
    const blob = await fetchBlob(url, params);
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
  } catch (err) {
    toast.error(await blobError(err));
  }
}

export async function uploadFile(url, file, field = 'file') {
  const data = new FormData();
  data.append(field, file);
  const res = await axiosInstance.post(url, data);
  return res.data;
}
