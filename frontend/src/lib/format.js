export const fmtG = (v) => {
  const n = Number(v || 0);
  return `${n.toLocaleString('en-IN', { maximumFractionDigits: 3 })} g`;
};

export const fmtNum = (v, d = 2) => Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: d });

export const fmtRs = (v) =>
  `₹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export const fmtDate = (iso) => {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
};

export const fmtDateTime = (iso) => {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
};
