import React from 'react'
import { useI18n } from '../../i18n'
import type { ToolId } from '../../types'
import { CleanupView, LargeFileView, SystemInfoView } from './SystemViews'

/** 系统硬件中心：信息视图读取 FastAPI /api/system/* 端点 */
export const SystemCenter: React.FC<{ tool: ToolId }> = ({ tool }) => {
  const { t } = useI18n()
  switch (tool) {
    case 'hardware-overview':
      return <SystemInfoView endpoint="/api/system/hardware/overview" title={t('tools.hardwareOverview')} />
    case 'hardware-cpu-memory':
      return <SystemInfoView endpoint="/api/system/hardware/cpu-memory" title={t('tools.hardwareCpuMemory')} />
    case 'hardware-gpu-display':
      return <SystemInfoView endpoint="/api/system/hardware/gpu-display" title={t('tools.hardwareGpuDisplay')} />
    case 'hardware-mainboard':
      return <SystemInfoView endpoint="/api/system/hardware/mainboard" title={t('tools.hardwareMainboard')} />
    case 'hardware-storage':
      return <SystemInfoView endpoint="/api/system/hardware/storage" title={t('tools.hardwareStorage')} />
    case 'hardware-power-sensors':
      return <SystemInfoView endpoint="/api/system/hardware/network" title={t('tools.hardwarePowerSensors')} />
    case 'large-file-cleanup':
      return <LargeFileView />
    case 'c-drive-cleanup':
      return <CleanupView />
    default:
      return null
  }
}
