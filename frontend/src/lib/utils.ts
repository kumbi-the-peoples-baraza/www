import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

// Image values may be stored as "url" or "url|x% y%" (url + focal point).
// Return the bare URL suitable for use as an <img src>.
export function parseImageValue(value?: string | null): string {
  if (!value) return ''
  return value.split('|')[0]
}
