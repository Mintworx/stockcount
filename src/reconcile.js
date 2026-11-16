const normalize = (value) => value.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");

export function reconcile(count, invoice) {
  const groups = new Map();
  for (const [kind, rows] of [["count", count], ["invoice", invoice]]) {
    for (const row of rows) {
      const key = JSON.stringify([normalize(row.item), normalize(row.unit)]);
      const group = groups.get(key) ?? { item: row.item, unit: row.unit, count: [], invoice: [] };
      group[kind].push(row);
      groups.set(key, group);
    }
  }
  return [...groups.values()].map(group => {
    const counted = group.count.length === 1 ? Number(group.count[0].quantity) : null;
    const billed = group.invoice.length === 1 ? Number(group.invoice[0].quantity) : null;
    const gap = counted === null || billed === null ? null : counted - billed;
    const status = group.count.length > 1 || group.invoice.length > 1 ? "Multiple lines · review"
      : counted === null ? "No matching count"
      : billed === null ? "No matching invoice line"
      : gap < 0 ? "Short delivery"
      : gap > 0 ? "Extra stock"
      : "Matched";
    return { ...group, counted, billed, gap, status };
  });
}
