import { noticeMsgType } from "complex-plugin/src/notice"
import { Data } from "complex-utils"
import config from "../config"

type statusType = {
  [prop: number]: string
}

export type formatUrlType = (url: string) => string

export interface SimpleRequestInitOption {
  baseUrl?: string
  status?: statusType
  formatUrl?: formatUrlType
}

export type methodType = 'get' | 'post' | 'delete' | 'put' | 'patch' | 'head' | 'options'

export type failNoticeOption = {
  check?: boolean
  content?: string
  duration?: number
  type?: noticeMsgType
  title?: string
}

const defaultFormatUrlWithBaseUrl = function(this: SimpleRequest, url: string) {
  if (url.indexOf('https://') !== 0 && url.indexOf('http://') !== 0) {
    // 当前URL不以http/https开始，则认为此URL需要添加默认前缀
    url = this.baseUrl + url
  }
  return url
}
const defaultFormatUrl = function(url: string) {
  return url
}

export interface requestOptionType {
  url: string
  method?: methodType
  head?: Record<PropertyKey, unknown>
  data?: Record<PropertyKey, unknown>
  params?: Record<PropertyKey, unknown>
  // 对最终的数据做格式化处理，此数据为对应请求插件的参数而非Request的参数
  format?: (...args: unknown[]) => void
  currentType?: 'text' | 'json' | 'form'
  targetType?: 'text' | 'json' | 'form'
  response?: {
    type?: 'json' | 'text' | 'blob'
    format?: boolean
  }
  fail?: {
    notice?: boolean | failNoticeOption
  }
  option?: Record<PropertyKey, unknown>
}

export interface requestOptionValueType {
  url: string
  method: methodType
  head: Record<PropertyKey, unknown>
  data: Record<PropertyKey, unknown>
  params: Record<PropertyKey, unknown>
  // 对最终的数据做格式化处理，此数据为对应请求插件的参数而非Request的参数
  format?: (...args: unknown[]) => void
  response: {
    type: 'json' | 'text' | 'blob'
    format: boolean
  }
  fail: {
    notice?: boolean | failNoticeOption
  }
}

abstract class SimpleRequest extends Data{
  static $name = 'SimpleRequest'
  baseUrl?: string
  status: statusType
  formatUrl: formatUrlType
  constructor(initOption: SimpleRequestInitOption) {
    super()
    this.baseUrl = initOption.baseUrl
    this.status = {
      ...config.status,
      ...initOption.status
    }
    this.formatUrl = this._getFormatUrl(initOption.formatUrl)
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
  $parseRequestOption(requestOption: requestOptionType): requestOptionValueType {
    if (!requestOption.method) {
      requestOption.method = 'get'
    }
    if (!requestOption.currentType) {
      requestOption.currentType = 'json'
    }
    if (!requestOption.targetType) {
      requestOption.targetType = 'json'
    }
    if (!requestOption.head) {
      requestOption.head = {}
    }
    if (!requestOption.data) {
      requestOption.data = {}
    }
    if (!requestOption.params) {
      requestOption.params = {}
    }
    if (!requestOption.response) {
      requestOption.response = {}
    }
    if (requestOption.response.type === undefined) {
      requestOption.response.type = 'json'
    }
    if (requestOption.response.format === undefined) {
      requestOption.response.format = true
    }
    if (!requestOption.fail) {
      requestOption.fail = {}
    }
    return requestOption as requestOptionValueType
  }
  request(requestOption: requestOptionType) {
    return new Promise((resolve, reject) => {
      const finalRequestOption = this.$parseRequestOption(requestOption)
      this.$request(finalRequestOption).then(res => {
        this.$format(res, finalRequestOption).then(res => {
          resolve(res)
        }).catch(err => {
          reject(err)
        })
      }).catch(err => {
        reject(err)
      })
    })
  }
  abstract $request(requestOption: requestOptionValueType): Promise<unknown>
  abstract $format(response: unknown, requestOption: requestOptionValueType): Promise<unknown>
  get(requestOption: requestOptionType) {
    requestOption.method = 'get'
    return this.request
  }
  post(requestOption: requestOptionType) {
    requestOption.method = 'post'
    return this.request
  }
  form(requestOption: requestOptionType) {
    requestOption.method = 'post'
    requestOption.currentType = 'form'
    requestOption.targetType = 'form'
    return this.request
  }
  json(requestOption: requestOptionType) {
    requestOption.method = 'post'
    requestOption.currentType = 'json'
    requestOption.targetType = 'form'
    return this.request
  }
}

export default SimpleRequest