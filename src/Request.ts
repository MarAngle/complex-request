import { Data, getEnv } from "complex-utils"
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

export type failNoticeOption = {
  check?: boolean
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
  failNotice?: failNoticeOption
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
    return requestConfig as RequestConfig
  }
  request(requestConfig: Partial<RequestConfig>) {
    return new Promise((resolve, reject) => {
      const finalRequestConfig = this.$parseRequestConfig(requestConfig)
      this.$request(finalRequestConfig).then(res => {
        this.$format(res, finalRequestConfig).then(res => {
          resolve(res)
        }).catch(err => {
          reject(err)
        })
      }).catch(err => {
        reject(err)
      })
    })
  }
  abstract $request(requestConfig: RequestConfig): Promise<unknown>
  abstract $format(response: unknown, requestConfig: RequestConfig): Promise<unknown>
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
}

export default Request