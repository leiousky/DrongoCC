# 框架各模块技术实现及思考

[Toc]

## 基础工具类

**BitFlag** 	bit位操作工具类

**ByteArray** 	二进制读写工具类，copy来自老东家egret

**Debuger**		日志工具类

**Injector**		简易实现的注入工具类（用于将**权限外放**）

**Languagge** 	多语言工具类

**LocalStorage**	数据本地化工具类

**MaxRectsBinPack**  矩形装箱算法，处理动态贴图的空间算法。

**Pool**				自定义对象池

**RGBA8888Texture**	自定义纹理类，添加填充颜色fillRect/setPixel接口以及将纹理绘制到自定义纹理上的draw2Texture 接口。

**StringUtils**  常用字符串工具类



## TickerManager	心跳管理器

统一心跳机制的处理。



## Res 资源加载与管理模块

**优点**

* 使用引用计数来确定资源的引用规则，使得资源能正确的释放。
* 在调用接口中增加refkey也就是引用者信息，方便调试中能明确的知道谁引用了这个资源
* 基于Promise来封装同时满足回调和await两种写法

**使用方式**

需要资源时：

~~~ts
Res.getResRef({url:"001",bundle:"resources",type:Texture2D},"引用者名称",progress);
Res.getResRefList(....);
Res.getResRefMap(.....);
//以上接口使用Promise方式封装，所以可以用let result=await Res.getResRef()或then等接口来处理。
//分开三个接口 方便书写代码，因为只有在调用时是明确知道返回内容的需求。
~~~

 