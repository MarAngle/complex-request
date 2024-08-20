import { _Data, jsonToForm } from "complex-utils"
import { notice } from "complex-plugin"
import { messageType } from "complex-plugin/src/notice"
import Rule, { RuleInitOption, responseType } from "./Rule"
import config from "../config"

type statusType = {
  [prop: number]: string
}

export type formatUrlType = (url: string) => string

export interface RequestInitOption<R = Record<PropertyKey, unknown>> {
  baseUrl?: string
  status?: statusType
  formatUrl?: formatUrlType
  rule: RuleInitOption<R>
}

export type methodType = 'get' | 'post' | 'delete' | 'put' | 'patch' | 'head' | 'options'

export type failNoticeOptionType = {
  local?: boolean
  content?: string
  duration?: number
  type?: messageType
  title?: string
}

const defaultFormatUrlWithBaseUrl = function(this: BaseRequest, url: string) {
  if (url.indexOf('https://') !== 0 && url.indexOf('http://') !== 0) {
    // 当前URL不以http/https开始，则认为此URL需要添加默认前缀
    url = this.baseUrl + url
  }
  return url
}
const defaultFormatUrl = function(url: string) {
  return url
}

export type requestTrigger = 'login' | 'refresh'

export interface RequestConfig<_R = Record<PropertyKey, unknown>, L = Record<PropertyKey, unknown>> {
  url: string // 请求地址
  method: methodType // 请求方式
  headers: Record<string, undefined | null | string | number | boolean> // Header头
  data: Record<PropertyKey, unknown> | FormData // Body体
  params: Record<PropertyKey, unknown> // query数据
  token: boolean | string[] // Token
  format?: (finalConfig: unknown, trigger?: requestTrigger) => unknown // 对最终的数据做格式化处理，此数据为对应请求插件的参数而非Request的参数
  currentType: 'json' | 'form' // 当前数据类型
  targetType?: 'json' | 'form' // 目标数据类型=>初始化参数，后期无效
  responseType: 'json' | 'text' | 'blob' // 返回值类型，仅json进行格式化
  responseParse: boolean // 返回值解析判断，为否不解析
  failNotice: false | failNoticeOptionType
  local?: L // 请求插件的单独参数
}

