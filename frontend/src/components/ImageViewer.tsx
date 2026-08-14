import { ChevronLeft, ChevronRight, Download, X as CloseIcon } from 'lucide-react'
import { useEffect } from 'react'
import { imageUrl } from '../api'
import type { ImageMetadata } from '../types'
import { IconButton } from './common/IconButton'
import { Inspector } from './Inspector'

interface ImageViewerProps {
  imageIdentifier: string
  metadata: ImageMetadata | null
  loading: boolean
  canPrevious: boolean
  canNext: boolean
  onClose: () => void
  onPrevious: () => void
  onNext: () => void
}

export function ImageViewer(props: ImageViewerProps) {
  const {
    imageIdentifier,
    metadata,
    loading,
    canPrevious,
    canNext,
    onClose,
    onPrevious,
    onNext,
  } = props

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowLeft' && canPrevious) onPrevious()
      if (event.key === 'ArrowRight' && canNext) onNext()
    }
    window.addEventListener('keydown', onKeyDown)
    document.body.classList.add('viewer-open')
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.classList.remove('viewer-open')
    }
  }, [canNext, canPrevious, onClose, onNext, onPrevious])

  return (
    <div className="viewer" role="dialog" aria-modal="true" aria-label="Image details">
      <div className="viewer-stage">
        <div className="viewer-toolbar">
          <div className="viewer-file">
            <span>{metadata?.filename ?? 'Loading image…'}</span>
            {metadata && <small>{metadata.width} × {metadata.height}</small>}
          </div>
          <div className="viewer-actions">
            <a
              href={imageUrl(imageIdentifier)}
              download={metadata?.filename}
              className="viewer-icon"
              title="Download"
            >
              <Download size={18} />
            </a>
            <IconButton accessibleLabel="Close" appearance="viewer" onClick={onClose}>
              <CloseIcon size={21} />
            </IconButton>
          </div>
        </div>
        <div className="viewer-image-wrap">
          <img src={imageUrl(imageIdentifier)} alt={metadata?.prompt || metadata?.filename || 'Selected image'} />
          <IconButton
            accessibleLabel="Previous image"
            appearance="navigation"
            className="previous"
            onClick={onPrevious}
            disabled={!canPrevious}
          >
            <ChevronLeft size={23} />
          </IconButton>
          <IconButton
            accessibleLabel="Next image"
            appearance="navigation"
            className="next"
            onClick={onNext}
            disabled={!canNext}
          >
            <ChevronRight size={23} />
          </IconButton>
        </div>
        <div className="viewer-hint"><kbd>←</kbd><kbd>→</kbd> navigate <i /> <kbd>ESC</kbd> close</div>
      </div>
      <Inspector metadata={metadata} loading={loading} />
    </div>
  )
}
