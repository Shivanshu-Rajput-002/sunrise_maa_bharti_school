const dateFmt = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
const moneyFmt = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

export const formatDate = (v) => (v ? dateFmt.format(new Date(v)) : '—');
export const formatDateTime = (v) => (v ? dateTimeFmt.format(new Date(v)) : '—');
export const formatMoney = (v) => (v == null ? '—' : moneyFmt.format(v));
