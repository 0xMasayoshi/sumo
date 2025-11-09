import { useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { addMagnet, listFiles, listTorrents, type Torrent } from "./lib/api"
import { Player } from "./components/Player"
import { homeDir, join } from "@tauri-apps/api/path"

export default function App() {
  const [magnet, setMagnet] = useState("")
  const [torrents, setTorrents] = useState<Torrent[]>([])
  const [selectedHash, setSelectedHash] = useState<string | null>(null)
  const [videoPath, setVideoPath] = useState<string | null>(null)
  const [downloadDir, setDownloadDir] = useState<string>("")
  const polling = useRef<number | null>(null)

    // resolve download dir at runtime using Tauri path API
  useEffect(() => {
    async function resolveDir() {
      const home = await homeDir()
      const dir = await join(home, "Documents", "sumo")
      setDownloadDir(dir)
    }
    resolveDir()
  }, [])


  // supported video formats
  const supportedExtensions = useMemo(
    () => [".mp4", ".mkv", ".webm", ".mov", ".avi", ".flv", ".m4v"],
    []
  )

  // poll torrents every 1.5s
  useEffect(() => {
    const tick = async () => {
      try {
        const t = await listTorrents()
        setTorrents(t)
      } catch {}
    }
    tick()
    polling.current = window.setInterval(tick, 1500)
    return () => { if (polling.current) clearInterval(polling.current) }
  }, [])

  async function onAdd() {
    if (!magnet.trim()) return
    const { hash } = await addMagnet(magnet.trim(), downloadDir, true)
    setSelectedHash(hash)
    setMagnet("")
    // try to find first video soon after adding
    setTimeout(selectFirstVideo, 1500, hash)
  }

  async function selectFirstVideo(hash: string | null = selectedHash) {
    console.log('hash', hash)
    if (!hash) return
    try {
      const files = await listFiles(hash)
      console.log('files', files)
      const video = files.find(f => {
        const lower = f.path.toLowerCase()
        return supportedExtensions.some(ext => lower.endsWith(ext))
      })
      if (video) setVideoPath(video.path)
      if (video) console.log('found!')
    } catch {}
  }

  const selected = useMemo(
    () => torrents.find(t => t.hash === selectedHash) || null,
    [torrents, selectedHash]
  )

  return (
    <div className="h-screen grid grid-cols-[240px_1fr] grid-rows-[44px_1fr]">
      {/* Topbar */}
      <div className="col-span-2 row-[1] flex items-center gap-2 px-3 border-b" data-tauri-drag-region>
        <div className="text-sm font-medium">Sumo</div>
        <Separator orientation="vertical" className="mx-2 h-5" />
        <Input
          placeholder="Paste magnet link…"
          value={magnet}
          onChange={e => setMagnet(e.target.value)}
          className="w-[520px]"
        />
        <Button size="sm" onClick={onAdd}>Add</Button>
        <div className="ml-auto text-xs text-muted-foreground">
          {selected ? `${(selected.progress * 100).toFixed(1)}%` : ""}
        </div>
      </div>

      {/* Sidebar */}
      <aside className="row-[2] col-[1] border-r p-2 space-y-1">
        {torrents.map(t => (
          <Button
            key={t.hash}
            variant={t.hash === selectedHash ? "secondary" : "ghost"}
            className="w-full justify-start"
            onClick={() => { setSelectedHash(t.hash); setVideoPath(null); selectFirstVideo(t.hash) }}
            title={t.name}
          >
            <span className="truncate">{t.name || t.hash}</span>
          </Button>
        ))}
      </aside>

      {/* Content */}
      <main className="row-[2] col-[2] p-3 overflow-auto">
        <div className="mb-2 text-sm">
          {selected ? <span className="opacity-75">{selected.name}</span> : "No torrent selected"}
        </div>
        <div className="h-[520px]">
          <Player filePath={videoPath} />
        </div>
      </main>
    </div>
  )
}
