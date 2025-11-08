import { useEffect, useState } from "react";

export default function App() {
  const [hash, setHash] = useState<string>("");

  async function addMagnet(magnet: string, savepath: string) {
    const form = new URLSearchParams({
      magnet, savepath, sequential: "1", firstlast: "1"
    });
    const r = await fetch("http://127.0.0.1:5040/api/add", { method: "POST", body: form });
    const j = await r.json();
    setHash(j.hash);
  }

  return (
    <div style={{ padding: 16 }}>
      <h1>Sumo</h1>
      <form onSubmit={e => {
        e.preventDefault();
        const magnet = (e.currentTarget as any).magnet.value;
        addMagnet(magnet, (e.currentTarget as any).save.value);
      }}>
        <input name="magnet" placeholder="magnet:..." style={{ width: 500 }} />
        <input name="save" placeholder="/path/to/save" style={{ width: 240, marginLeft: 8 }} />
        <button type="submit" style={{ marginLeft: 8 }}>Add</button>
      </form>
      {hash && <p>Added: {hash}</p>}
    </div>
  );
}
