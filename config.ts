const config = {
  showRule: true,
  status: {
    400: '错误请求！',
    403: '拒绝访问！',
    404: '很抱歉，资源未找到！',
    405: '请求方法不支持！',
    408: '请求超时！',
    410: '请求资源已删除！',
    500: '服务器内部错误！',
    502: '错误网关！',
    503: '服务不可用！',
    504: '网关超时！',
    505: 'HTTP版本不受支持！'
  },
  contentType: {
    data: undefined,
    form: 'multipart/form-data'
  }
}

export default config
