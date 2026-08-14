export type SortKey =
  | 'newest'
  | 'oldest'
  | 'filename'
  | 'resolution'
  | 'file_size'
  | 'seed'
  | 'model'
  | 'sampler'
  | 'steps'
  | 'cfg'

export interface ImageItem {
  image_identifier: string
  library: string
  relative_path: string
  filename: string
  extension: string
  file_size: number
  width: number
  height: number
  created_time: number
  modified_ns: number
  prompt: string | null
  seed: string | null
  model: string | null
  steps: number | null
  sampler: string | null
  scheduler: string | null
  cfg: number | null
}

export interface ImagePage {
  items: ImageItem[]
  page: number
  limit: number
  total: number
  has_more: boolean
}

export interface ImageMetadata extends ImageItem {
  negative_prompt: string | null
  indexed_time: number
  metadata: Record<string, unknown>
}

export interface LibraryStatus {
  images: number
  scanning: boolean
  last_scan_time: number | null
  last_error: string | null
  watching: boolean
}
