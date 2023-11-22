import { Data } from "complex-utils"
import Token, { TokenInitOption } from "./Token"
import { RequestConfig } from "./Request"

export type tokenType = {
  time?: number
  session?: boolean
  data?: Record<string, TokenInitOption>
}

type checkType = (url: string) => boolean
type formatType = (response: unknown) => unknown
type formatUrlType = (url: string) => string

export interface RuleInitOption {
  prop: string
  token?: tokenType
  check: checkType
  format?: formatType
  formatUrl?: formatUrlType
}

function defaultFormatUrl(url: string) {
  return url
}

export interface responseType<D = unknown> {
  status: 'success' | 'fail' | 'login'
  data: D
  msg?: string
  code?: number | string
}

class Rule extends Data{
  static $name = 'Rule'
  prop: string
  token: Record<string, Token>
  check: checkType
  format?: formatType
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
            this.$exportMsg(`${tokenName}对应的Token值不存在！`)
            return 'token value absent'
          }
        } else {
          this.$exportMsg(`${tokenName}对应的Token规则不存在！`)
          return 'token absent'
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