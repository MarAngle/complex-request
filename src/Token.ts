import { isExist, setLocalData, getLocalData, removeLocalData, setSessionLocalData, getSessionLocalData, removeSessionLocalData, appendProp } from 'complex-utils'
import { RequestConfig } from './Request'

type getValueType = () => unknown
type removeValueType = getValueType
type clearType = getValueType

type checkType = (data: unknown) => boolean
type destroyType = clearType

export type locationType = 'body' | 'header' | 'params'

export interface TokenInitOption {
  value?: unknown
  require?: boolean
  location?: locationType
  empty?: boolean
  time?: number
  session?: boolean
  getValue?: getValueType
  isExist?: checkType
  checkValue?: checkType
  clear?: clearType
  destroy?: destroyType
}

function setValue(this: Token, data: unknown, noSave?: boolean) {
  this.value = data
  if (!noSave) {
    setLocalData(this.prop, data)
  }
}

function setValueBySession(this: Token, data: unknown, noSave?: boolean) {
  this.value = data
  if (!noSave) {
    setSessionLocalData(this.prop, data)
  }
}

function getValue(this: Token) {
  let data = this.$getValue!()
  if (!this.isExist(data)) {
    data = getLocalData(this.prop, this.time)
    if (this.isExist(data)) {
      this.setValue(data, true)
    }
  }
  return data
}
function getValueBySession(this: Token) {
  let data = this.$getValue!()
  if (!this.isExist(data)) {
    data = getSessionLocalData(this.prop, this.time)
    if (this.isExist(data)) {
      this.setValue(data, true)
    }
  }
  return data
}
function getValueByData(this: Token) {
  let data = this.value
  if (!this.isExist(data)) {
    data = getLocalData(this.prop, this.time)
    if (this.isExist(data)) {
      this.setValue(data, true)
    }
  }
  return data
}
function getValueByDataBySession(this: Token) {
  let data = this.value
  if (!this.isExist(data)) {
    data = getSessionLocalData(this.prop, this.time)
    if (this.isExist(data)) {
      this.setValue(data, true)
    }
  }
  return data
}

function removeValue(this: Token) {
  removeLocalData(this.prop)
  this.value = undefined
}
function removeValueBySession(this: Token) {
  removeSessionLocalData(this.prop)
  this.value = undefined
}

class Token {
  static $name = 'Token'
  prop: string
  require?: boolean
  value: unknown
  location: locationType
  time: undefined | number
  isExist: checkType
  setValue: (data: unknown, noSave?: boolean) => void
  $getValue?: getValueType
  getValue: getValueType
  removeValue: removeValueType
  $destroy?: destroyType
  $clear?: clearType
  constructor(initOption: TokenInitOption, prop: string, ruleProp: string, time?: number, session?: boolean) {
    this.prop = `require-${prop}-${ruleProp}`
    this.require = initOption.require
    this.value = initOption.value || undefined
    this.location = initOption.location || 'body'
    this.time = initOption.time === undefined ? time : initOption.time
    if (initOption.session !== undefined) {
      session = initOption.session
    }
    this.isExist = initOption.isExist || isExist
    this.setValue = !session ? setValue : setValueBySession
    if (initOption.getValue) {
      this.$getValue = initOption.getValue
      this.getValue = !session ? getValue : getValueBySession
    } else {
      this.getValue = !session ? getValueByData : getValueByDataBySession
    }
    this.removeValue = !session ? removeValue : removeValueBySession
    this.$clear = initOption.clear
    this.$destroy = initOption.destroy
  }
  appendValue(requestConfig: RequestConfig, tokenName: string) {
    const value = this.getValue()
    if (this.checkValue(value)) {
      const location = this.location
      if (location === 'body') {
        appendProp(requestConfig.data, tokenName, value, requestConfig.currentType)
      } else if (location === 'header') {
        requestConfig.headers[tokenName] = value
      } else if (location === 'params') {
        requestConfig.params[tokenName] = value
      }
      return true
    } else {
      return false
    }
  }
  checkValue(data: unknown) {
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
    this.removeValue()
    if (this.$destroy) {
      this.$destroy()
    }
  }
}

export default Token
