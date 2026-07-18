export type CaptureResult = { dataUrl: string; width: number; height: number }

export async function captureElement(element: HTMLElement): Promise<CaptureResult> {
  const width = Math.min(2400, Math.max(1, Math.ceil(element.scrollWidth)))
  const height = Math.min(2400, Math.max(1, Math.ceil(element.scrollHeight)))
  const { default: html2canvas } = await import('html2canvas')
  const canvas = await html2canvas(element, { width, height, scale: 1, backgroundColor: '#ffffff', logging: false, useCORS: false })
  return { dataUrl: canvas.toDataURL('image/png'), width, height }
}
