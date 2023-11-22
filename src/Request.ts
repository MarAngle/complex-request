import { Data, getEnv } from "complex-utils"
import { notice } from "complex-plugin"
import { noticeMsgType } from "complex-plugin/src/notice"
import Rule, { RuleInitOption } from "./Rule"
import config from "../config"

type statusType = {
  [prop: number]: string
}

export type formatUrlType = (url: string) => string

export interface RequestInitOption {
  baseUrl?: string
  status?: statusType
  formatUrl?: formatUrlType
  rule?: RuleInitOption[]
}

export type methodType = 'get' | 'post' | 'delete' | 'put' | 'patch' | 'head' | 'options'

export type failNoticeOptionType = {
  local?: boolean
  content?: string
  duration?: number
  type?: noticeMsgType
  title?: string
}

const defaultFormatUrlWithBaseUrl = function(this: Request, url: string) {
  if (url.indexOf('https://') !== 0 && url.indexOf('http://') !== 0) {
    // 当前URL不以http/https开始，则认为此URL需要添加默认前缀
    url = this.baseUrl + url
  }
  return url
}
const defaultFormatUrl = function(url: string) {
  return url
}

export interface RequestConfig {
  url: string
  method: methodType
  headers: Record<PropertyKey, unknown>
  data: Record<PropertyKey, unknown> | FormData
  params: Record<PropertyKey, unknown>
  token: boolean | string[]
  // 对最终的数据做格式化处理，此数据为对应请求插件的参数而非Request的参数
  format?: (...args: unknown[]) => void
  currentType: 'json' | 'form'
  targetType: 'json' | 'form'
  responseType: 'json' | 'text' | 'blob'
  responseFormat: boolean
  failNotice: false | failNoticeOptionType
}

