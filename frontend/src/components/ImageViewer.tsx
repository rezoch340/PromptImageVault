import { ChevronLeft, ChevronRight, Download, X as CloseIcon, ZoomIn, ZoomOut } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
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

interface PanPosition {
  horizontal: number
  vertical: number
}

interface DragState {
  pointerIdentifier: number
  pointerHorizontal: number
  pointerVertical: number
  positionHorizontal: number
  positionVertical: number
  moved: boolean
}

const CENTERED_POSITION: PanPosition = { horizontal: 0, vertical: 0 }

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
  const [actualSize, setActualSize] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [panPosition, setPanPosition] = useState(CENTERED_POSITION)
  const viewportReference = useRef<HTMLDivElement>(null)
  const imageReference = useRef<HTMLImageElement>(null)
  const dragStateReference = useRef<DragState | null>(null)
  const ignoreNextClickReference = useRef(false)

  const clampPanPosition = useCallback((horizontal: number, vertical: number): PanPosition => {
    const viewport = viewportReference.current
    const image = imageReference.current
    if (!viewport || !image) return CENTERED_POSITION

    const viewportStyle = window.getComputedStyle(viewport)
    const availableWidth = viewport.clientWidth
      - Number.parseFloat(viewportStyle.paddingLeft)
      - Number.parseFloat(viewportStyle.paddingRight)
    const availableHeight = viewport.clientHeight
      - Number.parseFloat(viewportStyle.paddingTop)
      - Number.parseFloat(viewportStyle.paddingBottom)
    const maximumHorizontal = Math.max(0, (image.naturalWidth - availableWidth) / 2)
    const maximumVertical = Math.max(0, (image.naturalHeight - availableHeight) / 2)

    return {
      horizontal: Math.max(-maximumHorizontal, Math.min(maximumHorizontal, horizontal)),
      vertical: Math.max(-maximumVertical, Math.min(maximumVertical, vertical)),
    }
  }, [])

  const toggleActualSize = useCallback(() => {
    setActualSize((currentlyActualSize) => !currentlyActualSize)
    setPanPosition(CENTERED_POSITION)
  }, [])

  const handleImageClick = () => {
    if (ignoreNextClickReference.current) {
      ignoreNextClickReference.current = false
      return
    }
    toggleActualSize()
  }

  const beginDragging = (event: ReactPointerEvent<HTMLImageElement>) => {
    if (!actualSize) return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragStateReference.current = {
      pointerIdentifier: event.pointerId,
      pointerHorizontal: event.clientX,
      pointerVertical: event.clientY,
      positionHorizontal: panPosition.horizontal,
      positionVertical: panPosition.vertical,
      moved: false,
    }
    ignoreNextClickReference.current = false
    setDragging(true)
  }

  const continueDragging = (event: ReactPointerEvent<HTMLImageElement>) => {
    const dragState = dragStateReference.current
    if (!dragState || dragState.pointerIdentifier !== event.pointerId) return

    const horizontalDifference = event.clientX - dragState.pointerHorizontal
    const verticalDifference = event.clientY - dragState.pointerVertical
    if (Math.abs(horizontalDifference) > 3 || Math.abs(verticalDifference) > 3) {
      dragState.moved = true
    }
    setPanPosition(clampPanPosition(
      dragState.positionHorizontal + horizontalDifference,
      dragState.positionVertical + verticalDifference,
    ))
  }

  const finishDragging = (event: ReactPointerEvent<HTMLImageElement>) => {
    const dragState = dragStateReference.current
    if (!dragState || dragState.pointerIdentifier !== event.pointerId) return
    ignoreNextClickReference.current = dragState.moved
    dragStateReference.current = null
    setDragging(false)
  }

  const cancelDragging = () => {
    dragStateReference.current = null
    ignoreNextClickReference.current = false
    setDragging(false)
  }

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

  useEffect(() => {
    if (!actualSize) return
    const keepImageInBounds = () => {
      setPanPosition((currentPosition) => clampPanPosition(
        currentPosition.horizontal,
        currentPosition.vertical,
      ))
    }
    window.addEventListener('resize', keepImageInBounds)
    return () => window.removeEventListener('resize', keepImageInBounds)
  }, [actualSize, clampPanPosition])

  return (
    <div className="viewer" role="dialog" aria-modal="true" aria-label="Image details">
      <div className="viewer-stage">
        <div className="viewer-toolbar">
          <div className="viewer-file">
            <span>{metadata?.filename ?? 'Loading image…'}</span>
            {metadata && <small>{metadata.width} × {metadata.height}</small>}
          </div>
          <div className="viewer-actions">
            <IconButton
              accessibleLabel={actualSize ? 'Fit image to window' : 'View image at actual size'}
              appearance="viewer"
              aria-pressed={actualSize}
              onClick={toggleActualSize}
            >
              {actualSize ? <ZoomOut size={18} /> : <ZoomIn size={18} />}
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
        <div className="viewer-image-wrap" ref={viewportReference}>
          <img
            ref={imageReference}
            src={imageUrl(imageIdentifier)}
            alt={metadata?.prompt || metadata?.filename || 'Selected image'}
            className={`${actualSize ? 'actual-size' : ''} ${dragging ? 'dragging' : ''}`.trim()}
            style={actualSize ? {
              transform: `translate3d(${panPosition.horizontal}px, ${panPosition.vertical}px, 0)`,
            } : undefined}
            draggable={false}
            onClick={handleImageClick}
            onPointerDown={beginDragging}
            onPointerMove={continueDragging}
            onPointerUp={finishDragging}
            onPointerCancel={cancelDragging}
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
          {actualSize ? <><kbd>Drag</kbd> pan <i /> <kbd>Click</kbd> fit</> : <><kbd>Click</kbd> actual size</>}
          <i /> <kbd>←</kbd><kbd>→</kbd> navigate <i /> <kbd>ESC</kbd> close
        </div>
      </div>
      <Inspector metadata={metadata} loading={loading} />
    </div>
  )
}
