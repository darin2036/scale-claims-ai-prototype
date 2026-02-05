export const hashString = (value: string) => {
  let hash = 0
  for (const char of value) {
    hash = (hash * 31 + char.charCodeAt(0)) % 100000
  }
  return hash
}
