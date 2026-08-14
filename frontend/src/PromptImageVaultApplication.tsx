import { useCallback, useEffect, useState } from 'react'
import { getMetadata } from './api'
import { Header } from './components/Header'
import { ImageGrid } from './components/ImageGrid'
import { ImageViewer } from './components/ImageViewer'
import { Sidebar } from './components/Sidebar'
import { useImageLibrary } from './hooks/useImageLibrary'
import type { ImageMetadata } from './types'
import './styles.css'

export default function PromptImageVaultApplication() {
  const {
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
  } = useImageLibrary()
  const [selectedImageIdentifier, setSelectedImageIdentifier] = useState<string | null>(null)
  const [metadata, setMetadata] = useState<ImageMetadata | null>(null)
  const [metadataLoading, setMetadataLoading] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    if (!selectedImageIdentifier) return
    const requestController = new AbortController()
    getMetadata(selectedImageIdentifier, requestController.signal)
      .then(setMetadata)
      .catch((requestError) => {
        if (requestError instanceof DOMException && requestError.name === 'AbortError') return
        setMetadata(null)
      })
      .finally(() => {
        if (!requestController.signal.aborted) setMetadataLoading(false)
      })
    return () => requestController.abort()
  }, [selectedImageIdentifier])

  const selectImage = useCallback((imageIdentifier: string) => {
    setSelectedImageIdentifier(imageIdentifier)
    setMetadata(null)
    setMetadataLoading(true)
  }, [])

  const selectedImageIndex = selectedImageIdentifier
    ? images.findIndex((image) => image.image_identifier === selectedImageIdentifier)
    : -1

  const selectPreviousImage = useCallback(() => {
    if (selectedImageIndex > 0) {
      selectImage(images[selectedImageIndex - 1].image_identifier)
    }
  }, [images, selectImage, selectedImageIndex])

  const selectNextImage = useCallback(() => {
    if (selectedImageIndex >= 0 && selectedImageIndex < images.length - 1) {
      selectImage(images[selectedImageIndex + 1].image_identifier)
    }
  }, [images, selectImage, selectedImageIndex])

  const closeImageViewer = useCallback(() => {
    setSelectedImageIdentifier(null)
    setMetadata(null)
    setMetadataLoading(false)
  }, [])

  return (
    <div className="application-shell">
      <Sidebar
        total={totalImages}
        scanning={libraryStatus.scanning}
        mobileOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />
      <main className="main-content">
        <Header
          total={totalImages}
          sort={sortOrder}
          scanning={libraryStatus.scanning || imagesLoading}
          onSort={changeSortOrder}
          onRefresh={refreshImages}
          onMenu={() => setMobileMenuOpen(true)}
        />
        {libraryStatus.last_error && (
          <div className="scan-warning">Scanner: {libraryStatus.last_error}</div>
        )}
        <ImageGrid
          images={images}
          loading={imagesLoading}
          error={libraryError}
          onSelect={selectImage}
          onRetry={refreshImages}
        />
        {hasMoreImages && (
          <div className="load-more-wrap">
            <button onClick={() => void loadMoreImages()} disabled={additionalImagesLoading}>
              {additionalImagesLoading
                ? 'Loading…'
                : `Load more · ${images.length} of ${totalImages}`}
            </button>
          </div>
        )}
        {imagesLoading && images.length > 0 && (
          <div className="floating-loader">Refreshing library…</div>
        )}
      </main>
      {selectedImageIdentifier && (
        <ImageViewer
          imageIdentifier={selectedImageIdentifier}
          metadata={metadata}
          loading={metadataLoading}
          canPrevious={selectedImageIndex > 0}
          canNext={
            selectedImageIndex >= 0 && selectedImageIndex < images.length - 1
          }
          onClose={closeImageViewer}
          onPrevious={selectPreviousImage}
          onNext={selectNextImage}
        />
      )}
    </div>
  )
}
