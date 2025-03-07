### ToDo
- 刷新Token实现

### 0.6.2
- 基于AI优化代码

### 0.6.1
- 稳定版

### 0.5.10
- complex-plugin版本升级，逻辑优化

### 0.5.8/9
- complex-plugin版本升级

### 0.5.6/7
- failNotice => fail
- failNotice.local => fail.intercept
- $parseError返回的type类型优化
- config配置项迁移到类静态数据中

### 0.5.5
- 优化类型传递

### 0.5.4
- refreshToken的数据保存

### 0.5.2/3
- rule.login添加trigger参数，确认登录触发来源
- _request替换isRefresh为trigger参数，实现判断请求是否来自于refresh/login成功后的回调
- responseType.status添加refresh状态
- responseType.status === 'refresh'时认为需要刷新token，调用refresh进行token刷新，刷新成功后重新请求再次触发refresh则直接调用login进行登录
- responseType.status === 'login'时直接调用login进行登录

### 0.5.1
- complex-plugin版本升级

### 0.4.4/5/6/7
- complex-plugin版本升级

### 0.4.1/2/3
- BaseRequest的rule简化为单选，简化判断逻辑，需要多个rule可生成多个BaseRequest实例单独实现

### 0.3.6
- 优化undefined校验

### 0.3.5
- responseFormat=>responseParse
- Rule的原format函数更改为parse函数，添加新format函数在请求前实现规则的格式化

### 0.3.0/1/2/3/4
- 依赖大版本升级

### 0.2.1
- local传值类型实现泛型

### 0.2.0
- 优化函数命名规则：外部函数以字母开头，内部函数以$开头，私有函数以_开头

### 0.1.10
- 升级依赖，适配formatConfig

### 0.1.9
- BUG: 修正requestConfig.data被重置为空数据的BUG
- 类型: 扩展BaseRequest为泛型类，将返回值基础类型作为泛型传递，可以在后续扩展类中定义最终的返回值基础类型

### 0.1.8
- 非兼容性更新: Request => BaseRequest
- 修正post/get/form/json未正确请求的BUG
- 升级依赖

### 0.1.7
- 修正错误的依赖

### 0.1.3/4/5/6
- 优化请求参数和失败错误参数
- 扩展失败信息提示

### 0.1.2
- 扩展HTTP请求错误码
- 优化函数和类型

### 0.1.1
- 实现基础功能
