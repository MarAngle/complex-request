### ToDo


### 0.4.4/5
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
