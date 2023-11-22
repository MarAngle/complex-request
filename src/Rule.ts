import { Data } from "complex-utils"
import Token, { TokenInitOption } from "./Token"
import { RequestConfig } from "./Request"

export type tokenType = {
  time?: number
  session?: boolean
  data?: Record<string, TokenInitOption>
}

export interface responseType<D = unknown> {
  status: 'success' | 'fail' | 'login'
  data: D
  msg?: string
  code?: number | string
}

type checkType = (url: string) => boolean
type formatType = (response: unknown, requestConfig: RequestConfig) => responseType
type formatUrlType = (url: string) => string

export interface RuleInitOption {
  prop: string
  token?: tokenType
  check: checkType
  format: formatType
  formatUrl?: formatUrlType
}

function defaultFormatUrl(url: string) {
  return url
}


class Rule extends Data{
  static $name = 'Rule'
  prop: string
  token: Record<string, Token>
  check: checkType
  format: formatType
  formatUrl: formatUrlType
  constructor(initOption: RuleInitOption) {
    super()
    this.prop = initOption.prop
    this.token = {}
    if (initOption.token && initOption.token.data) {
      for (const tokenName in initOption.token.data) {
        this.token[tokenName] = new Token(initOption.token.data[tokenName], tokenName, this.prop, initOption.token.time, initOption.token.session)
      }
    }
    this.check = initOption.check
    this.format = initOption.format
    this.formatUrl = initOption.formatUrl || defaultFormatUrl
  }
  appendToken(requestConfig: RequestConfig) {
    const tokenList = requestConfig.token === true ? Object.keys(this.token) : requestConfig.token
    if (tokenList) {
      for (let i = 0; i < tokenList.length; i++) {
        const tokenName = tokenList[i]
        const token = this.token[tokenName]
        if (token) {
          if (!token.appendValue(requestConfig, tokenName)) {
            return {
              prop: tokenName,
              token: true,
              value: false
            }
          }
        } else {
          return {
            prop: tokenName,
            token: false
          }
        }
      }
    } else {
      return
    }
  }
  $getName() {
    return `${this.$getConstructorName()}:${this.prop}`
  }
}

export default Rule