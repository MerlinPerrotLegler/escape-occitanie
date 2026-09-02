export function fillCopy(template, vars = {}) {
  return String(template ?? '').replace(/\{([a-z0-9-]+)\}/gi, (match, key) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : match
  );
}
