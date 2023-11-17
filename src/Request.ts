import SimpleRequest, { SimpleRequestInitOption } from "./SimpleRequest"

export interface RequestInitOption extends SimpleRequestInitOption {

}
abstract class Request extends SimpleRequest{
  static $name = 'Request'
  constructor(initOption: RequestInitOption) {
    super(initOption)
  }
}

export default Request