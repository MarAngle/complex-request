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
  code?: number | string
  msg?: string
  err?: string | Error | Record<PropertyKey, unknown>
}

type checkType = (url: string) => boolean
type formatType = (response: unknown, requestConfig: RequestConfig) => responseType
type formatUrlType = (url: string) => string
type loginType = () => Promise<unknown>
type refreshType = () => Promise<unknown>

export interface RuleInitOption {
  prop: string
  token?: tokenType
  check: checkType // 校验是否是对应Rule
  format: formatType // 格式化返回参数
  login: loginType // 登录操作，触发于token本地验证失败时
  refresh: refreshType // 刷新操作，触发于请求提示login时
  formatUrl?: formatUrlType // 格式化对应URL
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
  login: loginType
  refresh: refreshType
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
    this.login = initOption.login
    this.refresh = initOption.refresh
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
  setToken(tokenName: string, value: unknown, unSave?: boolean) {
    if (this.token[tokenName]) {
      this.token[tokenName].setValue(value, unSave)
    } else {
      this.$exportMsg(`未找到${tokenName}对应的Token规则,setToken失败！`, 'error')
    }
  }
  getToken (tokenName: string) {
    if (this.token[tokenName]) {
      return this.token[tokenName].getValue()
    } else {
      this.$exportMsg(`未找到${tokenName}对应的Token规则,getToken失败！`, 'error')
    }
  }
  clearToken(tokenName: true | string) {
    if (tokenName) {
      if (tokenName === true) {
        for (const n in this.token) {
          this._clearToken(n)
        }
        return true
      } else {
        return this._clearToken(tokenName)
      }
    } else {
      this.$exportMsg(`未指定需要清除的token！`)
      return false
    }
  }
  protected _clearToken (tokenName: string) {
    if (this.token[tokenName]) {
      this.token[tokenName].clear()
      return true
    } else {
      this.$exportMsg(`未找到${tokenName}对应的token规则,clearToken失败！`, 'warn')
      return false
    }
  }
  destroyToken (tokenName: true | string) {
    if (tokenName) {
      if (tokenName === true) {
        for (const n in this.token) {
          this._destroyToken(n)
        }
        return true
      } else {
        return this._destroyToken(tokenName)
      }
    } else {
      this.$exportMsg(`未指定需要销毁的token！`)
      return false
    }
  }
  protected _destroyToken (tokenName: string) {
    if (this.token[tokenName]) {
      this.token[tokenName].destroy()
      delete this.token[tokenName]
      return true
    } else {
      this.$exportMsg(`未找到${tokenName}对应的token规则,destroyToken失败！`, 'warn')
      return false
    }
  }
  $getName() {
    return `${this.$getConstructorName()}:${this.prop}`
  }
}

export default Rule