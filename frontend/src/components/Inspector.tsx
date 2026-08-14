import { Check, Copy } from 'lucide-react'
import { useState } from 'react'
import type { ImageMetadata } from '../types'

interface InspectorProps {
  metadata: ImageMetadata | null
  loading: boolean
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1400)
  }
  return <button className="copy-button" onClick={copy} disabled={!value} title={`Copy ${label}`}>
    {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}
  </button>
}

function DataRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value === null || value === undefined || value === '') return null
  return <div className="data-row"><span>{label}</span><strong title={String(value)}>{value}</strong></div>
}

export function Inspector({ metadata, loading }: InspectorProps) {
  if (!metadata) {
    return <aside className="inspector inspector-loading">
      <div className="inspector-title"><div /><span /></div>
      <div className="prompt-skeleton" /><div className="prompt-skeleton short" />
      <div className="details-skeleton" />
    </aside>
  }

  const completeMetadata = [
    metadata.prompt ? `Prompt:\n${metadata.prompt}` : '',
    metadata.negative_prompt ? `Negative prompt:\n${metadata.negative_prompt}` : '',
    `Seed: ${metadata.seed ?? '—'}`,
    `Model: ${metadata.model ?? '—'}`,
    `Steps: ${metadata.steps ?? '—'}, Sampler: ${metadata.sampler ?? '—'}, CFG: ${metadata.cfg ?? '—'}`,
  ].filter(Boolean).join('\n\n')

  return (
    <aside className="inspector" aria-busy={loading}>
      <div className="inspector-heading">
        <div><span>METADATA</span><h2>Generation details</h2></div>
        <CopyButton value={completeMetadata} label="all metadata" />
      </div>

      <section className="prompt-section">
        <div className="section-title"><h3>Prompt</h3><CopyButton value={metadata.prompt ?? ''} label="prompt" /></div>
        <p className={metadata.prompt ? '' : 'muted'}>{metadata.prompt || 'No embedded prompt found.'}</p>
      </section>

      <section className="prompt-section negative">
        <div className="section-title">
          <h3>Negative prompt</h3>
          <CopyButton
            value={metadata.negative_prompt ?? ''}
            label="negative prompt"
          />
        </div>
        <p className={metadata.negative_prompt ? '' : 'muted'}>
          {metadata.negative_prompt || 'No negative prompt found.'}
        </p>
      </section>

      <section className="details-section">
        <h3>Parameters</h3>
        <div className="details-grid">
          <DataRow label="Seed" value={metadata.seed} />
          <DataRow label="Model" value={metadata.model} />
          <DataRow label="Steps" value={metadata.steps} />
          <DataRow label="Sampler" value={metadata.sampler} />
          <DataRow label="Scheduler" value={metadata.scheduler} />
          <DataRow label="CFG scale" value={metadata.cfg} />
          <DataRow label="Resolution" value={`${metadata.width} × ${metadata.height}`} />
          <DataRow label="File size" value={`${(metadata.file_size / 1024 / 1024).toFixed(2)} MB`} />
        </div>
      </section>
    </aside>
  )
}
