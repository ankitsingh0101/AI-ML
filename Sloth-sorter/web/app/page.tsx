'use client'

import { useEffect, useMemo, useState } from 'react'
import { Archive, Check, ChevronRight, Clock3, FileCheck2, FolderOpen, Leaf, Loader2, Moon, RotateCcw, ScanLine, Search, Sun, Undo2, WandSparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { apply, browse, scan, status, undo, type ScanResult, type Status } from '@/lib/api'

const categoryStyles: Record<string, string> = {
  Documents: 'category-work', Finance: 'category-work', Study: 'category-work',
  Videos: 'category-media', Audio: 'category-media', Code: 'category-media',
  Images: 'category-screenshots',
  Archives: 'category-archive', Installers: 'category-archive', Other: 'category-archive',
}

export default function Page() {
  const [folder, setFolder] = useState('')
  const [result, setResult] = useState<ScanResult | null>(null)
  const [info, setInfo] = useState<Status | null>(null)
  const [error, setError] = useState<string | null>(null)
  const connected = info ? info.connected : null
  const [busy, setBusy] = useState<'scan' | 'apply' | 'undo' | 'browse' | null>(null)
  const [success, setSuccess] = useState(false)
  const [dark, setDark] = useState(false)

  useEffect(() => {
    status().then(setInfo)
  }, [])

  const selectedCount = useMemo(() => result?.files.filter((file) => file.selected).length ?? 0, [result])
  const timeSaved = selectedCount * 2 + 3

  function updateFile(id: string) {
    setResult((current) => current ? { ...current, files: current.files.map((file) => file.id === id ? { ...file, selected: !file.selected } : file) } : current)
  }

  async function handleBrowse() {
    setBusy('browse')
    setError(null)
    try {
      const { folder: picked } = await browse()
      if (picked) {
        setFolder(picked)
        await handleScan(picked)
        return
      }
    } catch (e) {
      setError((e as Error).message)
    }
    setBusy(null)
  }

  async function handleScan(path?: string) {
    const target = path ?? folder
    setBusy('scan')
    setSuccess(false)
    setError(null)
    try {
      setResult(await scan(target))
    } catch (e) {
      setError((e as Error).message)
    }
    setBusy(null)
  }

  async function handleApply() {
    if (!result || selectedCount === 0) return
    setBusy('apply')
    setError(null)
    try {
      await apply(result.folder, result.files)
      setSuccess(true)
    } catch (e) {
      setError((e as Error).message)
    }
    setBusy(null)
  }

  async function handleUndo() {
    setBusy('undo')
    setError(null)
    try {
      await undo(result?.folder ?? folder)
      setSuccess(false)
      setResult(null)
    } catch (e) {
      setError((e as Error).message)
    }
    setBusy(null)
  }

  return (
    <main className={dark ? 'app-shell dark' : 'app-shell'}>
      <div className="glow glow-one" />
      <div className="glow glow-two" />
      <div className="page-wrap">
        <header className="topbar">
          <div className="brand-lockup">
            <div className="brand-mark"><span>🦥</span></div>
            <div><p className="eyebrow">LOCAL AI FILE TIDIER</p><h1>Sloth Sorter</h1></div>
          </div>
          <div className="header-actions">
            <div className={connected ? 'status-pill connected' : 'status-pill'}><span className="status-dot" />{connected === null ? 'Connecting…' : `Local model: ${info?.model} ${connected ? 'connected' : 'not connected'}`}</div>
            <Button variant="ghost" size="icon" className="theme-toggle" onClick={() => setDark((value) => !value)} aria-label="Toggle light and dark mode">{dark ? <Sun /> : <Moon />}</Button>
          </div>
        </header>

        <section className="hero-section">
          <div><div className="hero-kicker"><WandSparkles /> Your files, gently organized</div><h2>Less mess.<br /><em>More sloth.</em></h2><p>Point me at a folder and I&apos;ll make a thoughtful sorting plan — right on your machine.</p></div>
          <div className="hero-illustration" aria-hidden="true"><div className="leaf leaf-a">✦</div><div className="sloth-art">🦥</div><div className="leaf leaf-b">✦</div></div>
        </section>

        <section className="scan-card panel">
          <div className="section-label"><FolderOpen /> FOLDER TO TIDY</div>
          <div className="scan-row"><div className="path-input-wrap"><Search /><input aria-label="Folder path" placeholder="C:\Users\you\Downloads" value={folder} onChange={(event) => setFolder(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.nativeEvent.isComposing && event.keyCode !== 229) handleScan() }} /></div><Button variant="outline" size="lg" onClick={handleBrowse} disabled={busy !== null}>{busy === 'browse' ? <Loader2 className="spin" data-icon="inline-start" /> : <FolderOpen data-icon="inline-start" />} Browse</Button><Button size="lg" onClick={() => handleScan()} disabled={busy !== null || !folder}>{busy === 'scan' ? <Loader2 className="spin" data-icon="inline-start" /> : <ScanLine data-icon="inline-start" />} {busy === 'scan' ? 'Scanning…' : 'Scan folder'}</Button></div>
          <p className="helper-text"><Leaf /> Everything stays local. Nothing leaves your computer.</p>
          {error && <p role="alert" style={{ color: '#b3402a', fontSize: 13, margin: '10px 0 0' }}>⚠ {error}</p>}
        </section>

        {!result && !busy && <section className="empty-state panel"><div className="empty-icon"><Archive /></div><h3>Your tidy plan will appear here</h3><p>Choose a folder above and let your local model do the sorting.</p></section>}
        {busy === 'scan' && <section className="loading-state panel"><Loader2 className="spin loading-icon" /><h3>Taking a thoughtful look…</h3><p>Sloth Sorter is figuring out where everything belongs.</p><div className="loading-bar"><span /></div></section>}

        {result && busy !== 'scan' && <>
          <div className="results-heading"><div><div className="section-label"><FileCheck2 /> SORTING PLAN</div><h3>{result.files.length} files found <span>in {result.folder}</span></h3></div><div className="plan-note"><span className="tiny-dot" /> Review before applying</div></div>
          <section className="table-card panel"><div className="table-scroll"><table><thead><tr><th className="check-col"><span className="sr-only">Include</span></th><th>ORIGINAL FILE</th><th>CATEGORY</th><th>NEW HOME</th><th>NEW FILENAME</th></tr></thead><tbody>{result.files.map((file) => <tr key={file.id} className={!file.selected ? 'row-excluded' : ''}><td><input type="checkbox" checked={file.selected} onChange={() => updateFile(file.id)} aria-label={`Include ${file.original}`} /></td><td><span className="file-name">{file.original}</span></td><td><span className={`category-badge ${categoryStyles[file.category]}`}>{file.category}</span></td><td><span className="destination"><ChevronRight />{file.destination}</span></td><td><span className="new-name">{file.newName}</span></td></tr>)}</tbody></table></div><div className="table-footer"><span>{selectedCount} of {result.files.length} files selected</span><button type="button" onClick={() => setResult((current) => current ? { ...current, files: current.files.map((file) => ({ ...file, selected: true })) } : current)}>Select all</button></div></section>
          <div className="action-row"><div className="actions"><Button size="lg" onClick={handleApply} disabled={busy !== null || selectedCount === 0}>{busy === 'apply' ? <Loader2 className="spin" data-icon="inline-start" /> : <Check data-icon="inline-start" />} {success ? 'Moves applied' : 'Apply moves'}</Button><Button variant="outline" size="lg" onClick={handleUndo} disabled={busy !== null}>{busy === 'undo' ? <Loader2 className="spin" data-icon="inline-start" /> : <Undo2 data-icon="inline-start" />} Undo last run</Button></div><p className="review-note">You can always undo your last run.</p></div>
          {success && <div className="success-banner"><div className="success-icon"><Check /></div><div><strong>Nice and tidy.</strong><span>{selectedCount} files moved into their new homes.</span></div><button type="button" onClick={() => setSuccess(false)} aria-label="Dismiss success message">×</button></div>}
        </>}

        <section className="summary-card panel"><div className="summary-heading"><div className="section-label"><Clock3 /> QUICK SUMMARY</div><span className="summary-mood">slow and steady</span></div><div className="summary-stats"><div><strong>{result?.files.length ?? '—'}</strong><span>Files found</span></div><div><strong>{result ? selectedCount : '—'}</strong><span>Files to move</span></div><div><strong>{result ? `${timeSaved} min` : '—'}</strong><span>Estimated time saved</span></div></div></section>
        <footer><span>Made for calmer desktops.</span><span>Sloth Sorter <span className="footer-sloth">🦥</span></span></footer>
      </div>
    </main>
  )
}