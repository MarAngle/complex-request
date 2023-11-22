const config = {
  showRule: true,
  status: {
    403: '拒绝访问！',
    404: '很抱歉，资源未找到！',
    405: '请求方法不支持！',
    504: '网络超时！'
  },
  contentType: {
    data: undefined,
    form: 'multipart/form-data'
  }
}

export default config
