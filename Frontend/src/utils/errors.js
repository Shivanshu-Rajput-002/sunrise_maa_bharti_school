/**
 * One place that turns any failed request into a message an office user understands.
 * Every API error in the app is shaped { status, message, errors?, ref? }.
 */

const BY_STATUS = {
  400: 'Some details are not valid. Please check and try again.',
  401: 'Your login has expired. Please sign in again.',
  403: 'You do not have permission for this action.',
  404: 'This page or record was not found.',
  409: 'This conflicts with existing data.',
  413: 'The file is too large.',
  429: 'Too many attempts. Please wait a minute and try again.',
  500: 'Something went wrong on the server. Please try again.',
  502: 'The server is not responding right now. Please try again shortly.',
  503: 'The service is temporarily unavailable. Please try again shortly.',
  504: 'The server took too long to respond. Please try again.',
};

/** Messages that only make sense to developers */
const TECHNICAL = [/^Request failed with status code/i, /^Network Error$/i, /^timeout of \d+ms exceeded$/i, /Cannot (GET|POST|PUT|PATCH|DELETE) /i, /^Internal server error$/i, /Unexpected token/i];

export function friendlyError(error) {
  // Request never reached the server / no reply
  if (!error?.response) {
    if (error?.code === 'ECONNABORTED' || /timeout/i.test(error?.message ?? '')) {
      return { status: 0, message: 'The server is taking too long to respond. Please check your internet and try again.' };
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return { status: 0, message: 'You are offline. Please check your internet connection.' };
    }
    if (error?.code === 'ERR_CANCELED') return { status: 0, message: 'The request was cancelled.', canceled: true };
    return { status: 0, message: 'Cannot connect to the server. Please check your internet, or ask the admin if the server is running.' };
  }

  const { status } = error.response;
  const body = error.response.data;
  // A proxy (Vite dev server / Nginx) answered because the API itself is down
  if (status >= 500 && (!body || typeof body !== 'object' || !('success' in body))) {
    return { status, message: 'Cannot reach the server right now. Please try again in a minute, or ask the admin to check that the server is running.' };
  }
  let message = Array.isArray(body?.message) ? body.message.join('. ') : typeof body?.message === 'string' ? body.message : '';
  if (!message || TECHNICAL.some((rx) => rx.test(message))) message = BY_STATUS[status] ?? (status >= 500 ? BY_STATUS[500] : BY_STATUS[400]);
  // Unexpected server errors carry a reference the office can quote to support
  if (body?.ref) message = `${message} (Ref: ${body.ref})`;
  return { status, message, errors: Array.isArray(body?.errors) ? body.errors : undefined, ref: body?.ref, data: body };
}
