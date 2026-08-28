import React from 'react'
import type { ToolId } from '../../types'
import { BmiCalcView } from './BmiCalcView'
import { TimestampCalcView } from './TimestampCalcView'
import { MortgageCalcView } from './MortgageCalcView'
import { InterestCalcView } from './InterestCalcView'
import { PasswordGenView } from './PasswordGenView'
import { JsonToolsView } from './JsonToolsView'
import { Base64View } from './Base64View'
import { UrlCodecView } from './UrlCodecView'
import { UuidView } from './UuidView'
import { JwtView } from './JwtView'
import { HashCryptoView } from './HashCryptoView'

/** 计算开发中心：按二级工具 ID 渲染对应视图 */
export const CalcDevCenter: React.FC<{ tool: ToolId }> = ({ tool }) => {
  switch (tool) {
    case 'bmi-calc':
      return <BmiCalcView />
    case 'timestamp-calc':
      return <TimestampCalcView />
    case 'mortgage-calc':
      return <MortgageCalcView />
    case 'interest-calc':
      return <InterestCalcView />
    case 'password-gen':
      return <PasswordGenView />
    case 'json-tools':
      return <JsonToolsView />
    case 'base64':
      return <Base64View />
    case 'url-codec':
      return <UrlCodecView />
    case 'uuid':
      return <UuidView />
    case 'jwt':
      return <JwtView />
    case 'hash-crypto':
      return <HashCryptoView />
    default:
      return null
  }
}
