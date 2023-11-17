import { Data } from "complex-utils"
import config from "../config"

type checkType = (url: string) => boolean

type formatType = (response: unknown) => unknown
type formatUrlType = (url: string) => string

export interface RuleInitOption {
  prop: string
  check: checkType
  format?: formatType
  formatUrl?: formatUrlType
}

function defaultFormatUrl(url: string) {
  return url
}

class Rule extends Data{
  static $name = 'Rule'
  prop: string
  check: checkType
  format?: formatType
  formatUrl: formatUrlType
  constructor(initOption: RuleInitOption) {
    super()
    this.prop = initOption.prop
    this.check = initOption.check
    this.format = initOption.format
    this.formatUrl = initOption.formatUrl || defaultFormatUrl
  }
}

export default Rule