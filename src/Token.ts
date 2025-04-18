import { isExist, storage, appendProp } from 'complex-utils'
import { RequestConfig } from './BaseRequest'

type getValueType = () => unknown
type removeValueType = getValueType
type clearType = getValueType
type isExistType = (data: unknown) => boolean
type destroyType = clearType

export type locationType = 'body' | 'header' | 'params'

export interface TokenInitOption {
  value?: unknown
  require?: boolean // 是否必选，必选则会在isExist返回不存在时失败，可能触发rule.login
  location?: locationType // 位置
  time?: number // 本地缓存有效期
  session?: boolean // 本地缓存是否为session
  getValue?: getValueType // 获取value函数实现，如存在此函数则不会直接从value中取值
  isExist?: isExistType // 判断数据是否存在，用户require判断和缓存获取判断
  clear?: clearType // 清除数据
  destroy?: destroyType // 销毁数据/会先触发清除数据
}

function setValue(this: Token, data: unknown, unSave?: boolean) {
  this.value = data
  if (!unSave) {
    storage.setData(this.prop, data)
  }
}

function setValueBySession(this: Token, data: unknown, unSave?: boolean) {
  this.value = data
  if (!unSave) {
    storage.setSessionData(this.prop, data)
  }
}

function getValue(this: Token) {
  let data = this.$getValue!()
  if (!this.isExist(data)) {
    data = storage.getData(this.prop, this.time)
    if (this.isExist(data)) {
      this.setValue(data, true)
    }
  }
  return data
}

function getValueBySession(this: Token) {
  let data = this.$getValue!()
  if (!this.isExist(data)) {
    data = storage.getSessionData(this.prop, this.time)
    if (this.isExist(data)) {
      this.setValue(data, true)
    }
  }
  return data
}

function getValueFromValue(this: Token) {
  let data = this.value
  if (!this.isExist(data)) {
    data = storage.getData(this.prop, this.time)
    if (this.isExist(data)) {
      this.setValue(data, true)
    }
  }
  return data
}

function getValueFromValueBySession(this: Token) {
  let data = this.value
  if (!this.isExist(data)) {
    data = storage.getSessionData(this.prop, this.time)
    if (this.isExist(data)) {
      this.setValue(data, true)
    }
  }
  return data
}

function removeValue(this: Token) {
  storage.removeData(this.prop)
  this.value = undefined
}

function removeValueBySession(this: Token) {
  storage.removeSessionData(this.prop)
  this.value = undefined
}

class Token {
  static $name = 'Token'
  prop: string
  require?: boolean
  value?: unknown
  location: locationType
  time?: number
  isExist: isExistType
  setValue: (data: unknown, unSave?: boolean) => void
  $getValue?: getValueType
  getValue: getValueType
  removeValue: removeValueType
  $destroy?: destroyType
  $clear?: clearType
  constructor(initOption: TokenInitOption, prop: string, ruleProp: string, time?: number, session?: boolean) {
    this.prop = `require-${prop}-${ruleProp}`
    if (initOption.require !== undefined) {
      this.require = initOption.require
    }
    if (initOption.value !== undefined) {
      this.value = initOption.value
    }
    this.location = initOption.location || 'body'
    if (initOption.time === undefined) {
      if (time !== undefined) {
        this.time = time
      }
    } else {
      this.time = initOption.time
    }
    if (initOption.session != undefined) {
      session = initOption.session
    }
    this.isExist = initOption.isExist || isExist
    this.setValue = !session ? setValue : setValueBySession
    if (initOption.getValue) {
      this.$getValue = initOption.getValue
      this.getValue = !session ? getValue : getValueBySession
    } else {
      this.getValue = !session ? getValueFromValue : getValueFromValueBySession
    }
    this.removeValue = !session ? removeValue : removeValueBySession
    this.$clear = initOption.clear
    this.$destroy = initOption.destroy
  }
  $appendValue(requestConfig: RequestConfig<any, any>, tokenName: string) {
    const value = this.getValue()
    if (this.$checkValue(value)) {
      const location = this.location
      if (location === 'body') {
        appendProp(requestConfig.data as Record<PropertyKey, unknown>, tokenName, value, requestConfig.currentType as 'json')
      } else if (location === 'header') {
        requestConfig.headers[tokenName] = value as string
      } else if (location === 'params') {
        requestConfig.params[tokenName] = value
      }
      return true
    } else {
      return false
    }
  }
  $checkValue(data: unknown) {
    if (this.require && !this.isExist(data)) {
      // 数据必选且不存在时返回失败
      return false
    }
    return true
  }
  clear() {
    this.removeValue()
    if (this.$clear) {
      this.$clear()
    }
  }
  destroy() {
    this.clear()
    if (this.$destroy) {
      this.$destroy()
    }
  }
}

export default Token
