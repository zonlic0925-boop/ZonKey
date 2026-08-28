import React from 'react'
import type { ToolId } from '../../types'
import { AudioClipView, AudioConvertView, AudioExtractView, BpmDetectView } from './MediaAudioViews'
import { VideoFrameView } from './VideoFrameView'

/** 音视频中心：视频转码与 GIF 合成需要编码器库，属后续批次 */
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
    case 'video-frame':
      return <VideoFrameView />
    default:
      return null
  }
}
