/** FormData -> plain object for zod; checkboxes become booleans, empty strings stay ''. */
export function formObject(formData: FormData, booleans: string[] = []) {
  const out: Record<string, unknown> = {}
  for (const [key, value] of formData.entries()) {
    if (typeof value !== 'string') continue
    if (key in out) out[key] = ([] as unknown[]).concat(out[key], value)
    else out[key] = value
  }
  for (const b of booleans) out[b] = formData.get(b) === 'on' || formData.get(b) === 'true'
  return out
}

export function list(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean)
  return typeof value === 'string' && value ? [value] : []
}
