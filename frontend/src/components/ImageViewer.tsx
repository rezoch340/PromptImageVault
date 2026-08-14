import { ChevronLeft, ChevronRight, Download, X as CloseIcon, ZoomIn, ZoomOut } from 'lucide-react'
import { useEffect } from 'react'
import { imageUrl } from '../api'
import { useImageViewport } from '../hooks/useImageViewport'
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
  const {
    imageReady,
    viewTransform,
    dragging,
    viewportReference,
    imageReference,
    atFitScale,
    zoomPercentage,
    toggleZoom,
    handleWheel,
    beginGesture,
    continueGesture,
    finishGesture,
    cancelGesture,
    handleImageLoad,
    handleImageClick,
  } = useImageViewport()

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
            <span className="viewer-zoom-level">{zoomPercentage}%</span>
            <IconButton
              accessibleLabel={atFitScale ? 'Zoom image in' : 'Fit image to window'}
              appearance="viewer"
              aria-pressed={!atFitScale}
              onClick={toggleZoom}
            >
              {atFitScale ? <ZoomIn size={18} /> : <ZoomOut size={18} />}
            </IconButton>
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
        <div
          className={`viewer-image-wrap ${atFitScale ? '' : 'zoomed'} ${dragging ? 'dragging' : ''}`.trim()}
          ref={viewportReference}
          onWheel={handleWheel}
          onPointerDown={beginGesture}
          onPointerMove={continueGesture}
          onPointerUp={finishGesture}
          onPointerCancel={cancelGesture}
        >
          <img
            ref={imageReference}
            src={imageUrl(imageIdentifier)}
            alt={metadata?.prompt || metadata?.filename || 'Selected image'}
            className={imageReady ? 'ready' : ''}
            style={{
              transform: `translate3d(calc(-50% + ${viewTransform.horizontal}px), calc(-50% + ${viewTransform.vertical}px), 0) scale(${viewTransform.scale})`,
            }}
            draggable={false}
            onLoad={handleImageLoad}
            onClick={handleImageClick}
          />
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
        <div className="viewer-hint">
          <kbd>Wheel</kbd> zoom <span className="viewer-hint-divider" />
          <kbd>Drag</kbd> pan <span className="viewer-hint-divider" />
          <kbd>Pinch</kbd> mobile zoom <span className="viewer-hint-divider" />
          <kbd>←</kbd><kbd>→</kbd> navigate <span className="viewer-hint-divider" />
          <kbd>ESC</kbd> close
        </div>
      </div>
      <Inspector metadata={metadata} loading={loading} />
    </div>
  )
}
