import React from 'react'
import type { ToolId } from '../../types'
import { AudioClipView, AudioConvertView, AudioExtractView, BpmDetectView } from './MediaAudioViews'
import { VideoConvertView } from './VideoConvertView'
import { VideoFrameView } from './VideoFrameView'
import { VideoGifView } from './VideoGifView'

/** 音视频中心：按二级工具 ID 渲染对应视图 */
export const MediaCenter: React.FC<{ tool: ToolId }> = ({ tool }) => {
  switch (tool) {
    case 'bpm-detect':
      return <BpmDetectView />
    case 'audio-clip':
      return <AudioClipView />
    case 'audio-convert':
      return <AudioConvertView />
    case 'audio-extract':
      return <AudioExtractView />
    case 'video-convert':
      return <VideoConvertView />
    case 'video-frame':
      return <VideoFrameView />
    case 'video-gif':
      return <VideoGifView />
    default:
      return null
  }
}
