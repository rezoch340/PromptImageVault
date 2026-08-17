import { ImageOff, Play } from 'lucide-react'
import { useState } from 'react'
import { isVideoExtension, thumbnailUrl } from '../api'
import type { ImageItem } from '../types'
import { EmptyState } from './common/EmptyState'

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(timestamp * 1000)
}

function ImagePreview({ item }: { item: ImageItem }) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  return (
    <div className="image-frame" style={{ aspectRatio: `${item.width} / ${item.height}` }}>
      {!loaded && !failed && <div className="image-shimmer" />}
      {failed ? <div className="image-failed"><ImageOff size={22} /><span>Preview unavailable</span></div> : (
        <img
          src={thumbnailUrl(item.image_identifier)}
          alt={item.prompt || item.filename}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={loaded ? 'loaded' : ''}
        />
      )}
      {isVideoExtension(item.extension) && (
        <span className="video-chip"><Play size={10} fill="currentColor" /> {item.extension}</span>
      )}
      {item.model && <span className="model-chip">{item.model}</span>}
    </div>
  )
}

interface ImageGridProps {
  images: ImageItem[]
  loading: boolean
  error: string | null
  onSelect: (imageIdentifier: string) => void
  onRetry: () => void
}

export function ImageGrid({ images, loading, error, onSelect, onRetry }: ImageGridProps) {
  if (loading && images.length === 0) {
    return <div className="image-grid skeleton-grid" aria-label="Loading images">
      {Array.from({ length: 12 }, (_unusedValue, index) => (
        <div className="skeleton-card" key={index}>
          <div /><span /><small />
        </div>
      ))}
    </div>
  }

  if (error && images.length === 0) {
    return (
      <EmptyState
        icon={<ImageOff size={26} />}
        title="Couldn’t open the library"
        description={error}
        actionLabel="Try again"
        onAction={onRetry}
      />
    )
  }

  if (images.length === 0) {
    return (
      <EmptyState
        icon={<ImageOff size={26} />}
        title="Your vault is ready"
        description="Add PNG, JPG, JPEG, WebP, GIF, MP4, or WebM files to your mounted library."
      />
    )
  }

  return (
    <div className="image-grid">
      {images.map((item) => (
        <button
          className="image-card"
          key={item.image_identifier}
          onClick={() => onSelect(item.image_identifier)}
        >
          <ImagePreview item={item} />
          <div className="image-caption">
            <strong>{item.filename}</strong>
            <span>{formatDate(item.created_time)} · {item.width} × {item.height}</span>
          </div>
        </button>
      ))}
    </div>
  )
}
