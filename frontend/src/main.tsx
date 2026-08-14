import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import PromptImageVaultApplication from './PromptImageVaultApplication'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PromptImageVaultApplication />
  </StrictMode>,
)
