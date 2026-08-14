import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  WheelEvent as ReactWheelEvent,
} from 'react'

interface ViewTransform {
  scale: number
  horizontal: number
  vertical: number
}

interface PointerLocation {
  horizontal: number
  vertical: number
}

interface PanGesture {
  kind: 'pan'
  pointerIdentifier: number
  pointerHorizontal: number
  pointerVertical: number
  transform: ViewTransform
  moved: boolean
}

interface PinchGesture {
  kind: 'pinch'
  distance: number
  centerHorizontal: number
  centerVertical: number
  transform: ViewTransform
  moved: boolean
}

type GestureState = PanGesture | PinchGesture

const INITIAL_TRANSFORM: ViewTransform = { scale: 1, horizontal: 0, vertical: 0 }
const MAXIMUM_ZOOM_SCALE = 8
const MOVEMENT_THRESHOLD = 3
const SCALE_TOLERANCE = 0.005
const WHEEL_ZOOM_SENSITIVITY = 0.0015

function clampValue(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value))
}

function pointerDistance(firstPointer: PointerLocation, secondPointer: PointerLocation) {
  return Math.hypot(
    secondPointer.horizontal - firstPointer.horizontal,
    secondPointer.vertical - firstPointer.vertical,
  )
}

function pointerCenter(firstPointer: PointerLocation, secondPointer: PointerLocation) {
  return {
    horizontal: (firstPointer.horizontal + secondPointer.horizontal) / 2,
    vertical: (firstPointer.vertical + secondPointer.vertical) / 2,
  }
}

function firstTwoPointers(activePointers: Map<number, PointerLocation>) {
  const pointers = Array.from(activePointers.values())
  if (pointers.length < 2) return null
  return [pointers[0], pointers[1]] as const
}

