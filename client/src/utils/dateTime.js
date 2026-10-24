// ─────────────────────────────────────────────
// Date/time helpers shared by admin forms
//
// datetime-local inputs carry no timezone, so we convert the
// wall-clock value using the browser's offset before sending UTC
// ISO strings to the API. Displayed back in IST (the project's
// established timezone).
// ─────────────────────────────────────────────

export const toLocalInputValue = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16); // yyyy-MM-ddTHH:mm
};

export const fromLocalInputValue = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

export const formatDateTimeIST = (iso) => {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

export const formatDateIST = (iso) => {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};
