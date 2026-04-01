import { desktopCapturer } from 'electron'
import type { SourceInfo } from '../shared/types'

export async function getCaptureSources(): Promise<SourceInfo[]> {
  const sources = await desktopCapturer.getSources({
    types: ['screen', 'window'],
    thumbnailSize: { width: 320, height: 200 },
    fetchWindowIcons: false
  })

  return sources.map((s) => ({
    id: s.id,
    name: s.name,
    thumbnailDataUrl: s.thumbnail.toDataURL(),
    type: s.id.startsWith('screen') ? 'screen' : 'window'
  })) as SourceInfo[]
}