abstract class Request extends Data{
  static $name = 'Request'
  baseUrl?: string
  status: statusType
  formatUrl: formatUrlType
  rule?: Record<string, Rule>
  constructor(initOption: RequestInitOption) {
    super()
    this.baseUrl = initOption.baseUrl
    this.status = {
      ...config.status,
      ...initOption.status
    }
    this.formatUrl = this._getFormatUrl(initOption.formatUrl)
    if (initOption.rule) {
      this.rule = {}
      let defaultProp: undefined | string = undefined
      for (let i = 0; i < initOption.rule.length; i++) {
        const ruleInitOption = initOption.rule[i]
        this.rule[ruleInitOption.prop] = new Rule(ruleInitOption)
        if (i === 0) {
          defaultProp = ruleInitOption.prop
        }
      }
      if (defaultProp !== undefined) {
        if (!this.rule.default) {
          this.rule.default = this.rule[defaultProp]
        }
        if (getEnv('real') === 'development' && config.showRule) {
          this.$exportMsg(`默认的请求处理规则为[${this.rule.default!.$getName()}]`, 'log')
        }
      } else {
        this.$exportMsg(`未获取到默认请求处理规则！`, 'error')
      }
    }
  }
  getRule(url: string) {
    if (this.rule) {
      for (const prop in this.rule) {
        if (this.rule[prop].check(url)) {
          return this.rule[prop]
        }
      }
      return this.rule.default
    }
  }
  protected _getFormatUrl(formatUrl?: formatUrlType) {
    if (formatUrl) {
      return formatUrl
    } else if (this.baseUrl) {
      return defaultFormatUrlWithBaseUrl
    } else {
      return defaultFormatUrl
    }
  }
  $parseRequestConfig(requestConfig: Partial<RequestConfig>): RequestConfig {
    if (!requestConfig.method) {
      requestConfig.method = 'get'
    }
    if (requestConfig.currentType === undefined) {
      requestConfig.currentType = 'json'
    }
    if (requestConfig.targetType === undefined) {
      requestConfig.targetType = 'json'
    }
    if (!requestConfig.headers) {
      requestConfig.headers = {}
    }
    if (!requestConfig.data) {
      requestConfig.data = requestConfig.currentType === 'form' ? new FormData() : {}
    }
    if (requestConfig.token === undefined) {
      requestConfig.token = true
    }
    if (!requestConfig.params) {
      requestConfig.params = {}
    }
    if (requestConfig.responseType === undefined) {
      requestConfig.responseType = 'json'
    }
    if (requestConfig.responseFormat === undefined) {
      requestConfig.responseFormat = true
    }
    if (requestConfig.failNotice === undefined) {
      requestConfig.failNotice = {}
    }
    return requestConfig as RequestConfig
  }
  request(requestConfig: Partial<RequestConfig>) {
    return new Promise((resolve, reject) => {
      const finalRequestConfig = this.$parseRequestConfig(requestConfig)
      const rule = this.getRule(finalRequestConfig.url)
      this._request(finalRequestConfig, rule).then(response => {
        if (finalRequestConfig.responseFormat && rule) {
          const finalResponse = rule.format(response, finalRequestConfig)
          if (finalResponse.status === 'success') {
            resolve(finalResponse)
          } else if (finalResponse.status === 'login') {
            // 此处考虑登录逻辑处理
            reject(finalResponse)
          } else if (finalResponse.status === 'fail') {
            this._showFailNotice(false, finalRequestConfig.failNotice, '请求失败', finalResponse.msg)
            reject(finalResponse)
          }
        } else {
          resolve({
            status: 'success',
            code: 'origin',
            data: response
          })
        }
      }).catch(err => {
        this._showFailNotice(true, finalRequestConfig.failNotice, '请求错误', this.$parseError(err, this.status))
        reject(err)
      })
    })
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected _showFailNotice(isLocal: boolean, failNotice: false | failNoticeOptionType, title: string, msg?: string) {
    if (failNotice !== false) {
      if (failNotice.local === false && isLocal) {
        return
      }
      const content = failNotice.content || msg
      if (content) {
        notice.showMsg(content, failNotice.type, failNotice.title || title, failNotice.duration)
      }
    }
  }
  protected _request(requestConfig: RequestConfig, rule?: Rule) {
    if (rule) {
      const res = rule.appendToken(requestConfig)
      if (res) {
        if (res.token) {
          this.$exportMsg(`${res.prop}对应的Token值不存在！`)
          // 此处考虑刷新Token的机制以及登陆机制
          // ---！！！
          return Promise.reject({ status: 'fail', code: 'token value absent' })
        } else {
          this.$exportMsg(`${res.prop}对应的Token规则不存在！`)
          return Promise.reject({ status: 'fail', code: 'token absent' })
        }
      }
    }
    return this.$request(requestConfig, rule)
  }
  abstract $request(requestConfig: RequestConfig, rule?: Rule): Promise<unknown>
  abstract $parseError(responseError: unknown, status: statusType): string
  get(requestConfig: Partial<RequestConfig>) {
    requestConfig.method = 'get'
    return this.request
  }
  post(requestConfig: Partial<RequestConfig>) {
    requestConfig.method = 'post'
    return this.request
  }
  form(requestConfig: Partial<RequestConfig>) {
    requestConfig.method = 'post'
    requestConfig.currentType = 'form'
    requestConfig.targetType = 'form'
    return this.request
  }
  json(requestConfig: Partial<RequestConfig>) {
    requestConfig.method = 'post'
    requestConfig.currentType = 'json'
    requestConfig.targetType = 'form'
    return this.request
  }
  setToken(tokenName: string, value: unknown, ruleName = 'default', unSave?: boolean) {
    if (this.rule) {
      if (this.rule[ruleName]) {
        this.rule[ruleName].setToken(tokenName, value, unSave)
      } else {
        this.$exportMsg(`未找到${ruleName}对应的Rule处理规则，setToken:${tokenName}操作失败！`)
      }
    } else {
      this.$exportMsg(`未加载Rule处理规则，setToken:${tokenName}操作失败！`)
    }
  }
  getToken (tokenName: string, prop = 'default') {
    if (this.rule) {
      if (this.rule[prop]) {
        return this.rule[prop].getToken(tokenName)
      } else {
        this.$exportMsg(`未找到${prop}对应的Rule处理规则，getToken:${tokenName}操作失败！`)
        return false
      }
    } else {
      this.$exportMsg(`未加载Rule处理规则，getToken:${tokenName}操作失败！`)
    }
  }
  clearToken (tokenName: string | true, prop = 'default') {
    if (this.rule) {
      if (this.rule[prop]) {
        return this.rule[prop].clearToken(tokenName)
      } else {
        this.$exportMsg(`未找到${prop}对应的处理规则，clearToken:${tokenName}操作失败！`)
        return false
      }
    } else {
      this.$exportMsg(`未加载Rule处理规则，clearToken:${tokenName}操作失败！`)
    }
  }
  destroyToken (tokenName: string | true, prop = 'default') {
    if (this.rule) {
      if (this.rule[prop]) {
        return this.rule[prop].destroyToken(tokenName)
      } else {
        this.$exportMsg(`未找到${prop}对应的处理规则，destroyToken:${tokenName}操作失败！`)
        return false
      }
    } else {
      this.$exportMsg(`未加载Rule处理规则，destroyToken:${tokenName}操作失败！`)
    }
  }
  clearAllToken() {
    for (const prop in this.rule) {
      const ruleItem = this.rule[prop]
      ruleItem.clearToken(true)
    }
  }
  destroyAllToken() {
    for (const prop in this.rule) {
      const ruleItem = this.rule[prop]
      ruleItem.destroyToken(true)
    }
  }
}

export default Request