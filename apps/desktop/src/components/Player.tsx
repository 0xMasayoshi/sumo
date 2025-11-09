import { useEffect, useMemo, useRef } from "react"
import { convertFileSrc } from "@tauri-apps/api/core"

export function Player({ filePath }: { filePath: string | null }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const src = useMemo(() => (filePath ? convertFileSrc(filePath) : ""), [filePath])

  useEffect(() => {
    const v = videoRef.current
    if (!v || !src) return
    // Attempt to reload when source changes
    v.pause()
    v.src = src
    v.load()
  }, [src])

  if (!filePath) return <div className="text-sm text-muted-foreground">Select a video file…</div>
  return <video ref={videoRef} controls className="w-full h-full rounded-lg" />
}
