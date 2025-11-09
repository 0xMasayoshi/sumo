export type Torrent = {
  hash: string
  name: string
  progress: number
  downloadRate: number
  uploadRate: number
  state: number
}

const BASE = "http://127.0.0.1:5040/api"

export async function addMagnet(magnet: string, savepath = ".", sequential = true) {
  const body = new URLSearchParams({
    magnet, savepath,
    sequential: sequential ? "1" : "0"
  })
  const r = await fetch(`${BASE}/add`, { method: "POST", body })
  if (!r.ok) throw new Error("add failed")
    console.log(r)
  return r.json() as Promise<{ ok: boolean; hash: string }>
}

export async function listTorrents(): Promise<Torrent[]> {
  const r = await fetch(`${BASE}/torrents`)
  if (!r.ok) throw new Error("list failed")
  return r.json()
}

export async function listFiles(hash: string): Promise<{ id: number; path: string }[]> {
  const r = await fetch(`${BASE}/files?hash=${encodeURIComponent(hash)}`)
  if (!r.ok) throw new Error("files failed")
  return r.json()
}
