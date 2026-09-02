export function fillCopy(template, vars = {}) {
  return String(template ?? '').replace(/\{([a-z0-9_-]+)\}/gi, (match, key) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : match
  );
}
