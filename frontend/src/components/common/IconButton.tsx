import type { ButtonHTMLAttributes, ReactNode } from 'react'

type IconButtonAppearance = 'surface' | 'viewer' | 'navigation'

interface IconButtonProperties extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  accessibleLabel: string
  appearance?: IconButtonAppearance
  children: ReactNode
}

const APPEARANCE_CLASS_NAMES: Record<IconButtonAppearance, string> = {
  surface: 'icon-button',
  viewer: 'viewer-icon',
  navigation: 'viewer-arrow',
}

export function IconButton({
  accessibleLabel,
  appearance = 'surface',
  children,
  className = '',
  title,
  ...buttonProperties
}: IconButtonProperties) {
  const appearanceClassName = APPEARANCE_CLASS_NAMES[appearance]
  return (
    <button
      {...buttonProperties}
      type="button"
      className={`${appearanceClassName} ${className}`.trim()}
      aria-label={accessibleLabel}
      title={title ?? accessibleLabel}
    >
      {children}
    </button>
  )
}
