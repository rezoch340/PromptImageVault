import { useCallback, useEffect, useRef, useState } from 'react'
import { getImages, getStatus, updatesUrl } from '../api'
import type { ImageItem, ImagePage, LibraryStatus, SortKey } from '../types'

const EMPTY_LIBRARY_STATUS: LibraryStatus = {
  images: 0,
  scanning: true,
  last_scan_time: null,
  last_error: null,
  watching: false,
}

function requestErrorMessage(requestError: unknown) {
  return requestError instanceof Error ? requestError.message : 'Unknown error'
}

export function useImageLibrary() {
  const [images, setImages] = useState<ImageItem[]>([])
  const [totalImages, setTotalImages] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [hasMoreImages, setHasMoreImages] = useState(false)
  const [sortOrder, setSortOrder] = useState<SortKey>('newest')
  const [imagesLoading, setImagesLoading] = useState(true)
  const [additionalImagesLoading, setAdditionalImagesLoading] = useState(false)
  const [libraryError, setLibraryError] = useState<string | null>(null)
  const [libraryStatus, setLibraryStatus] = useState<LibraryStatus>(EMPTY_LIBRARY_STATUS)
  const refreshTimer = useRef<number | null>(null)

  const applyFirstPage = useCallback((imagePage: ImagePage) => {
    setImages(imagePage.items)
    setTotalImages(imagePage.total)
    setCurrentPage(1)
    setHasMoreImages(imagePage.has_more)
    setLibraryError(null)
  }, [])

  const requestFirstPage = useCallback(async (signal?: AbortSignal) => {
    try {
      const imagePage = await getImages(sortOrder, 1, signal)
      applyFirstPage(imagePage)
    } catch (requestError) {
      if (requestError instanceof DOMException && requestError.name === 'AbortError') return
      setLibraryError(requestErrorMessage(requestError))
    } finally {
      if (!signal?.aborted) setImagesLoading(false)
    }
  }, [applyFirstPage, sortOrder])

  useEffect(() => {
    const requestController = new AbortController()
    const requestTimer = window.setTimeout(
      () => void requestFirstPage(requestController.signal),
      0,
    )
    return () => {
      window.clearTimeout(requestTimer)
      requestController.abort()
    }
  }, [requestFirstPage])

  useEffect(() => {
    let pollingActive = true
    const pollLibraryStatus = async () => {
      try {
        const nextStatus = await getStatus()
        if (pollingActive) setLibraryStatus(nextStatus)
      } catch {
        // Image requests surface connection failures in the interface.
      }
    }
    void pollLibraryStatus()
    const pollingInterval = window.setInterval(pollLibraryStatus, 3000)
    return () => {
      pollingActive = false
      window.clearInterval(pollingInterval)
    }
  }, [])

  useEffect(() => {
    let updateSocket: WebSocket | null = null
    let reconnectTimer: number | null = null
    let connectionActive = true

    const connectUpdateSocket = () => {
      updateSocket = new WebSocket(updatesUrl())
      updateSocket.onmessage = () => {
        if (refreshTimer.current) window.clearTimeout(refreshTimer.current)
        refreshTimer.current = window.setTimeout(() => void requestFirstPage(), 250)
      }
      updateSocket.onclose = () => {
        if (connectionActive) reconnectTimer = window.setTimeout(connectUpdateSocket, 2000)
      }
    }

    connectUpdateSocket()
    return () => {
      connectionActive = false
      updateSocket?.close()
      if (reconnectTimer) window.clearTimeout(reconnectTimer)
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current)
    }
  }, [requestFirstPage])

  const refreshImages = useCallback(() => {
    setImagesLoading(true)
    setLibraryError(null)
    void requestFirstPage()
  }, [requestFirstPage])

  const changeSortOrder = useCallback((nextSortOrder: SortKey) => {
    setImagesLoading(true)
    setSortOrder(nextSortOrder)
  }, [])

  const loadMoreImages = useCallback(async () => {
    setAdditionalImagesLoading(true)
    try {
      const nextPage = await getImages(sortOrder, currentPage + 1)
      setImages((currentImages) => [...currentImages, ...nextPage.items])
      setCurrentPage(nextPage.page)
      setHasMoreImages(nextPage.has_more)
    } catch (requestError) {
      setLibraryError(requestErrorMessage(requestError))
    } finally {
      setAdditionalImagesLoading(false)
    }
  }, [currentPage, sortOrder])

  return {
    images,
    totalImages,
    hasMoreImages,
    sortOrder,
    imagesLoading,
    additionalImagesLoading,
    libraryError,
    libraryStatus,
    refreshImages,
    changeSortOrder,
    loadMoreImages,
  }
}