export function useImageViewport() {
  const [imageReady, setImageReady] = useState(false)
  const [fitScale, setFitScale] = useState(1)
  const [viewTransform, setViewTransform] = useState(INITIAL_TRANSFORM)
  const [dragging, setDragging] = useState(false)
  const viewportReference = useRef<HTMLDivElement>(null)
  const imageReference = useRef<HTMLImageElement>(null)
  const fitScaleReference = useRef(1)
  const viewTransformReference = useRef(INITIAL_TRANSFORM)
  const activePointersReference = useRef(new Map<number, PointerLocation>())
  const gestureStateReference = useRef<GestureState | null>(null)
  const gestureSequenceMovedReference = useRef(false)
  const suppressClickUntilReference = useRef(0)

  const commitViewTransform = useCallback((transform: ViewTransform) => {
    viewTransformReference.current = transform
    setViewTransform(transform)
  }, [])

  const calculateFitScale = useCallback(() => {
    const viewport = viewportReference.current
    const image = imageReference.current
    if (!viewport || !image || !image.naturalWidth || !image.naturalHeight) return 1

    const viewportStyle = window.getComputedStyle(viewport)
    const availableWidth = viewport.clientWidth
      - Number.parseFloat(viewportStyle.paddingLeft)
      - Number.parseFloat(viewportStyle.paddingRight)
    const availableHeight = viewport.clientHeight
      - Number.parseFloat(viewportStyle.paddingTop)
      - Number.parseFloat(viewportStyle.paddingBottom)

    return Math.min(
      1,
      Math.max(1, availableWidth) / image.naturalWidth,
      Math.max(1, availableHeight) / image.naturalHeight,
    )
  }, [])

  const clampViewTransform = useCallback((transform: ViewTransform): ViewTransform => {
    const viewport = viewportReference.current
    const image = imageReference.current
    if (!viewport || !image) return transform

    const scaledWidth = image.naturalWidth * transform.scale
    const scaledHeight = image.naturalHeight * transform.scale
    const maximumHorizontal = Math.max(0, (scaledWidth - viewport.clientWidth) / 2)
    const maximumVertical = Math.max(0, (scaledHeight - viewport.clientHeight) / 2)

    return {
      scale: transform.scale,
      horizontal: clampValue(transform.horizontal, -maximumHorizontal, maximumHorizontal),
      vertical: clampValue(transform.vertical, -maximumVertical, maximumVertical),
    }
  }, [])

  const resetToFit = useCallback(() => {
    commitViewTransform({
      scale: fitScaleReference.current,
      horizontal: 0,
      vertical: 0,
    })
  }, [commitViewTransform])

  const zoomAtPoint = useCallback((requestedScale: number, clientHorizontal: number, clientVertical: number) => {
    const viewport = viewportReference.current
    if (!viewport) return

    const currentTransform = viewTransformReference.current
    const nextScale = clampValue(
      requestedScale,
      fitScaleReference.current,
      MAXIMUM_ZOOM_SCALE,
    )
    if (Math.abs(nextScale - currentTransform.scale) < Number.EPSILON) return

    const viewportBounds = viewport.getBoundingClientRect()
    const focalHorizontal = clientHorizontal - viewportBounds.left - viewportBounds.width / 2
    const focalVertical = clientVertical - viewportBounds.top - viewportBounds.height / 2
    const scaleRatio = nextScale / currentTransform.scale
    commitViewTransform(clampViewTransform({
      scale: nextScale,
      horizontal: focalHorizontal
        - (focalHorizontal - currentTransform.horizontal) * scaleRatio,
      vertical: focalVertical
        - (focalVertical - currentTransform.vertical) * scaleRatio,
    }))
  }, [clampViewTransform, commitViewTransform])

  const atFitScale = Math.abs(viewTransform.scale - fitScale) < SCALE_TOLERANCE
  const detailScale = fitScale < 1 - SCALE_TOLERANCE
    ? 1
    : Math.min(MAXIMUM_ZOOM_SCALE, fitScale * 2)

  const toggleZoom = useCallback(() => {
    if (!imageReady) return
    if (!atFitScale) {
      resetToFit()
      return
    }
    const viewport = viewportReference.current
    if (!viewport) return
    const viewportBounds = viewport.getBoundingClientRect()
    zoomAtPoint(
      detailScale,
      viewportBounds.left + viewportBounds.width / 2,
      viewportBounds.top + viewportBounds.height / 2,
    )
  }, [atFitScale, detailScale, imageReady, resetToFit, zoomAtPoint])

  const handleImageLoad = () => {
    const nextFitScale = calculateFitScale()
    fitScaleReference.current = nextFitScale
    setFitScale(nextFitScale)
    commitViewTransform({ scale: nextFitScale, horizontal: 0, vertical: 0 })
    setImageReady(true)
  }

  const handleImageClick = (event: ReactMouseEvent<HTMLImageElement>) => {
    if (performance.now() < suppressClickUntilReference.current) return
    if (!atFitScale) {
      resetToFit()
      return
    }
    zoomAtPoint(detailScale, event.clientX, event.clientY)
  }

  const handleWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (!imageReady) return
    event.preventDefault()
    const deltaMultiplier = event.deltaMode === 1
      ? 16
      : event.deltaMode === 2 ? viewportReference.current?.clientHeight ?? 1 : 1
    const normalizedDelta = event.deltaY * deltaMultiplier
    const nextScale = viewTransformReference.current.scale
      * Math.exp(-normalizedDelta * WHEEL_ZOOM_SENSITIVITY)
    zoomAtPoint(nextScale, event.clientX, event.clientY)
  }

  const startPinchGesture = () => {
    const pointerPair = firstTwoPointers(activePointersReference.current)
    if (!pointerPair) return
    const center = pointerCenter(pointerPair[0], pointerPair[1])
    gestureStateReference.current = {
      kind: 'pinch',
      distance: Math.max(1, pointerDistance(pointerPair[0], pointerPair[1])),
      centerHorizontal: center.horizontal,
      centerVertical: center.vertical,
      transform: viewTransformReference.current,
      moved: false,
    }
    setDragging(true)
  }

  const beginGesture = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!imageReady) return
    if (event.pointerType === 'mouse' && event.button !== 0) return
    if (event.target instanceof Element && event.target.closest('button, a')) return

    if (activePointersReference.current.size === 0) {
      gestureSequenceMovedReference.current = false
      suppressClickUntilReference.current = 0
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    activePointersReference.current.set(event.pointerId, {
      horizontal: event.clientX,
      vertical: event.clientY,
    })
    if (activePointersReference.current.size >= 2) {
      startPinchGesture()
      return
    }

    gestureStateReference.current = {
      kind: 'pan',
      pointerIdentifier: event.pointerId,
      pointerHorizontal: event.clientX,
      pointerVertical: event.clientY,
      transform: viewTransformReference.current,
      moved: false,
    }
    setDragging(!atFitScale)
  }

  const continueGesture = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!activePointersReference.current.has(event.pointerId)) return
    event.preventDefault()
    activePointersReference.current.set(event.pointerId, {
      horizontal: event.clientX,
      vertical: event.clientY,
    })

    const gestureState = gestureStateReference.current
    if (!gestureState) return

    if (gestureState.kind === 'pinch') {
      const pointerPair = firstTwoPointers(activePointersReference.current)
      const viewport = viewportReference.current
      if (!pointerPair || !viewport) return

      const currentCenter = pointerCenter(pointerPair[0], pointerPair[1])
      const currentDistance = pointerDistance(pointerPair[0], pointerPair[1])
      const nextScale = clampValue(
        gestureState.transform.scale * currentDistance / gestureState.distance,
        fitScaleReference.current,
        MAXIMUM_ZOOM_SCALE,
      )
      const viewportBounds = viewport.getBoundingClientRect()
      const initialFocalHorizontal = gestureState.centerHorizontal
        - viewportBounds.left - viewportBounds.width / 2
      const initialFocalVertical = gestureState.centerVertical
        - viewportBounds.top - viewportBounds.height / 2
      const currentFocalHorizontal = currentCenter.horizontal
        - viewportBounds.left - viewportBounds.width / 2
      const currentFocalVertical = currentCenter.vertical
        - viewportBounds.top - viewportBounds.height / 2
      const scaleRatio = nextScale / gestureState.transform.scale

      if (
        Math.abs(currentDistance - gestureState.distance) > MOVEMENT_THRESHOLD
        || Math.abs(currentCenter.horizontal - gestureState.centerHorizontal) > MOVEMENT_THRESHOLD
        || Math.abs(currentCenter.vertical - gestureState.centerVertical) > MOVEMENT_THRESHOLD
      ) {
        gestureState.moved = true
        gestureSequenceMovedReference.current = true
      }

      commitViewTransform(clampViewTransform({
        scale: nextScale,
        horizontal: currentFocalHorizontal
          - (initialFocalHorizontal - gestureState.transform.horizontal) * scaleRatio,
        vertical: currentFocalVertical
          - (initialFocalVertical - gestureState.transform.vertical) * scaleRatio,
      }))
      return
    }

    if (gestureState.pointerIdentifier !== event.pointerId) return
    const horizontalDifference = event.clientX - gestureState.pointerHorizontal
    const verticalDifference = event.clientY - gestureState.pointerVertical
    if (
      Math.abs(horizontalDifference) > MOVEMENT_THRESHOLD
      || Math.abs(verticalDifference) > MOVEMENT_THRESHOLD
    ) {
      gestureState.moved = true
      gestureSequenceMovedReference.current = true
    }
    commitViewTransform(clampViewTransform({
      scale: gestureState.transform.scale,
      horizontal: gestureState.transform.horizontal + horizontalDifference,
      vertical: gestureState.transform.vertical + verticalDifference,
    }))
  }

  const finishGesture = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!activePointersReference.current.has(event.pointerId)) return
    activePointersReference.current.delete(event.pointerId)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    const remainingPointer = activePointersReference.current.entries().next().value
    if (remainingPointer) {
      const [pointerIdentifier, pointerLocation] = remainingPointer
      gestureStateReference.current = {
        kind: 'pan',
        pointerIdentifier,
        pointerHorizontal: pointerLocation.horizontal,
        pointerVertical: pointerLocation.vertical,
        transform: viewTransformReference.current,
        moved: false,
      }
      setDragging(true)
      return
    }

    if (gestureSequenceMovedReference.current) {
      suppressClickUntilReference.current = performance.now() + 250
    }
    gestureStateReference.current = null
    setDragging(false)
  }

  const cancelGesture = (event: ReactPointerEvent<HTMLDivElement>) => {
    activePointersReference.current.delete(event.pointerId)
    gestureStateReference.current = null
    gestureSequenceMovedReference.current = true
    if (activePointersReference.current.size === 0) {
      suppressClickUntilReference.current = performance.now() + 250
    }
    setDragging(false)
  }

  useEffect(() => {
    const updateViewport = () => {
      if (!imageReference.current?.complete) return
      const previousFitScale = fitScaleReference.current
      const nextFitScale = calculateFitScale()
      const currentTransform = viewTransformReference.current
      const wasAtFitScale = Math.abs(currentTransform.scale - previousFitScale) < SCALE_TOLERANCE
      const nextScale = wasAtFitScale
        ? nextFitScale
        : clampValue(currentTransform.scale, nextFitScale, MAXIMUM_ZOOM_SCALE)

      fitScaleReference.current = nextFitScale
      setFitScale(nextFitScale)
      commitViewTransform(clampViewTransform({
        scale: nextScale,
        horizontal: wasAtFitScale ? 0 : currentTransform.horizontal,
        vertical: wasAtFitScale ? 0 : currentTransform.vertical,
      }))
    }
    window.addEventListener('resize', updateViewport)
    return () => window.removeEventListener('resize', updateViewport)
  }, [calculateFitScale, clampViewTransform, commitViewTransform])

  const zoomPercentage = Math.round(viewTransform.scale * 100)

  return {
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
  }
}
