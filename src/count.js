export function parseCount(text, notes) {
  const result = JSON.parse(text);
  if (!Array.isArray(result?.items) || result.items.length > 80) {
    throw new Error("The model returned an invalid count.");
  }

  return result.items.map((row) => {
    if (!row || typeof row.item !== "string" || !row.item.trim() ||
        typeof row.quantity !== "number" || !Number.isFinite(row.quantity) ||
        row.quantity < 0 || typeof row.unit !== "string" ||
        typeof row.evidence !== "string" || !row.evidence.trim()) {
      throw new Error("The model returned an invalid count row.");
    }

    const unit = row.unit.trim();
    const name = row.item.trim();
    const unitPrefix = unit.length ? unit.toLowerCase() + " of " : "";
    const item = unitPrefix && name.toLowerCase().startsWith(unitPrefix)
      ? name.slice(unitPrefix.length).trim()
      : name;
    const excerpt = row.evidence.trim();
    const offset = notes?.indexOf(excerpt) ?? -1;
    // Keep the source line around a short model quote so the reviewer can see
    // the product name even when Gemini only returned the quantity and unit.
    const evidence = notes === null ? excerpt : offset >= 0 && notes.indexOf(excerpt, offset + 1) < 0
      ? notes.slice(notes.lastIndexOf("\n", offset) + 1,
        notes.indexOf("\n", offset) < 0 ? notes.length : notes.indexOf("\n", offset)).trim()
      : "";
    return {
      item: item || name,
      quantity: String(row.quantity),
      unit,
      evidence,
    };
  });
}

export function validateRows(rows) {
  return rows.length > 0 && rows.every(({ item, quantity }) =>
    item.trim() && quantity.trim() && Number.isFinite(Number(quantity)) && Number(quantity) >= 0
  );
}
