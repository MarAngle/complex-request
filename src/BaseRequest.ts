import { Data, getEnv, jsonToForm } from "complex-utils"
import { notice } from "complex-plugin"
import { noticeMsgType } from "complex-plugin/src/notice"
import Rule, { RuleInitOption, responseType } from "./Rule"
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

export interface RequestConfig {
  url: string // 请求地址
  method: methodType // 请求方式
  headers: Record<string, undefined | null | string | number | boolean> // Header头
  data: Record<PropertyKey, unknown> | FormData // Body体
  params: Record<PropertyKey, unknown> // query数据
  token: boolean | string[] // Token
  format?: (finalConfig: unknown, rule?: Rule, isRefresh?: boolean) => unknown // 对最终的数据做格式化处理，此数据为对应请求插件的参数而非Request的参数
  currentType: 'json' | 'form' // 当前数据类型
  targetType?: 'json' | 'form' // 目标数据类型=>初始化参数，后期无效
  responseType: 'json' | 'text' | 'blob' // 返回值类型，仅json进行格式化
  responseFormat: boolean // 返回值格式化判断，为否不格式化
  failNotice: false | failNoticeOptionType
  local?: Record<PropertyKey, unknown> // 请求插件的单独参数
}

abstract class BaseRequest extends Data{
  static $name = 'BaseRequest'
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
        this.$exportMsg(`未创建默认请求处理规则！`, 'error')
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
  protected _parseRequestConfig(requestConfig: Partial<RequestConfig>): RequestConfig {
    if (!requestConfig.method) {
      requestConfig.method = 'get'
    }
    if (!requestConfig.headers) {
      requestConfig.headers = config.contentType.data !== undefined ? {
        'Content-Type': config.contentType.data
      } : {}
    } else if (requestConfig.headers['Content-Type'] === undefined && config.contentType.data !== undefined) {
      requestConfig.headers['Content-Type'] = config.contentType.data
    }
    if (requestConfig.currentType === undefined) {
      requestConfig.currentType = 'json'
    }
    const targetType = requestConfig.targetType || 'json'
    if (requestConfig.currentType !== targetType) {
      if (!requestConfig.data) {
        requestConfig.data = targetType === 'form' ? new FormData() : {}
      } else if (requestConfig.currentType === 'json') {
        requestConfig.data = jsonToForm(requestConfig.data)
      } else {
        const data: Record<PropertyKey, unknown> = {};
        (requestConfig.data as FormData).forEach((value, key) => {
          (data as Record<PropertyKey, unknown>)[key] = value
        })
        requestConfig.data = data
      }
      requestConfig.currentType = targetType
    } else {
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
    const finalRequestConfig = this._parseRequestConfig(requestConfig)
    return this._request(finalRequestConfig, this.getRule(finalRequestConfig.url))
  }
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
  protected _request(requestConfig: RequestConfig, rule?: Rule, isRefresh?: boolean): Promise<responseType> {
    if (rule) {
      const res = rule.appendToken(requestConfig)
      if (res) {
        if (res.token) {
          // 存在Token规则但是不存在值，需要调用login接口
          // 此处不应判断是否为重复操作
          return new Promise((resolve, reject) => {
            rule.login().then(() => {
              this._request(requestConfig, rule, isRefresh).then(res => {
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
    }
    return new Promise((resolve, reject) => {
      this.$request(requestConfig, rule, isRefresh).then(response => {
        if (requestConfig.responseFormat && requestConfig.responseType === 'json' && rule) {
          const finalResponse = rule.format(response, requestConfig)
          if (finalResponse.status === 'success') {
            resolve(finalResponse)
          } else if (finalResponse.status === 'login') {
            if (rule && rule.refresh && !isRefresh) {
              // 当前请求提示login说明请求前的token验证通过，此时在第一次需要登陆时进行rule.login的操作，进行可能的刷新Token机制
              // 此刷新机制失败则直接失败，如成功后依然需要登录则按照失败处理
              rule.refresh().then(() => {
                this._request(requestConfig, rule, isRefresh).then(res => {
                  resolve(res)
                }).catch(err => {
                  reject(err)
                })
              })
            } else {
              reject(finalResponse)
            }
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
  abstract $request(requestConfig: RequestConfig, rule?: Rule, isRefresh?: boolean): Promise<unknown>
  abstract $parseError(responseError: unknown): { msg?: string, type: 'request' | 'server', data: unknown }
  get(requestConfig: Partial<RequestConfig>) {
    requestConfig.method = 'get'
    return this.request(requestConfig)
  }
  post(requestConfig: Partial<RequestConfig>) {
    requestConfig.method = 'post'
    return this.request(requestConfig)
  }
  form(requestConfig: Partial<RequestConfig>) {
    requestConfig.method = 'post'
    requestConfig.currentType = 'form'
    requestConfig.targetType = 'form'
    return this.request(requestConfig)
  }
  json(requestConfig: Partial<RequestConfig>) {
    requestConfig.method = 'post'
    requestConfig.currentType = 'json'
    requestConfig.targetType = 'form'
    return this.request(requestConfig)
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

export default BaseRequest