abstract class BaseRequest<R = Record<PropertyKey, unknown>, L = Record<PropertyKey, unknown>> extends _Data{
  static $name = 'BaseRequest'
  static $formatConfig = { name: 'Request:BaseRequest', level: 5, recommend: false }
  baseUrl?: string
  isLogining?: Promise<any>
  isRefreshing?: Promise<any>
  status: statusType
  formatUrl: formatUrlType
  rule: Rule<R, L>
  constructor(initOption: RequestInitOption<R>) {
    super()
    this.baseUrl = initOption.baseUrl
    this.status = {
      ...config.status,
      ...initOption.status
    }
    this.formatUrl = this._getFormatUrl(initOption.formatUrl)
    this.rule = new Rule(initOption.rule)
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
  protected _syncFormatUrl() {
    // 当前格式化URL函数为默认函数时则进行重新获取操作
    if (this.formatUrl === defaultFormatUrlWithBaseUrl || this.formatUrl === defaultFormatUrl) {
      this.formatUrl = this._getFormatUrl()
    }
  }
  changeBaseUrl(baseUrl: string) {
    this.baseUrl = baseUrl || ''
    this._syncFormatUrl()
  }
  protected _parseRequestConfig(requestConfig: Partial<RequestConfig<R, L>>): RequestConfig<R, L> {
    requestConfig.url = this.formatUrl(requestConfig.url!)
    if (!requestConfig.method) {
      requestConfig.method = 'get'
    }
    if (!requestConfig.headers) {
      requestConfig.headers = config.contentType.data != undefined ? {
        'Content-Type': config.contentType.data
      } : {}
    } else if (requestConfig.headers['Content-Type'] == undefined && config.contentType.data != undefined) {
      requestConfig.headers['Content-Type'] = config.contentType.data
    }
    if (requestConfig.currentType == undefined) {
      requestConfig.currentType = 'json'
    }
    const targetType = requestConfig.targetType || 'json'
    if (!requestConfig.data) {
      requestConfig.data = targetType === 'form' ? new FormData() : {}
    } else if (requestConfig.currentType !== targetType) {
      if (requestConfig.currentType === 'json') {
        requestConfig.data = jsonToForm(requestConfig.data)
      } else {
        const data: Record<PropertyKey, unknown> = {};
        (requestConfig.data as FormData).forEach((value, key) => {
          (data as Record<PropertyKey, unknown>)[key] = value
        })
        requestConfig.data = data
      }
    }
    requestConfig.currentType = targetType
    if (requestConfig.token == undefined) {
      requestConfig.token = true
    }
    if (!requestConfig.params) {
      requestConfig.params = {}
    }
    if (requestConfig.responseType == undefined) {
      requestConfig.responseType = 'json'
    }
    if (requestConfig.responseParse == undefined) {
      requestConfig.responseParse = true
    }
    if (requestConfig.failNotice == undefined) {
      requestConfig.failNotice = {}
    }
    return requestConfig as RequestConfig<R, L>
  }
  request(requestConfig: Partial<RequestConfig<R, L>>) {
    return this._request(this._parseRequestConfig(requestConfig))
  }
  protected _showFailNotice(isLocal: boolean, failNotice: false | failNoticeOptionType, title: string, msg?: string) {
    if (failNotice !== false) {
      if (failNotice.local === false && isLocal) {
        return
      }
      const content = failNotice.content || msg
      if (content) {
        notice.message(content, failNotice.type, failNotice.title || title, failNotice.duration)
      }
    }
  }
  protected _request(requestConfig: RequestConfig<R, L>, trigger?: requestTrigger): Promise<responseType> {
    const res = this.rule.$appendToken(requestConfig)
    if (res) {
      if (res.token) {
        // 存在Token规则但是不存在值，需要调用login接口
        // 此处不应判断是否为重复操作
        return new Promise((resolve, reject) => {
          this.rule.login('token').then(() => {
            this._request(requestConfig, 'login').then(res => {
              resolve(res)
            }).catch(err => {
              reject(err)
            })
          }).catch(err => {
            reject(err)
          })
        })
      } else {
        const msg = `${res.prop}对应的Token规则不存在！`
        this.$exportMsg(msg)
        this._showFailNotice(true, requestConfig.failNotice, '请求终止', msg)
        return Promise.reject({ status: 'fail', code: 'token absent' })
      }
    }
    return new Promise((resolve, reject) => {
      this.$request(requestConfig, trigger).then(response => {
        if (requestConfig.responseParse && requestConfig.responseType === 'json') {
          const finalResponse = this.rule.parse(response, requestConfig)
          if (finalResponse.status === 'success') {
            resolve(finalResponse)
          } else if (finalResponse.status === 'refresh') {
            if (this.rule.refresh && trigger !== 'refresh') {
              // 当前请求提示login说明请求前的token验证通过
              // 此时在第一次需要登陆时进行this.rule.refresh的操作，进行可能的刷新Token机制
              // 此刷新机制失败则触发登录
              // 如登录后依然需要登录则按照失败处理(此处的登录可能是由本地token验证失败触发的登录)
              if (!this.isRefreshing) {
                this.isRefreshing = this.rule.refresh()
              }
              this.isRefreshing.then(() => {
                this._request(requestConfig, 'refresh').then(res => {
                  this.isRefreshing = undefined
                  resolve(res)
                }).catch(err => {
                  this.isRefreshing = undefined
                  reject(err)
                })
              })
            } else if (trigger !== 'login') {
              if (!this.isLogining) {
                this.isLogining = this.rule.login('refresh')
              }
              this.isLogining.then(() => {
                this._request(requestConfig, 'login').then(res => {
                  this.isLogining = undefined
                  resolve(res)
                }).catch(err => {
                  this.isLogining = undefined
                  reject(err)
                })
              }).catch(err => {
                reject(err)
              })
            } else {
              reject(finalResponse)
            }
          } else if (finalResponse.status === 'login') {
            if (!this.isLogining) {
              this.isLogining = this.rule.login('login')
            }
            this.isLogining.then(() => {
              this._request(requestConfig, 'login').then(res => {
                this.isLogining = undefined
                resolve(res)
              }).catch(err => {
                this.isLogining = undefined
                reject(err)
              })
            }).catch(err => {
              reject(err)
            })
          } else if (finalResponse.status === 'fail') {
            this._showFailNotice(false, requestConfig.failNotice, '请求失败', finalResponse.msg)
            reject(finalResponse)
          }
        } else {
          resolve({
            status: 'success',
            code: 'origin',
            data: response
          })
        }
      }).catch(error => {
        const err = this.$parseError(error)
        this._showFailNotice(true, requestConfig.failNotice, err.type === 'request' ? '请求终止' : '请求错误', err.msg || config.fail[err.type])
        reject({ status: 'fail', code: err.type + ' error', err: error })
      })
    })
  }
  // 重要: requestConfig需要深拷贝到具体实例中而非直接引用，此处保证在login/refresh时的requestConfig保持一致
  abstract $request(requestConfig: RequestConfig<R, L>, from?: requestTrigger): Promise<R>
  abstract $parseError(responseError: unknown): { msg?: string, type: 'request' | 'server', data: unknown }
  get(requestConfig: Partial<RequestConfig<R, L>>) {
    requestConfig.method = 'get'
    return this.request(requestConfig)
  }
  post(requestConfig: Partial<RequestConfig<R, L>>) {
    requestConfig.method = 'post'
    return this.request(requestConfig)
  }
  form(requestConfig: Partial<RequestConfig<R, L>>) {
    requestConfig.method = 'post'
    requestConfig.currentType = 'form'
    requestConfig.targetType = 'form'
    return this.request(requestConfig)
  }
  json(requestConfig: Partial<RequestConfig<R, L>>) {
    requestConfig.method = 'post'
    requestConfig.currentType = 'json'
    requestConfig.targetType = 'form'
    return this.request(requestConfig)
  }
  setToken(tokenName: string, value: unknown, unSave?: boolean) {
    this.rule.setToken(tokenName, value, unSave)
  }
  getToken(tokenName: string) {
    return this.rule.getToken(tokenName)
  }
  clearToken(tokenName: string | true) {
    return this.rule.clearToken(tokenName)
  }
  destroyToken(tokenName: string | true) {
    return this.rule.destroyToken(tokenName)
  }
  setRefreshToken(value: unknown, unSave?: boolean) {
    this.rule.setRefreshToken(value, unSave)
  }
  getRefreshToken() {
    return this.rule.getRefreshToken()
  }
  clearRefreshToken() {
    return this.rule.clearRefreshToken()
  }
  destroyRefreshToken() {
    return this.rule.destroyRefreshToken()
  }
}

export default BaseRequest