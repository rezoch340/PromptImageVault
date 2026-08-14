import type { ImageMetadata, ImagePage, LibraryStatus, SortKey } from './types'

async function getJson<ResponseData>(path: string, signal?: AbortSignal): Promise<ResponseData> {
  const response = await fetch(path, { signal })
  if (!response.ok) throw new Error(`Request failed (${response.status})`)
  return response.json() as Promise<ResponseData>
}

export const imageUrl = (imageIdentifier: string) =>
  `/api/image/${encodeURIComponent(imageIdentifier)}`
export const thumbnailUrl = (imageIdentifier: string) =>
  `/api/thumbnail/${encodeURIComponent(imageIdentifier)}`

export function getImages(sort: SortKey, page = 1, signal?: AbortSignal) {
  return getJson<ImagePage>(`/api/images?sort=${sort}&page=${page}&limit=100`, signal)
}

export function getMetadata(imageIdentifier: string, signal?: AbortSignal) {
  return getJson<ImageMetadata>(`/api/metadata/${encodeURIComponent(imageIdentifier)}`, signal)
}

export function getStatus(signal?: AbortSignal) {
  return getJson<LibraryStatus>('/api/status', signal)
}

export function updatesUrl() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}/ws`
}
