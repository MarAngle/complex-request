import Rule, { RuleInitOption } from "./Rule"
import SimpleRequest, { SimpleRequestInitOption } from "./SimpleRequest"
import { getEnv } from "complex-utils"

export interface RequestInitOption extends SimpleRequestInitOption {
  rule: RuleInitOption[]
}
abstract class Request extends SimpleRequest{
  static $name = 'Request'
  rule: Record<string, Rule>
  constructor(initOption: RequestInitOption) {
    super(initOption)
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
      if (getEnv('real') === 'development' && config.require.showRule) {
        this.$exportMsg(`默认的请求处理规则为[${this.rule.default!.$selfName()}]`, 'log')
      }
    } else {
      this.$exportMsg(`未获取到默认请求处理规则！`, 'error')
    }
  }
}

export default Request