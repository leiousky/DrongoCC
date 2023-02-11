# 名词解释

* CocosCreator  简称CC
* DrongoCC       简称DCC
* FairyGUI         简称FGUI



# 什么是 fgui-drongo-cc？

fgui-drongo-cc 是FGUI编辑器导出插件

## 为什么需要这个插件？

* 将一个Fgui包中的代码定义都出到一个XXXbuilder.ts中，来减少项目后期由于.ts文件过多导致CocosCreator刷新时卡顿。
* 由于DCC框架使用CC引擎中的**AssetsBundle**来做**分包**，所以将代码定义和资源都导出到包对应的文件夹中，这样CC在发布游戏时**资源**和**代码**就都在**分包**中了（某些不支持代码分包的CC引擎会自己处理，**我们开发者不需要额外处理**）。



# 使用方式

1. 将插件fgui-drongo-cc 文件夹复制到FGUI工程的plugins 文件夹中
2. 重新打开Fgui编辑器，**工具**=>**插件** 打开插件面板确认插件中存在fgui-drongo-cc插件。
3. 在Fgui编辑器的发布设置面板中的**全局设置**：
   1. 设置**发布路径**
   2. 勾选**允许发布代码**
   3. 设置**代码发布路径**（注意必须和发布路径一致）
4. 在Fgui编辑器的发布设置面板中的**包设置**必须勾选上**为本包生成代码**，每个包都必须设置一次！！！

# 举例说明

比如我们的FGUI工程中有2个包：

1. FGUIPackageA				记得**包设置**必须勾选上**为本包生成代码**
2. FGUIPackageB                记得**包设置**必须勾选上**为本包生成代码**

发布面板中的全局设置中，我们将**发布路径**和**代码发布路径** 都设置为CC项目中的assets/modules

发布后的CC的目录结构应该是：

assets/

​		|

​		modules/

​					|

​					FGUIPackageA/

​											|

​											ui/

​												FGUIPackageA.bin   (Fgui的二进制配置文件)

​												***.png（一张或多张纹理集合）

​												FGUIPackageABinder.ts (Fgui包内定义类)

​					FGUIPackageB/

​											|

​											ui/

​												FGUIPackageB.bin   (Fgui的二进制配置文件)

​												***.png（一张或多张纹理集合）

​												FGUIPackageBBinder.ts (Fgui包内定义类)



到这一步本插件的工作就完成了，后续工作需要在CC中的drongo-cc-plugins插件来创建UI逻辑。 