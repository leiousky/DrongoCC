import { sys, Texture2D, gfx, find, Node, director, Component as Component$1, Asset, Prefab, instantiate, isValid, assetManager, SpriteFrame, AudioSource, BufferAsset } from 'cc';
import { DEBUG } from 'cc/env';

/**
 * 注入器
 */
class Injector {
    /**
     * 注入
     * @param key
     * @param clazz   类型或实例
     */
    static inject(customKey, clazz) {
        if (clazz instanceof Function) {
            this.__injectedMap.set(customKey, clazz);
        }
        else {
            this.__instanceMap.set(customKey, clazz);
        }
    }
    /**
     * 获取已注入的类型实例
     */
    static getInject(customKey) {
        let instance = this.__instanceMap.get(customKey);
        if (instance) {
            return instance;
        }
        let clazz = this.__injectedMap.get(customKey);
        if (clazz === undefined) {
            return null;
        }
        instance = new clazz();
        this.__instanceMap.set(customKey, instance);
        return instance;
    }
}
/**类型字典*/
Injector.__injectedMap = new Map();
/**实例字典*/
Injector.__instanceMap = new Map();

/**
 * 事件分发器(只有一对多的情况下去使用)
 */
class EventDispatcher {
    constructor() {
        /**
        * 对象已经注册的处理器
        */
        this.callerMap = new Map();
        /**
         * 事件派发器上所监听的处理器
         */
        this.keyMap = new Map();
        /**
         * 需要派发的事件
         */
        this.needEmit = new Array;
    }
    /**
     * 添加事件
     * @param key
     * @param caller
     * @param func
     * @param priority 优先级（数字越小优先级越高）
     */
    on(key, handler, caller, priority = 0) {
        let infoList;
        let info;
        if (this.keyMap.has(key)) {
            infoList = this.keyMap.get(key);
            for (const iterator of infoList) {
                if (iterator.target == caller && iterator.handler == handler) {
                    console.error("重复添加同一个事件监听：" + key + " " + caller + " " + handler);
                    return;
                }
            }
        }
        else {
            infoList = [];
            this.keyMap.set(key, infoList);
        }
        info = new EventInfo(key, caller, handler);
        infoList.push(info);
        //按照优先级排序
        infoList.sort((a, b) => a.priority - priority);
        //处理器关联处理
        if (this.callerMap.has(caller)) {
            infoList = this.callerMap.get(caller);
            for (const iterator of infoList) {
                if (iterator.key == key && iterator.handler == handler) {
                    console.error("事件系统 处理器关联错误：" + key + " " + caller + " " + handler);
                }
            }
        }
        else {
            infoList = [];
            this.callerMap.set(caller, infoList);
        }
        infoList.push(info);
    }
    /**
     * 删除事件监听
     * @param key
     * @param caller
     * @param handler
     */
    off(key, handler, caller) {
        if (this.keyMap.has(key) == false) {
            return;
        }
        let infoList = this.keyMap.get(key);
        let info;
        let deleteInfo = null;
        //删除
        for (let index = 0; index < infoList.length; index++) {
            info = infoList[index];
            if (info.target == caller && info.handler == handler) {
                deleteInfo = info;
                infoList.splice(index, 1);
                break;
            }
        }
        if (this.callerMap.has(caller)) {
            infoList = this.callerMap.get(caller);
            //删除
            for (let index = 0; index < infoList.length; index++) {
                info = infoList[index];
                if (info.key == key && info.handler == handler) {
                    deleteInfo = info;
                    infoList.splice(index, 1);
                    break;
                }
            }
        }
        //销毁处理器
        if (deleteInfo) {
            deleteInfo.destroy();
        }
    }
    /**
     * 删除指定对象所有的事件处理
     * @param caller
     */
    offByCaller(caller) {
        let infoList = this.callerMap.get(caller);
        if (infoList === undefined || infoList.length == 0) {
            return;
        }
        let info;
        //逐个删除
        while (infoList.length) {
            info = infoList[0];
            this.off(info.key, info.handler, info.target);
        }
        //删除空列表
        this.callerMap.delete(caller);
    }
    /**
     * 删除所有事件监听
     */
    offAllEvent() {
        this.keyMap.forEach(infoList => {
            infoList.forEach(info => {
                info.destroy();
            });
        });
        this.keyMap.clear();
        this.callerMap.clear();
    }
    /**
     * 派发事件
     * @param type
     * @param data
     */
    emit(type, data) {
        for (let index = 0; index < this.needEmit.length; index++) {
            const element = this.needEmit[index];
            if (element.type == type && element.data === data) {
                return;
            }
        }
        this.needEmit.push({ type, data });
        TickerManager.callNextFrame(this.__emit, this);
    }
    __emit() {
        for (let index = 0; index < this.needEmit.length; index++) {
            const event = this.needEmit[index];
            if (this.keyMap.has(event.type) == false) {
                continue;
            }
            let infoList = this.keyMap.get(event.type);
            let info;
            for (let index = 0; index < infoList.length; index++) {
                info = infoList[index];
                info.handler.apply(info.target, [event.type, this, event.data]);
            }
        }
        this.needEmit.length = 0;
    }
    /**
     * 是否有事件监听
     * @param key
     */
    hasEvent(key) {
        return this.keyMap.has(key);
    }
    /**
     * 是否包含指定函数事件监听
     * @param key
     * @param caller
     * @param func
     */
    hasEventHandler(key, handler, caller) {
        if (this.keyMap.has(key) == false) {
            return false;
        }
        let infoList = this.keyMap.get(key);
        let info;
        for (let index = 0; index < infoList.length; index++) {
            info = infoList[index];
            if (info.target == caller && info.handler == handler) {
                return true;
            }
        }
        return false;
    }
    destroy() {
        this.callerMap.clear();
        this.keyMap.clear();
    }
}
class EventInfo {
    constructor(key, target, handler) {
        this.key = "";
        this.priority = 255;
        this.key = key;
        this.target = target;
        this.handler = handler;
    }
    destroy() {
    }
}

class Event {
    /**
     * 获取事件通道
     * @param key
     * @returns
     */
    static getChannel(key = "main") {
        return this.channels.get(key);
    }
    /**
     * 派发事件
     * @param eventType
     * @param data
     * @param channel   通道
     */
    static emit(eventType, data, channel = "main") {
        if (!this.channels.has(channel)) {
            return;
        }
        let eventChannel = this.channels.get(channel);
        eventChannel.emit(eventType, data);
    }
    /**
     * 添加事件监听
     * @param type
     * @param handler
     * @param caller
     * @param priority  优先级
     * @param channel   事件通道
     */
    static on(type, handler, caller, priority = 0, channel = "main") {
        let eventChannel;
        if (!this.channels.has(channel)) {
            eventChannel = new EventDispatcher();
            this.channels.set(channel, eventChannel);
        }
        else {
            eventChannel = this.channels.get(channel);
        }
        eventChannel.on(type, handler, caller, priority);
    }
    /**
     * 删除事件监听
     * @param type
     * @param handler
     * @param caller
     * @param channel
     * @returns
     */
    static off(type, handler, caller, channel = "main") {
        let eventChannel;
        if (!this.channels.has(channel)) {
            return;
        }
        else {
            eventChannel = this.channels.get(channel);
        }
        eventChannel.off(type, handler, caller);
    }
    /**
     * 删除指定对象上的所有事件监听
     * @param caller
     * @param channel
     * @returns
     */
    static offByCaller(caller, channel = "main") {
        let eventChannel;
        if (!this.channels.has(channel)) {
            return;
        }
        else {
            eventChannel = this.channels.get(channel);
        }
        eventChannel.offByCaller(caller);
    }
    /**
     * 删除指定通道上的所有事件监听
     * @param channel
     * @returns
     */
    static offAll(channel = "main") {
        let eventChannel;
        if (!this.channels.has(channel)) {
            return;
        }
        else {
            eventChannel = this.channels.get(channel);
        }
        eventChannel.offAllEvent();
    }
}
Event.START = "start";
Event.PROGRESS = "progress";
Event.COMPLETE = "complete";
Event.ERROR = "error";
Event.SHOW = "show";
Event.HIDE = "hide";
Event.ADD = "add";
Event.REMOVE = "remove";
Event.UPDATE = "update";
Event.CLEAR = "clear";
Event.State_Changed = "stateChanged";
/**事件通道 */
Event.channels = new Map();

/**
 * 字典
 */
class Dictionary extends EventDispatcher {
    constructor() {
        super();
        this.__map = new Map();
        this.__list = [];
    }
    set(key, value) {
        let old;
        //删除老的
        if (this.__map.has(key)) {
            old = this.__map.get(key);
            const index = this.__list.indexOf(old);
            if (index < 0) {
                throw new Error("Dictionary内部逻辑错误！");
            }
            this.__map.delete(key);
            this.__list.splice(index, 1);
            this.emit(Event.REMOVE, old);
        }
        this.__map.set(key, value);
        this.__list.push(value);
        this.emit(Event.ADD, value);
    }
    /**
     * 是否拥有指定KEY的元素
     * @param key
     * @returns
     */
    has(key) {
        return this.__map.has(key);
    }
    /**
     * 获取指定元素
     * @param key
     * @returns
     */
    get(key) {
        return this.__map.get(key);
    }
    /**
     * 通过索引获取元素
     * @param index
     * @returns
     */
    getValue(index) {
        if (index >= this.__list.length) {
            throw new Error(index + "索引超出0-" + this.__list.length + "范围");
        }
        return this.__list[index];
    }
    /**
     * 删除指定元素
     * @param key
     * @returns
     */
    delete(key) {
        if (!this.__map.has(key)) {
            return undefined;
        }
        const result = this.__map.get(key);
        const index = this.__list.indexOf(result);
        if (index < 0) {
            throw new Error("Dictionary内部逻辑错误！");
        }
        this.__list.splice(index, 1);
        this.__map.delete(key);
        //派发删除事件
        if (this.hasEvent(Event.REMOVE)) {
            this.emit(Event.REMOVE, result);
        }
        return result;
    }
    /**
     * 清除所有元素
     */
    clear() {
        this.__map.clear();
        this.__list.length = 0;
    }
    /**
    * 元素列表
    */
    get elements() {
        return this.__list;
    }
    get size() {
        return this.__map.size;
    }
    destroy() {
        super.destroy();
        this.__map.clear();
        this.__map = null;
        this.__list = null;
    }
}

class Debuger {
    /**
     * 设置过滤
     * @param key
     * @param isOpen
     */
    static debug(key, isOpen) {
        this.__debuger.set(key, isOpen);
    }
    /**
     * 获取已保存的日志
     * @param type
     * @returns
     */
    static getLogs(type) {
        if (type == undefined || type == null) {
            type = "all";
        }
        if (this.__logs.has(type)) {
            return this.__logs.get(type);
        }
        return null;
    }
    static __save(type, logType, msg) {
        let list;
        if (!this.__logs.has(type)) {
            list = [];
            this.__logs.set(type, list);
        }
        else {
            list = this.__logs.get(type);
        }
        let data = "[" + type + "]" + logType + ":" + msg;
        if (list.length >= this.MaxCount) {
            list.unshift(); //删除最顶上的那条
        }
        list.push(data);
        //保存到all
        if (!this.__logs.has("all")) {
            list = [];
            this.__logs.set("all", list);
        }
        else {
            list = this.__logs.get("all");
        }
        if (list.length >= this.MaxCount) {
            list.unshift(); //删除最顶上的那条
        }
        list.push(data);
        return data;
    }
    static log(type, msg) {
        let data = this.__save(type, "Log", msg);
        let isAll = this.__debuger.has("all") ? this.__debuger.get("all") : false;
        let isOpen = this.__debuger.has(type) ? this.__debuger.get(type) : false;
        if (isAll || isOpen) {
            console.log(data);
        }
    }
    static err(type, msg) {
        let data = this.__save(type, "Error", msg);
        let isAll = this.__debuger.has("all") ? this.__debuger.get("all") : false;
        let isOpen = this.__debuger.has(type) ? this.__debuger.get(type) : false;
        if (isAll || isOpen) {
            console.error(data);
        }
    }
    static warn(type, msg) {
        let data = this.__save(type, "Warn", msg);
        let isAll = this.__debuger.has("all") ? this.__debuger.get("all") : false;
        let isOpen = this.__debuger.has(type) ? this.__debuger.get(type) : false;
        if (isAll || isOpen) {
            console.warn(data);
        }
    }
    static info(type, msg) {
        let data = this.__save(type, "Info", msg);
        let isAll = this.__debuger.has("all") ? this.__debuger.get("all") : false;
        let isOpen = this.__debuger.has(type) ? this.__debuger.get(type) : false;
        if (isAll || isOpen) {
            console.info(data);
        }
    }
}
/**
 * 最大保存条数
 */
Debuger.MaxCount = 1000;
Debuger.__logs = new Dictionary();
Debuger.__debuger = new Map();

/**
 * 对象池
 */
class Pool {
    constructor(clazz, maxCount) {
        /**池中闲置对象 */
        this.__cacheStack = new Array();
        /**正在使用的对象 */
        this.__usingArray = new Array();
        /**池中对象最大数 */
        this.__maxCount = 0;
        this.__class = clazz;
        if (!this.__class) {
            throw new Error("构造函数不能为空！");
        }
        this.__maxCount = maxCount == undefined ? Number.MAX_SAFE_INTEGER : maxCount;
    }
    /**
    * 在池中的对象
    */
    get count() {
        return this.__cacheStack.length;
    }
    /**
     * 使用中的数量
     */
    get usingCount() {
        return this.__usingArray.length;
    }
    /**
     * 分配
     * @returns
     */
    allocate() {
        if (this.count + this.usingCount < this.__maxCount) {
            let element = this.__cacheStack.length > 0 ? this.__cacheStack.pop() : new this.__class();
            this.__usingArray.push(element);
            return element;
        }
        throw new Error("对象池最大数量超出：" + this.__maxCount);
    }
    /**
     * 回收到池中
     * @param value
     * @returns
     */
    recycle(value) {
        if (this.__cacheStack.indexOf(value) > -1) {
            throw new Error("重复回收！");
        }
        let index = this.__usingArray.indexOf(value);
        if (index < 0) {
            throw new Error("对象不属于改对象池！");
        }
        //重置
        value.reset();
        this.__usingArray.splice(index, 1);
        this.__cacheStack.push(value);
    }
    /**
     * 批量回收
     * @param list
     */
    recycleList(list) {
        for (let index = 0; index < list.length; index++) {
            const element = list[index];
            this.recycle(element);
        }
    }
    /**
     * 将所有使用中的对象都回收到池中
     */
    recycleAll() {
        for (let index = 0; index < this.__usingArray.length; index++) {
            const element = this.__usingArray[index];
            this.recycle(element);
        }
    }
    destroy() {
        this.recycleAll();
        for (let index = 0; index < this.__cacheStack.length; index++) {
            const element = this.__cacheStack[index];
            element.destroy();
        }
        this.__cacheStack.length = 0;
        this.__cacheStack = null;
        this.__usingArray.length = 0;
        this.__usingArray = null;
    }
}

/**
 * bit位操作
 */
class BitFlag {
    constructor() {
        this.__flags = 0;
        this.__elements = [];
    }
    add(flag) {
        this.__flags |= flag;
        if (this.__elements.indexOf(flag) < 0) {
            this.__elements.push(flag);
        }
    }
    remove(flag) {
        this.__flags ^= flag;
        let index = this.__elements.indexOf(flag);
        if (index >= 0) {
            this.__elements.splice(index, 1);
        }
    }
    /**
     * 是否包含
     * @param flag
     * @returns
     */
    has(flag) {
        return (this.__flags & flag) == flag;
    }
    /**
     * 位码
     */
    get flags() {
        return this.__flags;
    }
    get elements() {
        return this.__elements;
    }
    destroy() {
        this.__flags = 0;
        this.__elements.length = 0;
        this.__elements = null;
    }
}

/**
 * 本地数据缓存
 */
class LocalStorage {
    /**
     * 初始化
     * @param gameName
     */
    static init(gameName) {
        this.__gameName = gameName;
        let localDataStr = sys.localStorage.getItem(this.__gameName);
        if (!localDataStr) {
            this.data = {};
        }
        else {
            this.data = JSON.parse(localDataStr);
        }
    }
    /**
     * 获取指定数据
     * @param key
     * @returns
     */
    static getItem(key) {
        return this.data[key];
    }
    /**
     * 设置指定数据
     * @param key
     * @param value
     */
    static setItem(key, value) {
        this.data[key] = value;
    }
    /**
     * 清理
     * @param key
     */
    static clearItem(key) {
        delete this.data[key];
    }
    /**
     * 清理所有
     */
    static clearAll() {
        this.data = {};
    }
    /**
     * 保存
     */
    static save() {
        //保存到本地
        let localDataStr = JSON.stringify(this.data);
        sys.localStorage.setItem(this.__gameName, localDataStr);
    }
}

class StringUtils {
    /**
     * 是否为空
     * @param str
     */
    static isEmpty(str) {
        if (str == null || str == undefined || str.length == 0) {
            return true;
        }
        return false;
    }
    /**
     * 参数替换
     *  @param  str
     *  @param  rest
     *
     *  @example
     *
     *  var str:string = "here is some info '{0}' and {1}";
     *  trace(StringUtil.substitute(str, 15.4, true));
     *
     *  // this will output the following string:
     *  // "here is some info '15.4' and true"
     */
    static substitute(str, ...rest) {
        if (str == null)
            return '';
        // Replace all of the parameters in the msg string.
        var len = rest.length;
        var args;
        if (len == 1 && rest[0] instanceof Array) {
            args = rest[0];
            len = args.length;
        }
        else {
            args = rest;
        }
        for (var i = 0; i < len; i++) {
            str = str.replace(new RegExp("\\{" + i + "\\}", "g"), args[i]);
        }
        return str;
    }
    /**
    * 替换全部字符串
    * @param string src 源串
    * @param string from_ch 被替换的字符
    * @param string to_ch 替换的字符
    *
    * @return string 结果字符串
    */
    static replaceAll(src, from_ch, to_ch) {
        return src.split(from_ch).join(to_ch);
    }
    /**
     * 拆分字符串
     * @param str
     */
    static splitString(str, split0, split1) {
        let args = new Array();
        let tmp = str.split(split0);
        tmp.forEach((val, key) => {
            let s = val.split(split1);
            args.push(s);
        });
        return args;
    }
    /**
     * 获取文件后缀名
     * @param url
     */
    static getFileSuffix(url) {
        let index = url.lastIndexOf(".");
        if (index < 0) {
            throw new Error(url + "没有后缀！！！");
        }
        let suixx = url.substring(index + 1);
        return suixx;
    }
    /**
     * 替换后缀
     * @param url
     * @param suff      后缀
     * @returns
     */
    static replaceSuffix(url, suff) {
        let index = url.lastIndexOf(".");
        if (index < 0) {
            throw new Error(url + "没有后缀！！！");
        }
        let suixx = url.substring(index + 1);
        let changeUrl = url.replace(suixx, suff);
        return changeUrl;
    }
}

var FindPosition;
(function (FindPosition) {
    FindPosition[FindPosition["ShortSideFit"] = 0] = "ShortSideFit";
    FindPosition[FindPosition["BottomLeft"] = 1] = "BottomLeft";
    FindPosition[FindPosition["ContactPoint"] = 2] = "ContactPoint";
    FindPosition[FindPosition["LongSideFit"] = 3] = "LongSideFit";
    FindPosition[FindPosition["AreaFit"] = 4] = "AreaFit";
})(FindPosition || (FindPosition = {}));
class MaxRectBinPack {
    /**
     * 构建方程
     * @param width {number} 画板宽度
     * @param height {number} 画板高度
     * @param allowRotate {boolean} 允许旋转
     */
    constructor(width, height, allowRotate) {
        this.freeRects = [];
        this.usedRects = [];
        this.containerHeight = height;
        this.containerWidth = width;
        this.allowRotate = allowRotate === true;
        const rect = new Rect();
        rect.x = 0;
        rect.y = 0;
        rect.width = width;
        rect.height = height;
        this.freeRects.push(rect);
    }
    /**
     * 在线算法入口 插入矩形方法
     * @param width {number}
     * @param height {number}
     * @param method {FindPosition}
     */
    insert(width, height, method) {
        // width height 参数合法性检查
        if (width <= 0 || height <= 0) {
            throw new Error(`width & height should greater than 0, but got width as ${width}, height as ${height}`);
        }
        // method 合法性检查
        if (method <= FindPosition.ShortSideFit || method >= FindPosition.AreaFit) {
            method = FindPosition.ShortSideFit;
        }
        let newRect = new Rect();
        const score1 = {
            value: 0,
        };
        const score2 = {
            value: 0,
        };
        switch (method) {
            case FindPosition.ShortSideFit:
                newRect = this.findPositionForNewNodeBestShortSideFit(width, height, score1, score2);
                break;
            case FindPosition.BottomLeft:
                newRect = this.findPositionForNewNodeBottomLeft(width, height, score1, score2);
                break;
            case FindPosition.ContactPoint:
                newRect = this.findPositionForNewNodeContactPoint(width, height, score1);
                break;
            case FindPosition.LongSideFit:
                newRect = this.findPositionForNewNodeBestLongSideFit(width, height, score2, score1);
                break;
            case FindPosition.AreaFit:
                newRect = this.findPositionForNewNodeBestAreaFit(width, height, score1, score2);
                break;
        }
        if (newRect.height === 0) {
            return newRect;
        }
        if (this.allowRotate) { // 更新旋转属性
            if (newRect.height === height && newRect.width === width) {
                newRect.isRotated = false;
            }
            else {
                newRect.isRotated = true;
            }
        }
        this.placeRectangle(newRect);
        return newRect;
    }
    // /**
    //  * 算法离线入口 插入一组举行
    //  * @param rects {Rect[]} 矩形数组
    //  * @param method {FindPosition} 查找位置的方法
    //  */
    // public insertRects(rects: Rect[], method: FindPosition): Rect[] {
    //     // rects 参数合法性检查
    //     if (rects && rects.length === 0) {
    //         throw new Error('rects should be array with length greater than zero');
    //     }
    //     // method 合法性检查
    //     if (method <= FindPosition.ShortSideFit || method >= FindPosition.AreaFit) {
    //         method = FindPosition.ShortSideFit;
    //     }
    //     const result: Rect[] = [];
    //     while (rects.length > 0) {
    //         const bestScore1: IScoreCounter = {
    //             value: Infinity,
    //         };
    //         const bestScore2: IScoreCounter = {
    //             value: Infinity,
    //         };
    //         let bestRectIndex = -1;
    //         let bestNode: Rect;
    //         for (let i = 0; i < rects.length; ++i) {
    //             const score1: IScoreCounter = {
    //                 value: 0,
    //             };
    //             const score2: IScoreCounter = {
    //                 value: 0,
    //             };
    //             const newNode: Rect = this.scoreRectangle(
    //                 rects[i].width,
    //                 rects[i].height,
    //                 method,
    //                 score1,
    //                 score2,
    //             );
    //             if (
    //                 score1.value < bestScore1.value ||
    //                 (score1.value === bestScore1.value && score2.value < bestScore2.value)
    //             ) {
    //                 bestScore1.value = score1.value;
    //                 bestScore2.value = score2.value;
    //                 bestNode = newNode;
    //                 bestRectIndex = i;
    //             }
    //         }
    //         if (bestRectIndex === -1) {
    //             return result;
    //         }
    //         this.placeRectangle(bestNode);
    //         bestNode.info = rects[bestRectIndex].info;
    //         if (this.allowRotate) {
    //             if (
    //                 bestNode.height === rects[bestRectIndex].height &&
    //                 bestNode.width === rects[bestRectIndex].width
    //             ) {
    //                 bestNode.isRotated = false;
    //             } else {
    //                 bestNode.isRotated = true;
    //             }
    //         }
    //         rects.splice(bestRectIndex, 1);
    //         result.push(bestNode);
    //     }
    //     return result;
    // }
    /**
     * 占有率
     * @returns
     */
    get occupancy() {
        let usedSurfaceArea = 0;
        for (const rect of this.usedRects) {
            usedSurfaceArea += rect.width * rect.height;
        }
        return usedSurfaceArea / (this.containerWidth * this.containerHeight);
    }
    /**
     * 擦除节点
     * @param rect
     */
    eraseNoce(rect) {
        let index = this.usedRects.indexOf(rect);
        if (index != -1) {
            this.usedRects.splice(index, 1);
        }
        index = this.freeRects.indexOf(rect);
        if (index == -1) {
            this.freeRects.push(rect);
            this.pruneFreeList();
        }
    }
    /**
     *
     * @param node
     */
    placeRectangle(node) {
        let numRectanglesToProcess = this.freeRects.length;
        for (let i = 0; i < numRectanglesToProcess; i++) {
            if (this.splitFreeNode(this.freeRects[i], node)) {
                this.freeRects.splice(i, 1);
                i--;
                numRectanglesToProcess--;
            }
        }
        this.pruneFreeList();
        this.usedRects.push(node);
    }
    scoreRectangle(width, height, method, score1, score2) {
        let newNode = new Rect();
        score1.value = Infinity;
        score2.value = Infinity;
        switch (method) {
            case FindPosition.ShortSideFit:
                newNode = this.findPositionForNewNodeBestShortSideFit(width, height, score1, score2);
                break;
            case FindPosition.BottomLeft:
                newNode = this.findPositionForNewNodeBottomLeft(width, height, score1, score2);
                break;
            case FindPosition.ContactPoint:
                newNode = this.findPositionForNewNodeContactPoint(width, height, score1);
                // todo: reverse
                score1.value = -score1.value; // Reverse since we are minimizing, but for contact point score bigger is better.
                break;
            case FindPosition.LongSideFit:
                newNode = this.findPositionForNewNodeBestLongSideFit(width, height, score2, score1);
                break;
            case FindPosition.AreaFit:
                newNode = this.findPositionForNewNodeBestAreaFit(width, height, score1, score2);
                break;
        }
        // Cannot fit the current Rectangle.
        if (newNode.height === 0) {
            score1.value = Infinity;
            score2.value = Infinity;
        }
        return newNode;
    }
    findPositionForNewNodeBottomLeft(width, height, bestY, bestX) {
        this.freeRects;
        const bestNode = new Rect();
        bestY.value = Infinity;
        let topSideY;
        for (const rect of this.freeRects) {
            // Try to place the Rectangle in upright (non-flipped) orientation.
            if (rect.width >= width && rect.height >= height) {
                topSideY = rect.y + height;
                if (topSideY < bestY.value ||
                    (topSideY === bestY.value && rect.x < bestX.value)) {
                    bestNode.x = rect.x;
                    bestNode.y = rect.y;
                    bestNode.width = width;
                    bestNode.height = height;
                    bestY.value = topSideY;
                    bestX.value = rect.x;
                }
            }
            if (this.allowRotate && rect.width >= height && rect.height >= width) {
                topSideY = rect.y + width;
                if (topSideY < bestY.value ||
                    (topSideY === bestY.value && rect.x < bestX.value)) {
                    bestNode.x = rect.x;
                    bestNode.y = rect.y;
                    bestNode.width = height;
                    bestNode.height = width;
                    bestY.value = topSideY;
                    bestX.value = rect.x;
                }
            }
        }
        return bestNode;
    }
    findPositionForNewNodeBestShortSideFit(width, height, bestShortSideFit, bestLongSideFit) {
        const bestNode = new Rect();
        bestShortSideFit.value = Infinity;
        let leftoverHoriz;
        let leftoverVert;
        let shortSideFit;
        let longSideFit;
        for (const rect of this.freeRects) {
            // Try to place the Rectangle in upright (non-flipped) orientation.
            if (rect.width >= width && rect.height >= height) {
                leftoverHoriz = Math.abs(rect.width - width);
                leftoverVert = Math.abs(rect.height - height);
                shortSideFit = Math.min(leftoverHoriz, leftoverVert);
                longSideFit = Math.max(leftoverHoriz, leftoverVert);
                if (shortSideFit < bestShortSideFit.value ||
                    (shortSideFit === bestShortSideFit.value &&
                        longSideFit < bestLongSideFit.value)) {
                    bestNode.x = rect.x;
                    bestNode.y = rect.y;
                    bestNode.width = width;
                    bestNode.height = height;
                    bestShortSideFit.value = shortSideFit;
                    bestLongSideFit.value = longSideFit;
                }
            }
            let flippedLeftoverHoriz;
            let flippedLeftoverVert;
            let flippedShortSideFit;
            let flippedLongSideFit;
            if (this.allowRotate && rect.width >= height && rect.height >= width) {
                flippedLeftoverHoriz = Math.abs(rect.width - height);
                flippedLeftoverVert = Math.abs(rect.height - width);
                flippedShortSideFit = Math.min(flippedLeftoverHoriz, flippedLeftoverVert);
                flippedLongSideFit = Math.max(flippedLeftoverHoriz, flippedLeftoverVert);
                if (flippedShortSideFit < bestShortSideFit.value ||
                    (flippedShortSideFit === bestShortSideFit.value &&
                        flippedLongSideFit < bestLongSideFit.value)) {
                    bestNode.x = rect.x;
                    bestNode.y = rect.y;
                    bestNode.width = height;
                    bestNode.height = width;
                    bestShortSideFit.value = flippedShortSideFit;
                    bestLongSideFit.value = flippedLongSideFit;
                }
            }
        }
        return bestNode;
    }
    findPositionForNewNodeBestLongSideFit(width, height, bestShortSideFit, bestLongSideFit) {
        const bestNode = new Rect();
        bestLongSideFit.value = Infinity;
        let leftoverHoriz;
        let leftoverVert;
        let shortSideFit;
        let longSideFit;
        for (const rect of this.freeRects) {
            // Try to place the Rectangle in upright (non-flipped) orientation.
            if (rect.width >= width && rect.height >= height) {
                leftoverHoriz = Math.abs(rect.width - width);
                leftoverVert = Math.abs(rect.height - height);
                shortSideFit = Math.min(leftoverHoriz, leftoverVert);
                longSideFit = Math.max(leftoverHoriz, leftoverVert);
                if (longSideFit < bestLongSideFit.value ||
                    (longSideFit === bestLongSideFit.value &&
                        shortSideFit < bestShortSideFit.value)) {
                    bestNode.x = rect.x;
                    bestNode.y = rect.y;
                    bestNode.width = width;
                    bestNode.height = height;
                    bestShortSideFit.value = shortSideFit;
                    bestLongSideFit.value = longSideFit;
                }
            }
            if (this.allowRotate && rect.width >= height && rect.height >= width) {
                leftoverHoriz = Math.abs(rect.width - height);
                leftoverVert = Math.abs(rect.height - width);
                shortSideFit = Math.min(leftoverHoriz, leftoverVert);
                longSideFit = Math.max(leftoverHoriz, leftoverVert);
                if (longSideFit < bestLongSideFit.value ||
                    (longSideFit === bestLongSideFit.value &&
                        shortSideFit < bestShortSideFit.value)) {
                    bestNode.x = rect.x;
                    bestNode.y = rect.y;
                    bestNode.width = height;
                    bestNode.height = width;
                    bestShortSideFit.value = shortSideFit;
                    bestLongSideFit.value = longSideFit;
                }
            }
        }
        return bestNode;
    }
    findPositionForNewNodeBestAreaFit(width, height, bestAreaFit, bestShortSideFit) {
        const bestNode = new Rect();
        bestAreaFit.value = Infinity;
        let leftoverHoriz;
        let leftoverVert;
        let shortSideFit;
        let areaFit;
        for (const rect of this.freeRects) {
            areaFit = rect.width * rect.height - width * height;
            // Try to place the Rectangle in upright (non-flipped) orientation.
            if (rect.width >= width && rect.height >= height) {
                leftoverHoriz = Math.abs(rect.width - width);
                leftoverVert = Math.abs(rect.height - height);
                shortSideFit = Math.min(leftoverHoriz, leftoverVert);
                if (areaFit < bestAreaFit.value ||
                    (areaFit === bestAreaFit.value &&
                        shortSideFit < bestShortSideFit.value)) {
                    bestNode.x = rect.x;
                    bestNode.y = rect.y;
                    bestNode.width = width;
                    bestNode.height = height;
                    bestShortSideFit.value = shortSideFit;
                    bestAreaFit.value = areaFit;
                }
            }
            if (this.allowRotate && rect.width >= height && rect.height >= width) {
                leftoverHoriz = Math.abs(rect.width - height);
                leftoverVert = Math.abs(rect.height - width);
                shortSideFit = Math.min(leftoverHoriz, leftoverVert);
                if (areaFit < bestAreaFit.value ||
                    (areaFit === bestAreaFit.value &&
                        shortSideFit < bestShortSideFit.value)) {
                    bestNode.x = rect.x;
                    bestNode.y = rect.y;
                    bestNode.width = height;
                    bestNode.height = width;
                    bestShortSideFit.value = shortSideFit;
                    bestAreaFit.value = areaFit;
                }
            }
        }
        return bestNode;
    }
    commonIntervalLength(i1start, i1end, i2start, i2end) {
        if (i1end < i2start || i2end < i1start) {
            return 0;
        }
        return Math.min(i1end, i2end) - Math.max(i1start, i2start);
    }
    contactPointScoreNode(x, y, width, height) {
        let score = 0;
        if (x === 0 || x + width === this.containerWidth) {
            score += height;
        }
        if (y === 0 || y + height === this.containerHeight) {
            score += width;
        }
        for (const rect of this.usedRects) {
            if (rect.x === x + width || rect.x + rect.width === x) {
                score += this.commonIntervalLength(rect.y, rect.y + rect.height, y, y + height);
            }
            if (rect.y === y + height || rect.y + rect.height === y) {
                score += this.commonIntervalLength(rect.x, rect.x + rect.width, x, x + width);
            }
        }
        return score;
    }
    findPositionForNewNodeContactPoint(width, height, bestContactScore) {
        const bestNode = new Rect();
        bestContactScore.value = -1;
        let score;
        for (const rect of this.freeRects) {
            // Try to place the Rectangle in upright (non-flipped) orientation.
            if (rect.width >= width && rect.height >= height) {
                score = this.contactPointScoreNode(rect.x, rect.y, width, height);
                if (score > bestContactScore.value) {
                    bestNode.x = rect.x;
                    bestNode.y = rect.y;
                    bestNode.width = width;
                    bestNode.height = height;
                    bestContactScore.value = score;
                }
            }
            if (this.allowRotate && rect.width >= height && rect.height >= width) {
                score = this.contactPointScoreNode(rect.x, rect.y, height, width);
                if (score > bestContactScore.value) {
                    bestNode.x = rect.x;
                    bestNode.y = rect.y;
                    bestNode.width = height;
                    bestNode.height = width;
                    bestContactScore.value = score;
                }
            }
        }
        return bestNode;
    }
    splitFreeNode(freeNode, usedNode) {
        const freeRectangles = this.freeRects;
        // Test with SAT if the Rectangles even intersect.
        if (usedNode.x >= freeNode.x + freeNode.width ||
            usedNode.x + usedNode.width <= freeNode.x ||
            usedNode.y >= freeNode.y + freeNode.height ||
            usedNode.y + usedNode.height <= freeNode.y) {
            return false;
        }
        let newNode;
        if (usedNode.x < freeNode.x + freeNode.width &&
            usedNode.x + usedNode.width > freeNode.x) {
            // New node at the top side of the used node.
            if (usedNode.y > freeNode.y &&
                usedNode.y < freeNode.y + freeNode.height) {
                newNode = freeNode.clone();
                newNode.height = usedNode.y - newNode.y;
                freeRectangles.push(newNode);
            }
            // New node at the bottom side of the used node.
            if (usedNode.y + usedNode.height < freeNode.y + freeNode.height) {
                newNode = freeNode.clone();
                newNode.y = usedNode.y + usedNode.height;
                newNode.height =
                    freeNode.y + freeNode.height - (usedNode.y + usedNode.height);
                freeRectangles.push(newNode);
            }
        }
        if (usedNode.y < freeNode.y + freeNode.height &&
            usedNode.y + usedNode.height > freeNode.y) {
            // New node at the left side of the used node.
            if (usedNode.x > freeNode.x && usedNode.x < freeNode.x + freeNode.width) {
                newNode = freeNode.clone();
                newNode.width = usedNode.x - newNode.x;
                freeRectangles.push(newNode);
            }
            // New node at the right side of the used node.
            if (usedNode.x + usedNode.width < freeNode.x + freeNode.width) {
                newNode = freeNode.clone();
                newNode.x = usedNode.x + usedNode.width;
                newNode.width =
                    freeNode.x + freeNode.width - (usedNode.x + usedNode.width);
                freeRectangles.push(newNode);
            }
        }
        return true;
    }
    pruneFreeList() {
        const freeRectangles = this.freeRects;
        for (let i = 0; i < freeRectangles.length; i++) {
            for (let j = i + 1; j < freeRectangles.length; j++) {
                if (freeRectangles[i].isIn(freeRectangles[j])) {
                    freeRectangles.splice(i, 1);
                    break;
                }
                if (freeRectangles[j].isIn(freeRectangles[i])) {
                    freeRectangles.splice(j, 1);
                }
            }
        }
    }
}
class Rect {
    constructor() {
        /**
         * 起点 x 坐标
         */
        this.x = 0;
        /**
         * 起点 y 坐标
         */
        this.y = 0;
        /**
         * 宽度
         */
        this.width = 0;
        /**
         * 高度
         */
        this.height = 0;
        /**
         * 当前是否被旋转了
         */
        this.isRotated = false;
    }
    /**
     * 克隆
     */
    clone() {
        const cloned = new Rect();
        cloned.x = this.x;
        cloned.y = this.y;
        cloned.height = this.height;
        cloned.width = this.width;
        cloned.info = this.info;
        return cloned;
    }
    /**
     * 矩形是否在另一个矩形内部
     * @param otherRect {Rect}
     */
    isIn(otherRect) {
        return (this.x >= otherRect.x &&
            this.y >= otherRect.y &&
            this.x + this.width <= otherRect.x + otherRect.width &&
            this.y + this.height <= otherRect.y + otherRect.height);
    }
    get isEmpty() {
        return this.x == 0 && this.y == 0 && this.width == 0 && this.height == 0;
    }
}

/**
 * RGBA8888二进制纹理
 */
class RGBA8888Texture extends Texture2D {
    constructor(width, height) {
        super();
        this.reset({ width, height, format: Texture2D.PixelFormat.RGBA8888 });
    }
    /**
     * 填充颜色
     * @param x
     * @param y
     * @param width
     * @param height
     * @param color
     */
    fillRect(x, y, width, height, color) {
        let a = ((color >> 24) & 0xff);
        let r = ((color >> 16) & 0xff);
        let g = ((color >> 8) & 0xff);
        let b = ((color) & 0xff);
        this.__fillRect(x, y, width, height, a, r, g, b);
    }
    __fillRect(x, y, width, height, a, r, g, b) {
        let bytes = new Uint8Array(width * height * 4);
        let index;
        for (let ix = 0; ix < width; ix++) {
            for (let iy = 0; iy < height; iy++) {
                index = (iy * width + ix) * 4;
                bytes[index] = r;
                bytes[index + 1] = g;
                bytes[index + 2] = b;
                bytes[index + 3] = a;
            }
        }
        this.copyBuffersToTexture(bytes, x, y, width, height);
    }
    /**
     * 通过颜色分量设置
     * @param r
     * @param g
     * @param b
     * @param a
     * @param x
     * @param y
     */
    setPixel(r, g, b, a, x, y) {
        this.__fillRect(x, y, 1, 1, a, r, g, b);
    }
    /**
     * 通过单个颜色值设置
     * @param color
     * @param x
     * @param y
     */
    setPixelColor(color, x, y) {
        let a = ((color >> 24) & 0xff);
        let r = ((color >> 16) & 0xff);
        let g = ((color >> 8) & 0xff);
        let b = ((color) & 0xff);
        this.setPixel(r, g, b, a, x, y);
    }
    /**
     * 将纹理绘制到纹理
     * @param texture
     * @param sx
     * @param sy
     * @param width
     * @param height
     * @param tx
     * @param ty
     * @param filter
     * @returns
     */
    draw2Texture(texture, sx, sy, width, height, tx, ty, filter = gfx.Filter.POINT) {
        //废弃，经过测试blitTexture在微信平台会有颜色覆盖BUG
        // const gfxTexture = texture.getGFXTexture()
        // if (!gfxTexture) {
        //     return;
        // }
        // let region = new gfx.TextureBlit();
        // region.srcOffset.x = sx;
        // region.srcOffset.y = sy;
        // region.srcExtent.width = width;
        // region.srcExtent.height = height;
        // region.dstOffset.x = tx;
        // region.dstOffset.y = ty;
        // region.dstExtent.width = width;
        // region.dstExtent.height = height;
        // gfx.deviceManager.gfxDevice.commandBuffer.blitTexture(gfxTexture, this.getGFXTexture(), [region], filter);
        //先从纹理中获取二进制数据
        let buffer = new Uint8Array(width * height * 4);
        let region = new gfx.BufferTextureCopy();
        region.texOffset.x = sx;
        region.texOffset.y = sy;
        region.texExtent.width = width;
        region.texExtent.height = height;
        this._getGFXDevice().copyTextureToBuffers(texture.getGFXTexture(), [buffer], [region]);
        //然后将二进制数据填充到纹理
        region.texOffset.x = tx;
        region.texOffset.y = ty;
        this._getGFXDevice().copyBuffersToTexture([buffer], this.getGFXTexture(), [region]);
    }
    /**
     * 将二进制数据填充到纹理的指定区域
     * @param buffer
     * @param x
     * @param y
     * @param width
     * @param height
     * @returns
    */
    copyBuffersToTexture(buffer, x, y, width, height) {
        let region = new gfx.BufferTextureCopy();
        region.texOffset.x = x;
        region.texOffset.y = y;
        region.texExtent.width = width;
        region.texExtent.height = height;
        const gfxTexture = this.getGFXTexture();
        if (!gfxTexture) {
            return;
        }
        this._getGFXDevice().copyBuffersToTexture([buffer], gfxTexture, [region]);
    }
}

/**
 * 处理器
 */
class Handler {
    constructor() {
        this.once = true;
    }
    run(...args) {
        if (this.method && !this.isOver) {
            this.method.apply(this.caller, args);
            if (this.once) {
                this.isOver = true;
            }
        }
    }
    equal(value) {
        if (this.method == value.method && this.caller == value.caller) {
            return true;
        }
        return false;
    }
    static create(caller, method, once) {
        var h = new Handler();
        h.caller = caller;
        h.method = method;
        h.once = once;
        h.isOver = false;
        return h;
    }
}

//////////////////////////////////////////////////////////////////////////////////////
//
//  Copyright (c) 2014-present, Egret Technology.
//  All rights reserved.
//  Redistribution and use in source and binary forms, with or without
//  modification, are permitted provided that the following conditions are met:
//
//     * Redistributions of source code must retain the above copyright
//       notice, this list of conditions and the following disclaimer.
//     * Redistributions in binary form must reproduce the above copyright
//       notice, this list of conditions and the following disclaimer in the
//       documentation and/or other materials provided with the distribution.
//     * Neither the name of the Egret nor the
//       names of its contributors may be used to endorse or promote products
//       derived from this software without specific prior written permission.
//
//  THIS SOFTWARE IS PROVIDED BY EGRET AND CONTRIBUTORS "AS IS" AND ANY EXPRESS
//  OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES
//  OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED.
//  IN NO EVENT SHALL EGRET AND CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT,
//  INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
//  LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;LOSS OF USE, DATA,
//  OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
//  LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
//  NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE,
//  EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
//
//////////////////////////////////////////////////////////////////////////////////////
/**
 * The Endian class contains values that denote the byte order used to represent multibyte numbers.
 * The byte order is either bigEndian (most significant byte first) or littleEndian (least significant byte first).
 * @version Egret 2.4
 * @platform Web,Native
 * @language en_US
 */
/**
 * Endian 类中包含一些值，它们表示用于表示多字节数字的字节顺序。
 * 字节顺序为 bigEndian（最高有效字节位于最前）或 littleEndian（最低有效字节位于最前）。
 * @version Egret 2.4
 * @platform Web,Native
 * @language zh_CN
 */
class Endian {
}
/**
 * Indicates the least significant byte of the multibyte number appears first in the sequence of bytes.
 * The hexadecimal number 0x12345678 has 4 bytes (2 hexadecimal digits per byte). The most significant byte is 0x12. The least significant byte is 0x78. (For the equivalent decimal number, 305419896, the most significant digit is 3, and the least significant digit is 6).
 * @version Egret 2.4
 * @platform Web,Native
 * @language en_US
 */
/**
 * 表示多字节数字的最低有效字节位于字节序列的最前面。
 * 十六进制数字 0x12345678 包含 4 个字节（每个字节包含 2 个十六进制数字）。最高有效字节为 0x12。最低有效字节为 0x78。（对于等效的十进制数字 305419896，最高有效数字是 3，最低有效数字是 6）。
 * @version Egret 2.4
 * @platform Web,Native
 * @language zh_CN
 */
Endian.LITTLE_ENDIAN = "littleEndian";
/**
 * Indicates the most significant byte of the multibyte number appears first in the sequence of bytes.
 * The hexadecimal number 0x12345678 has 4 bytes (2 hexadecimal digits per byte).  The most significant byte is 0x12. The least significant byte is 0x78. (For the equivalent decimal number, 305419896, the most significant digit is 3, and the least significant digit is 6).
 * @version Egret 2.4
 * @platform Web,Native
 * @language en_US
 */
/**
 * 表示多字节数字的最高有效字节位于字节序列的最前面。
 * 十六进制数字 0x12345678 包含 4 个字节（每个字节包含 2 个十六进制数字）。最高有效字节为 0x12。最低有效字节为 0x78。（对于等效的十进制数字 305419896，最高有效数字是 3，最低有效数字是 6）。
 * @version Egret 2.4
 * @platform Web,Native
 * @language zh_CN
 */
Endian.BIG_ENDIAN = "bigEndian";
/**
 * The ByteArray class provides methods and attributes for optimized reading and writing as well as dealing with binary data.
 * Note: The ByteArray class is applied to the advanced developers who need to access data at the byte layer.
 * @version Egret 2.4
 * @platform Web,Native
 * @includeExample egret/utils/ByteArray.ts
 * @language en_US
 */
/**
 * ByteArray 类提供用于优化读取、写入以及处理二进制数据的方法和属性。
 * 注意：ByteArray 类适用于需要在字节层访问数据的高级开发人员。
 * @version Egret 2.4
 * @platform Web,Native
 * @includeExample egret/utils/ByteArray.ts
 * @language zh_CN
 */
class ByteArray {
    /**
     * Changes or reads the byte order; egret.EndianConst.BIG_ENDIAN or egret.EndianConst.LITTLE_EndianConst.
     * @default egret.EndianConst.BIG_ENDIAN
     * @version Egret 2.4
     * @platform Web,Native
     * @language en_US
     */
    /**
     * 更改或读取数据的字节顺序；egret.EndianConst.BIG_ENDIAN 或 egret.EndianConst.LITTLE_ENDIAN。
     * @default egret.EndianConst.BIG_ENDIAN
     * @version Egret 2.4
     * @platform Web,Native
     * @language zh_CN
     */
    get endian() {
        return this.$endian == 0 /* EndianConst.LITTLE_ENDIAN */ ? Endian.LITTLE_ENDIAN : Endian.BIG_ENDIAN;
    }
    set endian(value) {
        this.$endian = value == Endian.LITTLE_ENDIAN ? 0 /* EndianConst.LITTLE_ENDIAN */ : 1 /* EndianConst.BIG_ENDIAN */;
    }
    /**
     * @version Egret 2.4
     * @platform Web,Native
     */
    constructor(buffer, bufferExtSize = 0) {
        /**
         * @private
         */
        this.bufferExtSize = 0; //Buffer expansion size
        /**
         * @private
         */
        this.EOF_byte = -1;
        /**
         * @private
         */
        this.EOF_code_point = -1;
        if (bufferExtSize < 0) {
            bufferExtSize = 0;
        }
        this.bufferExtSize = bufferExtSize;
        let bytes, wpos = 0;
        if (buffer) { //有数据，则可写字节数从字节尾开始
            let uint8;
            if (buffer instanceof Uint8Array) {
                uint8 = buffer;
                wpos = buffer.length;
            }
            else {
                wpos = buffer.byteLength;
                uint8 = new Uint8Array(buffer);
            }
            if (bufferExtSize == 0) {
                bytes = new Uint8Array(wpos);
            }
            else {
                let multi = (wpos / bufferExtSize | 0) + 1;
                bytes = new Uint8Array(multi * bufferExtSize);
            }
            bytes.set(uint8);
        }
        else {
            bytes = new Uint8Array(bufferExtSize);
        }
        this.write_position = wpos;
        this._position = 0;
        this._bytes = bytes;
        this.data = new DataView(bytes.buffer);
        this.endian = Endian.BIG_ENDIAN;
    }
    reset() {
        this.clear();
    }
    destroy() {
        this._bytes = null;
        this.data = null;
    }
    /**
     * @deprecated
     * @version Egret 2.4
     * @platform Web,Native
     */
    setArrayBuffer(buffer) {
    }
    /**
     * 可读的剩余字节数
     *
     * @returns
     *
     * @memberOf ByteArray
     */
    get readAvailable() {
        return this.write_position - this._position;
    }
    get buffer() {
        return this.data.buffer.slice(0, this.write_position);
    }
    get rawBuffer() {
        return this.data.buffer;
    }
    /**
     * @private
     */
    set buffer(value) {
        let wpos = value.byteLength;
        let uint8 = new Uint8Array(value);
        let bufferExtSize = this.bufferExtSize;
        let bytes;
        if (bufferExtSize == 0) {
            bytes = new Uint8Array(wpos);
        }
        else {
            let multi = (wpos / bufferExtSize | 0) + 1;
            bytes = new Uint8Array(multi * bufferExtSize);
        }
        bytes.set(uint8);
        this.write_position = wpos;
        this._bytes = bytes;
        this.data = new DataView(bytes.buffer);
    }
    get bytes() {
        return this._bytes;
    }
    /**
     * @private
     * @version Egret 2.4
     * @platform Web,Native
     */
    get dataView() {
        return this.data;
    }
    /**
     * @private
     */
    set dataView(value) {
        this.buffer = value.buffer;
    }
    /**
     * @private
     */
    get bufferOffset() {
        return this.data.byteOffset;
    }
    /**
     * The current position of the file pointer (in bytes) to move or return to the ByteArray object. The next time you start reading reading method call in this position, or will start writing in this position next time call a write method.
     * @version Egret 2.4
     * @platform Web,Native
     * @language en_US
     */
    /**
     * 将文件指针的当前位置（以字节为单位）移动或返回到 ByteArray 对象中。下一次调用读取方法时将在此位置开始读取，或者下一次调用写入方法时将在此位置开始写入。
     * @version Egret 2.4
     * @platform Web,Native
     * @language zh_CN
     */
    get position() {
        return this._position;
    }
    set position(value) {
        this._position = value;
        if (value > this.write_position) {
            this.write_position = value;
        }
    }
    /**
     * The length of the ByteArray object (in bytes).
              * If the length is set to be larger than the current length, the right-side zero padding byte array.
              * If the length is set smaller than the current length, the byte array is truncated.
     * @version Egret 2.4
     * @platform Web,Native
     * @language en_US
     */
    /**
     * ByteArray 对象的长度（以字节为单位）。
     * 如果将长度设置为大于当前长度的值，则用零填充字节数组的右侧。
     * 如果将长度设置为小于当前长度的值，将会截断该字节数组。
     * @version Egret 2.4
     * @platform Web,Native
     * @language zh_CN
     */
    get length() {
        return this.write_position;
    }
    set length(value) {
        this.write_position = value;
        if (this.data.byteLength > value) {
            this._position = value;
        }
        this._validateBuffer(value);
    }
    _validateBuffer(value) {
        if (this.data.byteLength < value) {
            let be = this.bufferExtSize;
            let tmp;
            if (be == 0) {
                tmp = new Uint8Array(value);
            }
            else {
                let nLen = ((value / be >> 0) + 1) * be;
                tmp = new Uint8Array(nLen);
            }
            tmp.set(this._bytes);
            this._bytes = tmp;
            this.data = new DataView(tmp.buffer);
        }
    }
    /**
     * The number of bytes that can be read from the current position of the byte array to the end of the array data.
     * When you access a ByteArray object, the bytesAvailable property in conjunction with the read methods each use to make sure you are reading valid data.
     * @version Egret 2.4
     * @platform Web,Native
     * @language en_US
     */
    /**
     * 可从字节数组的当前位置到数组末尾读取的数据的字节数。
     * 每次访问 ByteArray 对象时，将 bytesAvailable 属性与读取方法结合使用，以确保读取有效的数据。
     * @version Egret 2.4
     * @platform Web,Native
     * @language zh_CN
     */
    get bytesAvailable() {
        return this.data.byteLength - this._position;
    }
    /**
     * Clears the contents of the byte array and resets the length and position properties to 0.
     * @version Egret 2.4
     * @platform Web,Native
     * @language en_US
     */
    /**
     * 清除字节数组的内容，并将 length 和 position 属性重置为 0。
     * @version Egret 2.4
     * @platform Web,Native
     * @language zh_CN
     */
    clear() {
        let buffer = new ArrayBuffer(this.bufferExtSize);
        this.data = new DataView(buffer);
        this._bytes = new Uint8Array(buffer);
        this._position = 0;
        this.write_position = 0;
    }
    /**
     * Read a Boolean value from the byte stream. Read a simple byte. If the byte is non-zero, it returns true; otherwise, it returns false.
     * @return If the byte is non-zero, it returns true; otherwise, it returns false.
     * @version Egret 2.4
     * @platform Web,Native
     * @language en_US
     */
    /**
     * 从字节流中读取布尔值。读取单个字节，如果字节非零，则返回 true，否则返回 false
     * @return 如果字节不为零，则返回 true，否则返回 false
     * @version Egret 2.4
     * @platform Web,Native
     * @language zh_CN
     */
    readBoolean() {
        if (this.validate(1 /* ByteArraySize.SIZE_OF_BOOLEAN */))
            return !!this._bytes[this.position++];
    }
    /**
     * Read signed bytes from the byte stream.
     * @return An integer ranging from -128 to 127
     * @version Egret 2.4
     * @platform Web,Native
     * @language en_US
     */
    /**
     * 从字节流中读取带符号的字节
     * @return 介于 -128 和 127 之间的整数
     * @version Egret 2.4
     * @platform Web,Native
     * @language zh_CN
     */
    readByte() {
        if (this.validate(1 /* ByteArraySize.SIZE_OF_INT8 */))
            return this.data.getInt8(this.position++);
    }
    /**
     * Read data byte number specified by the length parameter from the byte stream. Starting from the position specified by offset, read bytes into the ByteArray object specified by the bytes parameter, and write bytes into the target ByteArray
     * @param bytes ByteArray object that data is read into
     * @param offset Offset (position) in bytes. Read data should be written from this position
     * @param length Byte number to be read Default value 0 indicates reading all available data
     * @version Egret 2.4
     * @platform Web,Native
     * @language en_US
     */
    /**
     * 从字节流中读取 length 参数指定的数据字节数。从 offset 指定的位置开始，将字节读入 bytes 参数指定的 ByteArray 对象中，并将字节写入目标 ByteArray 中
     * @param bytes 要将数据读入的 ByteArray 对象
     * @param offset bytes 中的偏移（位置），应从该位置写入读取的数据
     * @param length 要读取的字节数。默认值 0 导致读取所有可用的数据
     * @version Egret 2.4
     * @platform Web,Native
     * @language zh_CN
     */
    readBytes(bytes, offset = 0, length = 0) {
        if (!bytes) { //由于bytes不返回，所以new新的无意义
            return;
        }
        let pos = this._position;
        let available = this.write_position - pos;
        if (available < 0) {
            console.error(1025);
            return;
        }
        if (length == 0) {
            length = available;
        }
        else if (length > available) {
            console.error(1025);
            return;
        }
        const position = bytes._position;
        bytes._position = 0;
        bytes.validateBuffer(offset + length);
        bytes._position = position;
        bytes._bytes.set(this._bytes.subarray(pos, pos + length), offset);
        this.position += length;
    }
    /**
     * Read an IEEE 754 double-precision (64 bit) floating point number from the byte stream
     * @return Double-precision (64 bit) floating point number
     * @version Egret 2.4
     * @platform Web,Native
     * @language en_US
     */
    /**
     * 从字节流中读取一个 IEEE 754 双精度（64 位）浮点数
     * @return 双精度（64 位）浮点数
     * @version Egret 2.4
     * @platform Web,Native
     * @language zh_CN
     */
    readDouble() {
        if (this.validate(8 /* ByteArraySize.SIZE_OF_FLOAT64 */)) {
            let value = this.data.getFloat64(this._position, this.$endian == 0 /* EndianConst.LITTLE_ENDIAN */);
            this.position += 8 /* ByteArraySize.SIZE_OF_FLOAT64 */;
            return value;
        }
    }
    /**
     * Read an IEEE 754 single-precision (32 bit) floating point number from the byte stream
     * @return Single-precision (32 bit) floating point number
     * @version Egret 2.4
     * @platform Web,Native
     * @language en_US
     */
    /**
     * 从字节流中读取一个 IEEE 754 单精度（32 位）浮点数
     * @return 单精度（32 位）浮点数
     * @version Egret 2.4
     * @platform Web,Native
     * @language zh_CN
     */
    readFloat() {
        if (this.validate(4 /* ByteArraySize.SIZE_OF_FLOAT32 */)) {
            let value = this.data.getFloat32(this._position, this.$endian == 0 /* EndianConst.LITTLE_ENDIAN */);
            this.position += 4 /* ByteArraySize.SIZE_OF_FLOAT32 */;
            return value;
        }
    }
    /**
     * Read a 32-bit signed integer from the byte stream.
     * @return A 32-bit signed integer ranging from -2147483648 to 2147483647
     * @version Egret 2.4
     * @platform Web,Native
     * @language en_US
     */
    /**
     * 从字节流中读取一个带符号的 32 位整数
     * @return 介于 -2147483648 和 2147483647 之间的 32 位带符号整数
     * @version Egret 2.4
     * @platform Web,Native
     * @language zh_CN
     */
    readInt() {
        if (this.validate(4 /* ByteArraySize.SIZE_OF_INT32 */)) {
            let value = this.data.getInt32(this._position, this.$endian == 0 /* EndianConst.LITTLE_ENDIAN */);
            this.position += 4 /* ByteArraySize.SIZE_OF_INT32 */;
            return value;
        }
    }
    /**
     * Read a 16-bit signed integer from the byte stream.
     * @return A 16-bit signed integer ranging from -32768 to 32767
     * @version Egret 2.4
     * @platform Web,Native
     * @language en_US
     */
    /**
     * 从字节流中读取一个带符号的 16 位整数
     * @return 介于 -32768 和 32767 之间的 16 位带符号整数
     * @version Egret 2.4
     * @platform Web,Native
     * @language zh_CN
     */
    readShort() {
        if (this.validate(2 /* ByteArraySize.SIZE_OF_INT16 */)) {
            let value = this.data.getInt16(this._position, this.$endian == 0 /* EndianConst.LITTLE_ENDIAN */);
            this.position += 2 /* ByteArraySize.SIZE_OF_INT16 */;
            return value;
        }
    }
    /**
     * Read unsigned bytes from the byte stream.
     * @return A unsigned integer ranging from 0 to 255
     * @version Egret 2.4
     * @platform Web,Native
     * @language en_US
     */
    /**
     * 从字节流中读取无符号的字节
     * @return 介于 0 和 255 之间的无符号整数
     * @version Egret 2.4
     * @platform Web,Native
     * @language zh_CN
     */
    readUnsignedByte() {
        if (this.validate(1 /* ByteArraySize.SIZE_OF_UINT8 */))
            return this._bytes[this.position++];
    }
    /**
     * Read a 32-bit unsigned integer from the byte stream.
     * @return A 32-bit unsigned integer ranging from 0 to 4294967295
     * @version Egret 2.4
     * @platform Web,Native
     * @language en_US
     */
    /**
     * 从字节流中读取一个无符号的 32 位整数
     * @return 介于 0 和 4294967295 之间的 32 位无符号整数
     * @version Egret 2.4
     * @platform Web,Native
     * @language zh_CN
     */
    readUnsignedInt() {
        if (this.validate(4 /* ByteArraySize.SIZE_OF_UINT32 */)) {
            let value = this.data.getUint32(this._position, this.$endian == 0 /* EndianConst.LITTLE_ENDIAN */);
            this.position += 4 /* ByteArraySize.SIZE_OF_UINT32 */;
            return value;
        }
    }
    /**
     * Read a 16-bit unsigned integer from the byte stream.
     * @return A 16-bit unsigned integer ranging from 0 to 65535
     * @version Egret 2.4
     * @platform Web,Native
     * @language en_US
     */
    /**
     * 从字节流中读取一个无符号的 16 位整数
     * @return 介于 0 和 65535 之间的 16 位无符号整数
     * @version Egret 2.4
     * @platform Web,Native
     * @language zh_CN
     */
    readUnsignedShort() {
        if (this.validate(2 /* ByteArraySize.SIZE_OF_UINT16 */)) {
            let value = this.data.getUint16(this._position, this.$endian == 0 /* EndianConst.LITTLE_ENDIAN */);
            this.position += 2 /* ByteArraySize.SIZE_OF_UINT16 */;
            return value;
        }
    }
    /**
     * Read a UTF-8 character string from the byte stream Assume that the prefix of the character string is a short unsigned integer (use byte to express length)
     * @return UTF-8 character string
     * @version Egret 2.4
     * @platform Web,Native
     * @language en_US
     */
    /**
     * 从字节流中读取一个 UTF-8 字符串。假定字符串的前缀是无符号的短整型（以字节表示长度）
     * @return UTF-8 编码的字符串
     * @version Egret 2.4
     * @platform Web,Native
     * @language zh_CN
     */
    readUTF() {
        let length = this.readUnsignedShort();
        if (length > 0) {
            return this.readUTFBytes(length);
        }
        else {
            return "";
        }
    }
    /**
     * Read a UTF-8 byte sequence specified by the length parameter from the byte stream, and then return a character string
     * @param Specify a short unsigned integer of the UTF-8 byte length
     * @return A character string consists of UTF-8 bytes of the specified length
     * @version Egret 2.4
     * @platform Web,Native
     * @language en_US
     */
    /**
     * 从字节流中读取一个由 length 参数指定的 UTF-8 字节序列，并返回一个字符串
     * @param length 指明 UTF-8 字节长度的无符号短整型数
     * @return 由指定长度的 UTF-8 字节组成的字符串
     * @version Egret 2.4
     * @platform Web,Native
     * @language zh_CN
     */
    readUTFBytes(length) {
        if (!this.validate(length)) {
            return;
        }
        let data = this.data;
        let bytes = new Uint8Array(data.buffer, data.byteOffset + this._position, length);
        this.position += length;
        return this.decodeUTF8(bytes);
    }
    /**
     * Write a Boolean value. A single byte is written according to the value parameter. If the value is true, write 1; if the value is false, write 0.
     * @param value A Boolean value determining which byte is written. If the value is true, write 1; if the value is false, write 0.
     * @version Egret 2.4
     * @platform Web,Native
     * @language en_US
     */
    /**
     * 写入布尔值。根据 value 参数写入单个字节。如果为 true，则写入 1，如果为 false，则写入 0
     * @param value 确定写入哪个字节的布尔值。如果该参数为 true，则该方法写入 1；如果该参数为 false，则该方法写入 0
     * @version Egret 2.4
     * @platform Web,Native
     * @language zh_CN
     */
    writeBoolean(value) {
        this.validateBuffer(1 /* ByteArraySize.SIZE_OF_BOOLEAN */);
        this._bytes[this.position++] = +value;
    }
    /**
     * Write a byte into the byte stream
     * The low 8 bits of the parameter are used. The high 24 bits are ignored.
     * @param value A 32-bit integer. The low 8 bits will be written into the byte stream
     * @version Egret 2.4
     * @platform Web,Native
     * @language en_US
     */
    /**
     * 在字节流中写入一个字节
     * 使用参数的低 8 位。忽略高 24 位
     * @param value 一个 32 位整数。低 8 位将被写入字节流
     * @version Egret 2.4
     * @platform Web,Native
     * @language zh_CN
     */
    writeByte(value) {
        this.validateBuffer(1 /* ByteArraySize.SIZE_OF_INT8 */);
        this._bytes[this.position++] = value & 0xff;
    }
    /**
     * Write the byte sequence that includes length bytes in the specified byte array, bytes, (starting at the byte specified by offset, using a zero-based index), into the byte stream
     * If the length parameter is omitted, the default length value 0 is used and the entire buffer starting at offset is written. If the offset parameter is also omitted, the entire buffer is written
     * If the offset or length parameter is out of range, they are clamped to the beginning and end of the bytes array.
     * @param bytes ByteArray Object
     * @param offset A zero-based index specifying the position into the array to begin writing
     * @param length An unsigned integer specifying how far into the buffer to write
     * @version Egret 2.4
     * @platform Web,Native
     * @language en_US
     */
    /**
     * 将指定字节数组 bytes（起始偏移量为 offset，从零开始的索引）中包含 length 个字节的字节序列写入字节流
     * 如果省略 length 参数，则使用默认长度 0；该方法将从 offset 开始写入整个缓冲区。如果还省略了 offset 参数，则写入整个缓冲区
     * 如果 offset 或 length 超出范围，它们将被锁定到 bytes 数组的开头和结尾
     * @param bytes ByteArray 对象
     * @param offset 从 0 开始的索引，表示在数组中开始写入的位置
     * @param length 一个无符号整数，表示在缓冲区中的写入范围
     * @version Egret 2.4
     * @platform Web,Native
     * @language zh_CN
     */
    writeBytes(bytes, offset = 0, length = 0) {
        let writeLength;
        if (offset < 0) {
            return;
        }
        if (length < 0) {
            return;
        }
        else if (length == 0) {
            writeLength = bytes.length - offset;
        }
        else {
            writeLength = Math.min(bytes.length - offset, length);
        }
        if (writeLength > 0) {
            this.validateBuffer(writeLength);
            this._bytes.set(bytes._bytes.subarray(offset, offset + writeLength), this._position);
            this.position = this._position + writeLength;
        }
    }
    /**
     * Write an IEEE 754 double-precision (64 bit) floating point number into the byte stream
     * @param value Double-precision (64 bit) floating point number
     * @version Egret 2.4
     * @platform Web,Native
     * @language en_US
     */
    /**
     * 在字节流中写入一个 IEEE 754 双精度（64 位）浮点数
     * @param value 双精度（64 位）浮点数
     * @version Egret 2.4
     * @platform Web,Native
     * @language zh_CN
     */
    writeDouble(value) {
        this.validateBuffer(8 /* ByteArraySize.SIZE_OF_FLOAT64 */);
        this.data.setFloat64(this._position, value, this.$endian == 0 /* EndianConst.LITTLE_ENDIAN */);
        this.position += 8 /* ByteArraySize.SIZE_OF_FLOAT64 */;
    }
    /**
     * Write an IEEE 754 single-precision (32 bit) floating point number into the byte stream
     * @param value Single-precision (32 bit) floating point number
     * @version Egret 2.4
     * @platform Web,Native
     * @language en_US
     */
    /**
     * 在字节流中写入一个 IEEE 754 单精度（32 位）浮点数
     * @param value 单精度（32 位）浮点数
     * @version Egret 2.4
     * @platform Web,Native
     * @language zh_CN
     */
    writeFloat(value) {
        this.validateBuffer(4 /* ByteArraySize.SIZE_OF_FLOAT32 */);
        this.data.setFloat32(this._position, value, this.$endian == 0 /* EndianConst.LITTLE_ENDIAN */);
        this.position += 4 /* ByteArraySize.SIZE_OF_FLOAT32 */;
    }
    /**
     * Write a 32-bit signed integer into the byte stream
     * @param value An integer to be written into the byte stream
     * @version Egret 2.4
     * @platform Web,Native
     * @language en_US
     */
    /**
     * 在字节流中写入一个带符号的 32 位整数
     * @param value 要写入字节流的整数
     * @version Egret 2.4
     * @platform Web,Native
     * @language zh_CN
     */
    writeInt(value) {
        this.validateBuffer(4 /* ByteArraySize.SIZE_OF_INT32 */);
        this.data.setInt32(this._position, value, this.$endian == 0 /* EndianConst.LITTLE_ENDIAN */);
        this.position += 4 /* ByteArraySize.SIZE_OF_INT32 */;
    }
    /**
     * Write a 16-bit integer into the byte stream. The low 16 bits of the parameter are used. The high 16 bits are ignored.
     * @param value A 32-bit integer. Its low 16 bits will be written into the byte stream
     * @version Egret 2.4
     * @platform Web,Native
     * @language en_US
     */
    /**
     * 在字节流中写入一个 16 位整数。使用参数的低 16 位。忽略高 16 位
     * @param value 32 位整数，该整数的低 16 位将被写入字节流
     * @version Egret 2.4
     * @platform Web,Native
     * @language zh_CN
     */
    writeShort(value) {
        this.validateBuffer(2 /* ByteArraySize.SIZE_OF_INT16 */);
        this.data.setInt16(this._position, value, this.$endian == 0 /* EndianConst.LITTLE_ENDIAN */);
        this.position += 2 /* ByteArraySize.SIZE_OF_INT16 */;
    }
    /**
     * Write a 32-bit unsigned integer into the byte stream
     * @param value An unsigned integer to be written into the byte stream
     * @version Egret 2.4
     * @platform Web,Native
     * @language en_US
     */
    /**
     * 在字节流中写入一个无符号的 32 位整数
     * @param value 要写入字节流的无符号整数
     * @version Egret 2.4
     * @platform Web,Native
     * @language zh_CN
     */
    writeUnsignedInt(value) {
        this.validateBuffer(4 /* ByteArraySize.SIZE_OF_UINT32 */);
        this.data.setUint32(this._position, value, this.$endian == 0 /* EndianConst.LITTLE_ENDIAN */);
        this.position += 4 /* ByteArraySize.SIZE_OF_UINT32 */;
    }
    /**
     * Write a 16-bit unsigned integer into the byte stream
     * @param value An unsigned integer to be written into the byte stream
     * @version Egret 2.5
     * @platform Web,Native
     * @language en_US
     */
    /**
     * 在字节流中写入一个无符号的 16 位整数
     * @param value 要写入字节流的无符号整数
     * @version Egret 2.5
     * @platform Web,Native
     * @language zh_CN
     */
    writeUnsignedShort(value) {
        this.validateBuffer(2 /* ByteArraySize.SIZE_OF_UINT16 */);
        this.data.setUint16(this._position, value, this.$endian == 0 /* EndianConst.LITTLE_ENDIAN */);
        this.position += 2 /* ByteArraySize.SIZE_OF_UINT16 */;
    }
    /**
     * Write a UTF-8 string into the byte stream. The length of the UTF-8 string in bytes is written first, as a 16-bit integer, followed by the bytes representing the characters of the string
     * @param value Character string value to be written
     * @version Egret 2.4
     * @platform Web,Native
     * @language en_US
     */
    /**
     * 将 UTF-8 字符串写入字节流。先写入以字节表示的 UTF-8 字符串长度（作为 16 位整数），然后写入表示字符串字符的字节
     * @param value 要写入的字符串值
     * @version Egret 2.4
     * @platform Web,Native
     * @language zh_CN
     */
    writeUTF(value) {
        let utf8bytes = this.encodeUTF8(value);
        let length = utf8bytes.length;
        this.validateBuffer(2 /* ByteArraySize.SIZE_OF_UINT16 */ + length);
        this.data.setUint16(this._position, length, this.$endian == 0 /* EndianConst.LITTLE_ENDIAN */);
        this.position += 2 /* ByteArraySize.SIZE_OF_UINT16 */;
        this._writeUint8Array(utf8bytes, false);
    }
    /**
     * Write a UTF-8 string into the byte stream. Similar to the writeUTF() method, but the writeUTFBytes() method does not prefix the string with a 16-bit length word
     * @param value Character string value to be written
     * @version Egret 2.4
     * @platform Web,Native
     * @language en_US
     */
    /**
     * 将 UTF-8 字符串写入字节流。类似于 writeUTF() 方法，但 writeUTFBytes() 不使用 16 位长度的词为字符串添加前缀
     * @param value 要写入的字符串值
     * @version Egret 2.4
     * @platform Web,Native
     * @language zh_CN
     */
    writeUTFBytes(value) {
        this._writeUint8Array(this.encodeUTF8(value));
    }
    /**
     *
     * @returns
     * @version Egret 2.4
     * @platform Web,Native
     */
    toString() {
        return "[ByteArray] length:" + this.length + ", bytesAvailable:" + this.bytesAvailable;
    }
    /**
     * @private
     * 将 Uint8Array 写入字节流
     * @param bytes 要写入的Uint8Array
     * @param validateBuffer
     */
    _writeUint8Array(bytes, validateBuffer = true) {
        let pos = this._position;
        let npos = pos + bytes.length;
        if (validateBuffer) {
            this.validateBuffer(npos);
        }
        this.bytes.set(bytes, pos);
        this.position = npos;
    }
    /**
     * @param len
     * @returns
     * @version Egret 2.4
     * @platform Web,Native
     * @private
     */
    validate(len) {
        let bl = this._bytes.length;
        if (bl > 0 && this._position + len <= bl) {
            return true;
        }
        else {
            console.error(1025);
        }
    }
    /**********************/
    /*  PRIVATE METHODS   */
    /**********************/
    /**
     * @private
     * @param len
     * @param needReplace
     */
    validateBuffer(len) {
        this.write_position = len > this.write_position ? len : this.write_position;
        len += this._position;
        this._validateBuffer(len);
    }
    /**
     * @private
     * UTF-8 Encoding/Decoding
     */
    encodeUTF8(str) {
        let pos = 0;
        let codePoints = this.stringToCodePoints(str);
        let outputBytes = [];
        while (codePoints.length > pos) {
            let code_point = codePoints[pos++];
            if (this.inRange(code_point, 0xD800, 0xDFFF)) {
                this.encoderError(code_point);
            }
            else if (this.inRange(code_point, 0x0000, 0x007f)) {
                outputBytes.push(code_point);
            }
            else {
                let count, offset;
                if (this.inRange(code_point, 0x0080, 0x07FF)) {
                    count = 1;
                    offset = 0xC0;
                }
                else if (this.inRange(code_point, 0x0800, 0xFFFF)) {
                    count = 2;
                    offset = 0xE0;
                }
                else if (this.inRange(code_point, 0x10000, 0x10FFFF)) {
                    count = 3;
                    offset = 0xF0;
                }
                outputBytes.push(this.div(code_point, Math.pow(64, count)) + offset);
                while (count > 0) {
                    let temp = this.div(code_point, Math.pow(64, count - 1));
                    outputBytes.push(0x80 + (temp % 64));
                    count -= 1;
                }
            }
        }
        return new Uint8Array(outputBytes);
    }
    /**
     * @private
     *
     * @param data
     * @returns
     */
    decodeUTF8(data) {
        let fatal = false;
        let pos = 0;
        let result = "";
        let code_point;
        let utf8_code_point = 0;
        let utf8_bytes_needed = 0;
        let utf8_bytes_seen = 0;
        let utf8_lower_boundary = 0;
        while (data.length > pos) {
            let _byte = data[pos++];
            if (_byte == this.EOF_byte) {
                if (utf8_bytes_needed != 0) {
                    code_point = this.decoderError(fatal);
                }
                else {
                    code_point = this.EOF_code_point;
                }
            }
            else {
                if (utf8_bytes_needed == 0) {
                    if (this.inRange(_byte, 0x00, 0x7F)) {
                        code_point = _byte;
                    }
                    else {
                        if (this.inRange(_byte, 0xC2, 0xDF)) {
                            utf8_bytes_needed = 1;
                            utf8_lower_boundary = 0x80;
                            utf8_code_point = _byte - 0xC0;
                        }
                        else if (this.inRange(_byte, 0xE0, 0xEF)) {
                            utf8_bytes_needed = 2;
                            utf8_lower_boundary = 0x800;
                            utf8_code_point = _byte - 0xE0;
                        }
                        else if (this.inRange(_byte, 0xF0, 0xF4)) {
                            utf8_bytes_needed = 3;
                            utf8_lower_boundary = 0x10000;
                            utf8_code_point = _byte - 0xF0;
                        }
                        else {
                            this.decoderError(fatal);
                        }
                        utf8_code_point = utf8_code_point * Math.pow(64, utf8_bytes_needed);
                        code_point = null;
                    }
                }
                else if (!this.inRange(_byte, 0x80, 0xBF)) {
                    utf8_code_point = 0;
                    utf8_bytes_needed = 0;
                    utf8_bytes_seen = 0;
                    utf8_lower_boundary = 0;
                    pos--;
                    code_point = this.decoderError(fatal, _byte);
                }
                else {
                    utf8_bytes_seen += 1;
                    utf8_code_point = utf8_code_point + (_byte - 0x80) * Math.pow(64, utf8_bytes_needed - utf8_bytes_seen);
                    if (utf8_bytes_seen !== utf8_bytes_needed) {
                        code_point = null;
                    }
                    else {
                        let cp = utf8_code_point;
                        let lower_boundary = utf8_lower_boundary;
                        utf8_code_point = 0;
                        utf8_bytes_needed = 0;
                        utf8_bytes_seen = 0;
                        utf8_lower_boundary = 0;
                        if (this.inRange(cp, lower_boundary, 0x10FFFF) && !this.inRange(cp, 0xD800, 0xDFFF)) {
                            code_point = cp;
                        }
                        else {
                            code_point = this.decoderError(fatal, _byte);
                        }
                    }
                }
            }
            //Decode string
            if (code_point !== null && code_point !== this.EOF_code_point) {
                if (code_point <= 0xFFFF) {
                    if (code_point > 0)
                        result += String.fromCharCode(code_point);
                }
                else {
                    code_point -= 0x10000;
                    result += String.fromCharCode(0xD800 + ((code_point >> 10) & 0x3ff));
                    result += String.fromCharCode(0xDC00 + (code_point & 0x3ff));
                }
            }
        }
        return result;
    }
    /**
     * @private
     *
     * @param code_point
     */
    encoderError(code_point) {
        console.error(1026, code_point);
    }
    /**
     * @private
     *
     * @param fatal
     * @param opt_code_point
     * @returns
     */
    decoderError(fatal, opt_code_point) {
        if (fatal) {
            console.error(1027);
        }
        return opt_code_point || 0xFFFD;
    }
    /**
     * @private
     *
     * @param a
     * @param min
     * @param max
     */
    inRange(a, min, max) {
        return min <= a && a <= max;
    }
    /**
     * @private
     *
     * @param n
     * @param d
     */
    div(n, d) {
        return Math.floor(n / d);
    }
    /**
     * @private
     *
     * @param string
     */
    stringToCodePoints(str) {
        /** @type {Array.<number>} */
        let cps = [];
        // Based on http://www.w3.org/TR/WebIDL/#idl-DOMString
        let i = 0, n = str.length;
        while (i < str.length) {
            let c = str.charCodeAt(i);
            if (!this.inRange(c, 0xD800, 0xDFFF)) {
                cps.push(c);
            }
            else if (this.inRange(c, 0xDC00, 0xDFFF)) {
                cps.push(0xFFFD);
            }
            else { // (inRange(c, 0xD800, 0xDBFF))
                if (i == n - 1) {
                    cps.push(0xFFFD);
                }
                else {
                    let d = str.charCodeAt(i + 1);
                    if (this.inRange(d, 0xDC00, 0xDFFF)) {
                        let a = c & 0x3FF;
                        let b = d & 0x3FF;
                        i += 1;
                        cps.push(0x10000 + (a << 10) + b);
                    }
                    else {
                        cps.push(0xFFFD);
                    }
                }
            }
            i += 1;
        }
        return cps;
    }
}

/**
 * 列表
 */
class List extends EventDispatcher {
    constructor(only = true) {
        super();
        /**
         * 是否保证元素的唯一性
         */
        this.__only = false;
        /**
         * 元素数量(内部再增删时会修改这个参数，外部只做计算和绑定使用，切记不可做赋值操作！)
         */
        this.count = 0;
        this.__only = only;
        this.__element = [];
    }
    /**
     * 添加到末尾(注意如果保证唯一性，那么重复时就直接返回)
     * @param value
     */
    push(value) {
        if (this.__only) {
            let index = this.__element.indexOf(value);
            if (index >= 0) {
                return false;
            }
        }
        this.__element.push(value);
        this.count = this.__element.length;
        if (this.hasEvent(Event.ADD)) {
            this.emit(Event.ADD, value);
        }
        return true;
    }
    /**
     * 添加到列表头部(注意如果保证唯一性，那么重复时就直接返回)
     * @param value
     * @returns
     */
    unshift(value) {
        if (this.__only) {
            let index = this.__element.indexOf(value);
            if (index >= 0) {
                return false;
            }
        }
        this.__element.unshift(value);
        this.count = this.__element.length;
        if (this.hasEvent(Event.ADD)) {
            this.emit(Event.ADD, value);
        }
        return true;
    }
    /**
     * 获取并删除最后一个元素
     * @returns
     */
    pop() {
        if (this.__element.length > 0) {
            const result = this.__element.pop();
            this.count = this.__element.length;
            if (this.hasEvent(Event.REMOVE)) {
                this.emit(Event.REMOVE, result);
            }
            return result;
        }
        return null;
    }
    /**
     * 获取并删除第一个元素
     * @returns
     */
    shift() {
        if (this.__element.length > 0) {
            const result = this.__element.shift();
            this.count = this.__element.length;
            if (this.hasEvent(Event.REMOVE)) {
                this.emit(Event.REMOVE, result);
            }
            return result;
        }
        return null;
    }
    /**
     * 删除指定索引的元素
     * @param index
     */
    removeAt(index) {
        if (index >= this.__element.length) {
            throw new Error("删除索引超出范围！");
        }
        const result = this.__element[index];
        this.__element.splice(index, 1);
        this.count = this.__element.length;
        if (this.hasEvent(Event.REMOVE)) {
            this.emit(Event.REMOVE, result);
        }
        return result;
    }
    /**
     * 删除元素
     * @param value
     */
    remove(value) {
        let index = this.__element.indexOf(value);
        if (index < 0) {
            throw new Error("要删除的内容不在列表中！" + value);
        }
        const result = this.__element[index];
        this.__element.splice(index, 1);
        this.count = this.__element.length;
        if (this.hasEvent(Event.REMOVE)) {
            this.emit(Event.REMOVE, result);
        }
    }
    /**
     * 移除所有元素
     */
    clear() {
        this.count = 0;
        this.__element.length = 0;
        if (this.hasEvent(Event.CLEAR)) {
            this.emit(Event.CLEAR);
        }
    }
    /**
     * 判断是否包含
     * @param value
     * @returns
     */
    has(value) {
        return this.find(value) >= 0;
    }
    /**
     * 查找元素下标
     * @param value
     * @returns
     */
    find(value) {
        return this.__element.indexOf(value);
    }
    /**
     * 查找元素下标
     * @param predicate
     * @returns
     */
    findIndex(predicate) {
        let index = this.__element.findIndex(predicate);
        return index;
    }
    /**
     * 获取指定元素
     * @param index
     * @returns
     */
    get(index) {
        if (index >= this.__element.length) {
            throw new Error("超出索引范围:" + index + "/" + this.__element.length);
        }
        return this.__element[index];
    }
    /**
     * 源列表数据(注意不要直接进行增删操作，而是通过List.push....等接口进行操作)
     */
    get elements() {
        return this.__element;
    }
}

/**
 * 函数钩子信息
 */
class FunctionHookInfo {
    equal(functionName, preHandler, laterHandler) {
        if (this.functionName != functionName) {
            return false;
        }
        if (!preHandler.equal(this.preHandler)) {
            return false;
        }
        if (!laterHandler.equal(this.laterHandler)) {
            return false;
        }
        return true;
    }
}
class FunctionHook {
    constructor(data) {
        this.data = data;
        this.__functions = [];
        this.__preHandlerMap = new Map();
        this.__laterHandlerMap = new Map();
        this.__groupMap = new Map();
    }
    /**
     * 添加钩子
     * @param group
     * @param functionName
     * @param preHandlers
     * @param laterHandlers
     */
    addHook(group, functionName, preHandler, laterHandler) {
        let groupList = this.__groupMap.get(group);
        if (!groupList) {
            groupList = [];
            this.__groupMap.set(group, groupList);
        }
        for (let index = 0; index < groupList.length; index++) {
            const element = groupList[index];
            if (element.equal(functionName, preHandler, laterHandler)) {
                //重复添加
                return;
            }
        }
        let info = new FunctionHookInfo();
        info.functionName = functionName;
        info.preHandler = preHandler;
        info.laterHandler = laterHandler;
        groupList.push(info);
        //如果没有添加好钩子
        if (this.__functions.indexOf(functionName) < 0) {
            let oldFun = this.data[functionName];
            if (!oldFun) {
                throw new Error("方法不存在！");
            }
            let pres = this.__preHandlerMap.get(functionName);
            if (!pres) {
                pres = [];
                this.__preHandlerMap.set(functionName, pres);
            }
            let laters = this.__laterHandlerMap.get(functionName);
            if (!laters) {
                laters = [];
                this.__laterHandlerMap.set(functionName, laters);
            }
            let newFun = function (...arg) {
                //pre
                if (pres && pres.length) {
                    for (let index = 0; index < pres.length; index++) {
                        const element = pres[index];
                        element.run(arg);
                    }
                }
                //old
                oldFun(arg);
                //later
                if (laters && laters.length) {
                    for (let index = 0; index < laters.length; index++) {
                        const element = laters[index];
                        element.run(arg);
                    }
                }
            };
            this.data[functionName] = newFun;
            this.data["old_" + functionName] = oldFun;
            this.__functions.push(functionName);
        }
        let pres = this.__preHandlerMap.get(functionName);
        if (!pres) {
            pres = [];
            this.__preHandlerMap.set(functionName, pres);
        }
        if (pres.indexOf(preHandler) < 0) {
            pres.push(preHandler);
        }
        let laters = this.__laterHandlerMap.get(functionName);
        if (!laters) {
            laters = [];
            this.__laterHandlerMap.set(functionName, laters);
        }
        if (laters.indexOf(laterHandler) < 0) {
            laters.push(laterHandler);
        }
    }
    /**
     * 删除钩子
     * @param group
     * @param functionName
     * @param preHandler
     * @param laterHandler
     * @returns
     */
    removeHook(group, functionName, preHandler, laterHandler) {
        let groupList = this.__groupMap.get(group);
        if (!groupList) {
            return;
        }
        let list;
        let fIndex;
        //编组删除
        if (!functionName) {
            for (let index = 0; index < groupList.length; index++) {
                const element = groupList[index];
                //pre
                if (element.preHandler) {
                    list = this.__preHandlerMap.get(element.functionName);
                    fIndex = list.indexOf(element.preHandler);
                    if (fIndex >= 0) {
                        list.splice(fIndex, 1);
                    }
                    if (list.length == 0) {
                        this.__preHandlerMap.delete(element.functionName);
                    }
                }
                //later
                if (element.laterHandler) {
                    list = this.__laterHandlerMap.get(element.functionName);
                    fIndex = list.indexOf(element.laterHandler);
                    if (fIndex >= 0) {
                        list.splice(fIndex, 1);
                    }
                    if (list.length == 0) {
                        this.__laterHandlerMap.delete(element.functionName);
                    }
                }
            }
            groupList.length = 0;
            this.__groupMap.delete(group);
            return;
        }
        for (let index = 0; index < groupList.length; index++) {
            const element = groupList[index];
            if (element.equal(functionName, preHandler, laterHandler)) {
                //删除
                groupList.splice(index, 1);
                //pre
                if (element.preHandler) {
                    list = this.__preHandlerMap.get(functionName);
                    fIndex = list.indexOf(element.preHandler);
                    if (fIndex >= 0) {
                        list.splice(fIndex, 1);
                    }
                }
                //later
                if (element.laterHandler) {
                    list = this.__laterHandlerMap.get(functionName);
                    fIndex = list.indexOf(element.laterHandler);
                    if (fIndex >= 0) {
                        list.splice(fIndex, 1);
                    }
                }
                return;
            }
        }
    }
}

/**
 * 默认的ticker管理器实现
 */
class TickerManagerImpl {
    constructor() {
        this.__tickerRoot = find("TickerManager");
        if (!this.__tickerRoot) {
            this.__tickerRoot = new Node("TickerManager");
            director.getScene().addChild(this.__tickerRoot);
        }
        this.__tickerManager = this.__tickerRoot.addComponent(TickManagerComponent);
    }
    addTicker(value) {
        this.__tickerManager.addTicker(value);
    }
    removeTicker(value) {
        this.__tickerManager.removeTicker(value);
    }
    callNextFrame(value, caller) {
        this.__tickerManager.callNextFrame(value, caller);
    }
    clearNextFrame(value, caller) {
        this.__tickerManager.clearNextFrame(value, caller);
    }
}
class TickManagerComponent extends Component$1 {
    constructor() {
        super(...arguments);
        this.__tickerList = [];
        this.__nextFrameCallBacks = [];
    }
    update(dt) {
        let handler;
        while (this.__nextFrameCallBacks.length) {
            handler = this.__nextFrameCallBacks.shift();
            handler.callBack.apply(handler.caller);
        }
        for (let index = 0; index < this.__tickerList.length; index++) {
            const element = this.__tickerList[index];
            element.tick(dt);
        }
    }
    addTicker(value) {
        let index = this.__tickerList.indexOf(value);
        if (index >= 0) {
            throw new Error("Ticker 重复添加！");
        }
        this.__tickerList.push(value);
    }
    removeTicker(value) {
        let index = this.__tickerList.indexOf(value);
        if (index < 0) {
            throw new Error("找不到要删除的Tick！");
        }
        this.__tickerList.splice(index, 1);
    }
    callNextFrame(value, caller) {
        for (let index = 0; index < this.__nextFrameCallBacks.length; index++) {
            const element = this.__nextFrameCallBacks[index];
            //重复
            if (element.equal(value, caller)) {
                return;
            }
        }
        this.__nextFrameCallBacks.push(new NextFrameHandler(value, caller));
    }
    clearNextFrame(value, caller) {
        for (let index = 0; index < this.__nextFrameCallBacks.length; index++) {
            const element = this.__nextFrameCallBacks[index];
            //删除
            if (element.equal(value, caller)) {
                this.__nextFrameCallBacks.splice(index, 1);
            }
        }
    }
}
class NextFrameHandler {
    constructor(callBack, caller) {
        this.callBack = callBack;
        this.caller = caller;
    }
    equal(callBack, caller) {
        if (this.caller !== caller) {
            return false;
        }
        if (this.callBack !== callBack) {
            return false;
        }
        return true;
    }
}

/**
 * 心跳管理器
 */
class TickerManager {
    /**
     * 添加
     * @param value
     */
    static addTicker(value) {
        this.impl.addTicker(value);
    }
    /**
     * 删除
     * @param value
     */
    static removeTicker(value) {
        this.impl.removeTicker(value);
    }
    /**
     * 下一帧回调
     * @param value
     */
    static callNextFrame(value, caller) {
        this.impl.callNextFrame(value, caller);
    }
    static clearNextFrame(value, caller) {
        this.impl.clearNextFrame(value, caller);
    }
    static get impl() {
        if (this.__impl == null) {
            this.__impl = Injector.getInject(this.KEY);
        }
        if (this.__impl == null) {
            this.__impl = new TickerManagerImpl();
        }
        return this.__impl;
    }
}
TickerManager.KEY = "TickerManager";

/**
 * 绑定信息
 */
class BindInfo {
    constructor(property, targetOrCallBack, tPropertyOrCaller) {
        this.property = property;
        this.targetOrCallBack = targetOrCallBack;
        this.tPropertyOrCaller = tPropertyOrCaller;
    }
    /**
     * 判断是否相等
     * @param property
     * @param targetOrCallBack
     * @param tPropertyOrCaller
     * @returns
     */
    equal(property, targetOrCallBack, tPropertyOrCaller) {
        if (property == this.property && this.targetOrCallBack == targetOrCallBack && this.tPropertyOrCaller == tPropertyOrCaller) {
            return true;
        }
        return false;
    }
}
/**
 * 属性绑定器
 */
class PropertyBinder {
    constructor(data) {
        this.data = data;
        this.__propertys = [];
        this.__changedPropertys = [];
        this.__bindedMap = new Map();
        this.__bindedGroupMap = new Map();
    }
    /**
     * 绑定
     * @param group
     * @param property
     * @param targetOrCallBack
     * @param tPropertyOrCaller
     * @returns
     */
    bind(group, property, targetOrCallBack, tPropertyOrCaller) {
        let info;
        let groupList = this.__bindedGroupMap.get(group);
        if (!groupList) {
            groupList = [];
            this.__bindedGroupMap.set(group, groupList);
        }
        let exist = false;
        let bindInfos;
        if (Array.isArray(property)) {
            for (let pIndex = 0; pIndex < property.length; pIndex++) {
                const propertyKey = property[pIndex];
                this.__checkProperty(propertyKey);
                for (let index = 0; index < groupList.length; index++) {
                    info = groupList[index];
                    if (info.equal(propertyKey, targetOrCallBack, tPropertyOrCaller)) {
                        exist = true;
                        continue;
                    }
                }
                //不存在
                if (!exist) {
                    info = new BindInfo(propertyKey, targetOrCallBack, tPropertyOrCaller);
                    bindInfos = this.__bindedMap.get(propertyKey);
                    if (!bindInfos) {
                        bindInfos = [];
                        this.__bindedMap.set(propertyKey, bindInfos);
                    }
                    bindInfos.push(info);
                    groupList.push(info);
                    //标记改变
                    this.__propertyChanged(propertyKey);
                }
            }
        }
        else {
            this.__checkProperty(property);
            for (let index = 0; index < groupList.length; index++) {
                info = groupList[index];
                if (info.equal(property, targetOrCallBack, tPropertyOrCaller)) {
                    return;
                }
            }
            info = new BindInfo(property, targetOrCallBack, tPropertyOrCaller);
            bindInfos = this.__bindedMap.get(property);
            if (!bindInfos) {
                bindInfos = [];
                this.__bindedMap.set(property, bindInfos);
            }
            bindInfos.push(info);
            groupList.push(info);
            //标记改变
            this.__propertyChanged(property);
        }
    }
    /**
     * 取消绑定
     * @param group
     * @param property
     * @param targetOrCallBack
     * @param tPropertyOrCaller
     * @returns
     */
    unbind(group, property, targetOrCallBack, tPropertyOrCaller) {
        let info;
        let groupList = this.__bindedGroupMap.get(group);
        //如果记录中没有
        if (!groupList) {
            return;
        }
        let bindInfos;
        let fIndex;
        //取消所有该组的绑定
        if (property == null) {
            for (let index = 0; index < groupList.length; index++) {
                info = groupList[index];
                //从已绑定的列表中删除
                bindInfos = this.__bindedMap.get(info.property);
                if (bindInfos && bindInfos.length > 0) {
                    fIndex = bindInfos.indexOf(info);
                    if (fIndex >= 0) {
                        bindInfos.splice(fIndex, 1);
                    }
                }
                if (bindInfos.length == 0) {
                    this.__bindedMap.delete(info.property);
                }
            }
            groupList.length = 0;
            this.__bindedGroupMap.delete(group);
            return;
        }
        if (Array.isArray(property)) {
            for (let pIndex = 0; pIndex < property.length; pIndex++) {
                const propertyKey = property[pIndex];
                //从组中找相对比较快一些，因为编组列表相对数据绑定列表通常会小一些
                for (let gIndex = 0; gIndex < groupList.length; gIndex++) {
                    info = groupList[gIndex];
                    bindInfos = this.__bindedMap.get(info.property);
                    if (info.equal(propertyKey, targetOrCallBack, tPropertyOrCaller)) {
                        fIndex = bindInfos.indexOf(info);
                        if (fIndex >= 0) {
                            bindInfos.splice(fIndex, 1);
                        }
                        groupList.splice(gIndex, 1);
                        gIndex--;
                    }
                }
            }
            if (groupList.length == 0) {
                this.__bindedGroupMap.delete(group);
            }
        }
        else {
            //从组中找相对比较快一些，因为编组列表相对数据绑定列表通常会小一些
            for (let gIndex = 0; gIndex < groupList.length; gIndex++) {
                info = groupList[gIndex];
                bindInfos = this.__bindedMap.get(info.property);
                if (info.equal(property, targetOrCallBack, tPropertyOrCaller)) {
                    fIndex = bindInfos.indexOf(info);
                    if (fIndex >= 0) {
                        bindInfos.splice(fIndex, 1);
                    }
                    groupList.splice(gIndex, 1);
                    gIndex--;
                }
            }
            if (groupList.length == 0) {
                this.__bindedGroupMap.delete(group);
            }
        }
    }
    //========================================属性绑定机制实现======================================//
    /**
    * 检测属性
    * @param propertyKey
    */
    __checkProperty(propertyKey) {
        let index = this.__propertys.indexOf(propertyKey);
        //如果没有绑定过这个数据
        if (index < 0) {
            //数据绑定实现
            let value = this.data[propertyKey];
            this.__defineReactive(this.data, propertyKey, value);
            this.__propertys.push(propertyKey);
        }
    }
    /**定义 */
    __defineReactive(data, key, value) {
        let self = this;
        Object.defineProperty(data, key, {
            enumerable: true,
            configurable: true,
            get: function () {
                return value;
            },
            set: function (newValue) {
                if (value == newValue) {
                    return;
                }
                // console.log("绑定数据改变：", value, newValue);
                value = newValue;
                self.__propertyChanged(key);
            },
        });
    }
    __propertyChanged(pKey, isInit = false) {
        //标记改变
        if (this.__changedPropertys.indexOf(pKey) < 0) {
            this.__changedPropertys.push(pKey);
            TickerManager.callNextFrame(this.__nextFramePropertyUpdate, this);
        }
    }
    __nextFramePropertyUpdate(isInit = false) {
        let pKey;
        for (let propsIndex = 0; propsIndex < this.__changedPropertys.length; propsIndex++) {
            pKey = this.__changedPropertys[propsIndex];
            this.__updateProperty(pKey);
        }
        this.__changedPropertys.length = 0;
    }
    /**
     * 属性更新
     * @param pKey
     */
    __updateProperty(pKey) {
        let bindInfos = this.__bindedMap.get(pKey);
        let info;
        if (bindInfos && bindInfos.length) {
            for (let index = 0; index < bindInfos.length; index++) {
                info = bindInfos[index];
                //属性绑定
                if (typeof info.targetOrCallBack != "function") {
                    info.targetOrCallBack[info.tPropertyOrCaller] = this.data[pKey];
                }
                else { //函数绑定
                    info.targetOrCallBack.apply(info.tPropertyOrCaller, this.__changedPropertys);
                }
            }
        }
    }
}

/**
 * 绑定器工具类
 */
class BinderUtils {
    constructor() {
    }
    /**
     * 绑定
     * @param group
     * @param source
     * @param property
     * @param targetOrCallBack
     * @param tPropertyOrCaller
     */
    static bind(group, source, property, targetOrCallBack, tPropertyOrCaller) {
        let binder = source["$PropertyBinder"];
        if (!binder) {
            binder = new PropertyBinder(source);
            source["$PropertyBinder"] = binder;
        }
        binder.bind(group, property, targetOrCallBack, tPropertyOrCaller);
    }
    /**
     * 取消绑定
     * @param group
     * @param source
     * @param property
     * @param targetOrCallBack
     * @param tPropertyOrCaller
     * @returns
     */
    static unbind(group, source, property, targetOrCallBack, tPropertyOrCaller) {
        let binder = source["$PropertyBinder"];
        if (!binder) {
            return;
        }
        binder.unbind(group, property, targetOrCallBack, tPropertyOrCaller);
    }
    /**
     * 添加函数钩子
     * @param group
     * @param source
     * @param functionName
     * @param preHandler
     * @param laterHandler
     */
    static addHook(group, source, functionName, preHandler, laterHandler) {
        let hook = source["$FunctionHook"];
        if (!hook) {
            hook = new FunctionHook(source);
            source["$FunctionHook"] = hook;
        }
        hook.addHook(group, functionName, preHandler, laterHandler);
    }
    /**
     * 删除函数钩子
     * @param group
     * @param source
     * @param functionName
     * @param preHandler
     * @param laterHandler
     * @returns
     */
    static removeHook(group, source, functionName, preHandler, laterHandler) {
        let hook = source["$FunctionHook"];
        if (!hook) {
            return;
        }
        hook.removeHook(group, functionName, preHandler, laterHandler);
    }
}

/**
 * 绑定工具类
 */
class BindingUtils {
    constructor() {
        this.__bindRecords = [];
        this.__hookRecords = [];
    }
    /**
     * 数据绑定
     * @param source
     * @param property
     * @param targetOrCallBack
     * @param tPropertyKeyOrCaller
     */
    __bind(source, property, targetOrCallBack, tPropertyKeyOrCaller) {
        for (let index = 0; index < this.__bindRecords.length; index++) {
            const element = this.__bindRecords[index];
            if (element.source == source &&
                element.property == property &&
                element.targetOrCallback == targetOrCallBack &&
                element.targetPropertyOrCaller == tPropertyKeyOrCaller) {
                //重复绑定
                throw new Error("重复绑定：" + source + property + targetOrCallBack + tPropertyKeyOrCaller);
            }
        }
        this.__bindRecords.push({
            source: source,
            property: property,
            targetOrCallback: targetOrCallBack,
            targetPropertyOrCaller: tPropertyKeyOrCaller
        });
        BinderUtils.bind(this, source, property, targetOrCallBack, tPropertyKeyOrCaller);
    }
    /**
     * 取消绑定
     * @param source
     * @param property
     * @param targetOrCallBack
     * @param tPropertyKeyOrCaller
     */
    __unbind(source, property, targetOrCallBack, tPropertyKeyOrCaller) {
        for (let index = 0; index < this.__bindRecords.length; index++) {
            const element = this.__bindRecords[index];
            if (element.source == source &&
                element.property == property &&
                element.targetOrCallback == targetOrCallBack &&
                element.targetPropertyOrCaller == tPropertyKeyOrCaller) {
                this.__bindRecords.splice(index, 1);
            }
        }
        BinderUtils.unbind(this, source, property, targetOrCallBack, tPropertyKeyOrCaller);
    }
    /**
     * 添加函数钩子
     * @param source
     * @param functionName
     * @param preHandles
     * @param laterHandlers
     */
    __addHook(source, functionName, preHandle, laterHandler) {
        for (let index = 0; index < this.__hookRecords.length; index++) {
            const element = this.__hookRecords[index];
            if (element.source == source &&
                element.functionName == functionName &&
                preHandle.equal(element.preHandler) &&
                laterHandler.equal(element.laterHandler)) {
                //重复绑定
                throw new Error("重复绑定：" + source + " " + functionName);
            }
        }
        //记录
        this.__hookRecords.push({ source: source, functionName: functionName, preHandler: preHandle, laterHandler: laterHandler });
        BinderUtils.addHook(this, source, functionName, preHandle, laterHandler);
    }
    /**
     * 删除函数钩子
     * @param source
     * @param functionName
     * @param preHandle
     * @param laterHandler
     */
    __removeHook(source, functionName, preHandle, laterHandler) {
        for (let index = 0; index < this.__hookRecords.length; index++) {
            const element = this.__hookRecords[index];
            if (element.source == source &&
                element.functionName == functionName &&
                preHandle.equal(element.preHandler) &&
                laterHandler.equal(element.laterHandler)) {
                this.__hookRecords.splice(index, 1);
            }
        }
        BinderUtils.removeHook(this, source, functionName, preHandle, laterHandler);
    }
    /**
     * 属性和属性的绑定
     * @param source            数据源
     * @param property          数据源属性名
     * @param target            目标对象
     * @param targetProperty    目标对象属性名
     */
    bindAA(source, property, target, targetProperty) {
        this.__bind(source, property, target, targetProperty);
    }
    /**
     * 取消属性和属性的绑定
     * @param source
     * @param property
     * @param target
     * @param targetProperty
     */
    unbindAA(source, property, target, targetProperty) {
        this.__unbind(source, property, target, targetProperty);
    }
    /**
     * 属性和函数的绑定
     * @param source
     * @param property
     * @param callBack
     * @param caller
     */
    bindAM(source, property, callBack, caller) {
        this.__bind(source, property, callBack, caller);
    }
    /**
     * 取消属性和函数的绑定
     * @param source
     * @param propertys
     * @param callBack
     * @param caller
     */
    unbidAM(source, propertys, callBack, caller) {
        this.__unbind(source, propertys, callBack, caller);
    }
    /**
     * 函数和函数的绑定
     * @param source
     * @param functionName  目标函数
     * @param preHandle     该函数将在目标函数调用前调用
     * @param laterHandler  该函数将在目标函数调用后调用
     */
    bindMM(source, functionName, preHandle, laterHandler) {
        this.__addHook(source, functionName, preHandle, laterHandler);
    }
    /**
     * 取消方法和方法的绑定关系
     * @param source
     * @param functionName
     * @param preHandle
     * @param laterHandler
     */
    unbindMM(source, functionName, preHandle, laterHandler) {
        this.__removeHook(source, functionName, preHandle, laterHandler);
    }
    //根据记录添加绑定
    bindByRecords() {
        //bind
        for (let index = 0; index < this.__bindRecords.length; index++) {
            const element = this.__bindRecords[index];
            BinderUtils.bind(this, element.source, element.property, element.targetOrCallback, element.targetPropertyOrCaller);
        }
        //addHook
        for (let index = 0; index < this.__hookRecords.length; index++) {
            const element = this.__hookRecords[index];
            BinderUtils.addHook(this, element.source, element.functionName, element.preHandler, element.laterHandler);
        }
    }
    //根据记录删除绑定
    unbindByRecords() {
        //unbind
        for (let index = 0; index < this.__bindRecords.length; index++) {
            const element = this.__bindRecords[index];
            BinderUtils.unbind(this, element.source, element.property, element.targetOrCallback, element.targetPropertyOrCaller);
        }
        //removeHook
        for (let index = 0; index < this.__hookRecords.length; index++) {
            const element = this.__hookRecords[index];
            BinderUtils.removeHook(this, element.source, element.functionName, element.preHandler, element.laterHandler);
        }
    }
    /**
     * 销毁
     */
    destroy() {
        if (this.__hookRecords) {
            this.__hookRecords.length = 0;
            this.__hookRecords = null;
        }
        if (this.__bindRecords) {
            this.__bindRecords.length = 0;
            this.__bindRecords = null;
        }
    }
}

class TimerImpl {
    constructor() {
        this.__lastTime = 0;
        this.reset();
        TickerManager.addTicker(this);
    }
    reset() {
        //当前时间转秒
        this.__lastTime = Date.now() / 1000;
    }
    tick(dt) {
        this.__lastTime += dt;
    }
    get currentTime() {
        return this.__lastTime;
    }
    get absTime() {
        this.reset();
        return this.currentTime;
    }
}

/**
 * 时间工具类
 */
class Timer {
    /**
     * 当前时间(推荐使用)
     */
    static get currentTime() {
        return this.impl.currentTime;
    }
    /**
     * 绝对时间(注意效率较差，不推荐使用！)
     */
    static get absTime() {
        return this.impl.absTime;
    }
    /**
     * 重新校准
     * @param time  时间起点，如果不设置则获取系统当前时间点
     */
    static reset(time) {
        this.impl.reset(time);
    }
    static get impl() {
        if (this.__impl == null) {
            this.__impl = Injector.getInject(this.KEY);
        }
        if (this.__impl == null) {
            this.__impl = new TimerImpl();
        }
        return this.__impl;
    }
}
Timer.KEY = "Timer";

/**
 * 默认资源管理器
 * @internal
 */
class ResManagerImpl {
    constructor() {
        /**
         * 资源
         */
        this.__resDic = new Dictionary();
        /**
         * 等待销毁的资源
         */
        this._waitDestroy = [];
        TickerManager.addTicker(this);
    }
    tick(dt) {
        if (ResManager.AUTO_GC) {
            this.gc();
        }
    }
    addRes(value) {
        if (this.__resDic.has(value.key)) {
            throw new Error("重复添加资源！");
        }
        this.__resDic.set(value.key, value);
        //标记为待删除
        this._waitDestroy.push(value);
        value.lastOpTime = Timer.currentTime;
    }
    hasRes(key) {
        return this.__resDic.has(key);
    }
    _getRes(key) {
        return this.__resDic.get(key);
    }
    addResRef(key, refKey) {
        if (!this.__resDic.has(key)) {
            throw new Error("未找到资源：" + key);
        }
        let res = this.__resDic.get(key);
        //如果在待删除列表中
        let index = this._waitDestroy.indexOf(res);
        if (index >= 0) {
            this._waitDestroy.splice(index, 1);
        }
        //更新操作时间
        res.lastOpTime = Timer.currentTime;
        return res.addRef(refKey);
    }
    removeResRef(value) {
        if (!this.__resDic.has(value.key)) {
            throw new Error("未找到资源：" + value.key);
        }
        let res = this.__resDic.get(value.key);
        res.removeRef(value);
        if (res.refLength == 0) {
            //放入待删除列表
            this._waitDestroy.push(res);
        }
        res.lastOpTime = Timer.currentTime;
    }
    gc(ignoreTime) {
        let res;
        let currentTime = Timer.currentTime;
        for (let index = 0; index < this._waitDestroy.length; index++) {
            res = this._waitDestroy[index];
            if (res.refCount > 0) {
                continue;
            }
            //如果忽略时间机制
            if (ignoreTime == true) {
                this._waitDestroy.splice(index, 1);
                this.destroyRes(res);
                index--;
            }
            else if (currentTime - res.lastOpTime > ResManager.GC_TIME) { //超过允许的时间就回收
                this._waitDestroy.splice(index, 1);
                this.destroyRes(res);
                index--;
            }
        }
    }
    /**
     * 销毁
     * @param value
     */
    destroyRes(value) {
        this.__resDic.delete(value.key);
        value.destroy();
    }
    get resList() {
        return this.__resDic.elements;
    }
}

class ResManager {
    /**
     * 添加一个资源
     * @param value
     */
    static addRes(value) {
        this.impl.addRes(value);
    }
    /**
     * 是否包含该资源
     * @param key
     */
    static hasRes(key) {
        return this.impl.hasRes(key);
    }
    /**
     * 获取资源（内部接口）
     * @param key
     * @returns
     */
    static _getRes(key) {
        return this.impl._getRes(key);
    }
    /**
     * 添加并返回一个资源引用
     * @param key
     * @param refKey
     */
    static addResRef(key, refKey) {
        return this.impl.addResRef(key, refKey);
    }
    /**
     * 删除一个资源引用
     * @param value
     */
    static removeResRef(value) {
        return this.impl.removeResRef(value);
    }
    /**
     * 资源清理
     */
    static gc(ignoreTime) {
        return this.impl.gc(ignoreTime);
    }
    /**
     * 资源列表
     * @returns
     */
    static resList() {
        return this.impl.resList;
    }
    static get impl() {
        if (this.__impl == null) {
            this.__impl = Injector.getInject(this.KEY);
        }
        if (this.__impl == null) {
            this.__impl = new ResManagerImpl();
        }
        return this.__impl;
    }
}
ResManager.KEY = "drongo.ResManager";
/**
 * 资源保留长时间GC
 */
ResManager.GC_TIME = 15;
/**
 * 自动清理
 */
ResManager.AUTO_GC = true;

class ResRef {
    constructor() {
        /**唯一KEY */
        this.key = "";
        /**是否已释放 */
        this.__isDispose = false;
    }
    /**释放 */
    dispose() {
        if (this.__isDispose) {
            throw new Error("重复释放资源引用");
        }
        this.__isDispose = true;
        ResManager.removeResRef(this);
    }
    get isDispose() {
        return this.__isDispose;
    }
    reset() {
        this.key = "";
        this.refKey = undefined;
        this.content = null;
        this.__isDispose = false;
    }
    /**
     * 彻底销毁(注意内部接口，请勿调用)
     */
    destroy() {
        this.key = "";
        this.refKey = undefined;
        this.content = null;
    }
}

class Resource {
    constructor() {
        /**
         * 状态 0 正常 1待删除
         */
        this.state = 0;
        this.key = "";
        this.lastOpTime = 0;
        /**
         * @internal
         */
        this.__refs = [];
        this.__content = null;
    }
    reset() {
    }
    set content(value) {
        this.__content = value;
        if (this.__content instanceof Asset) {
            //防止自动回收
            this.__content.addRef();
        }
    }
    get content() {
        return this.__content;
    }
    addRef(refKey) {
        let rf = new ResRef();
        rf.key = this.key;
        rf.refKey = refKey;
        if (this.content instanceof Asset) {
            if (this.content instanceof Prefab) {
                rf.content = instantiate(this.content);
            }
            else {
                rf.content = this.content;
            }
            this.content.addRef();
        }
        else {
            rf.content = this.content;
        }
        this.__refs.push(rf);
        return rf;
    }
    removeRef(value) {
        let index = this.__refs.indexOf(value);
        if (index < 0) {
            throw new Error("未找到需要删除的引用！");
        }
        if (this.content instanceof Asset) {
            //预制体处理
            if (this.content instanceof Prefab) {
                let node = value.content;
                if (isValid(node)) {
                    node.destroy();
                }
            }
            this.content.decRef();
        }
        this.__refs.splice(index, 1);
        value.destroy();
    }
    destroy() {
        if (this.refCount > 0 || this.refLength > 0) {
            throw new Error("发现销毁资源时引用数量不为0");
        }
        //自身引用计数
        if (this.__content instanceof Asset) {
            this.__content.decRef();
            if (this.__content.refCount <= 0) {
                Debuger.log("Res", "资源销毁=>" + this.key);
                assetManager.releaseAsset(this.__content);
            }
        }
        this.key = "";
        this.__refs.length = 0;
        this.__content = null;
    }
    /**
     * 引用数量
     */
    get refCount() {
        if (this.__content instanceof Asset) {
            return this.__content.refCount - 1;
        }
        return this.__refs.length;
    }
    /**
     * 引用列表长度
     */
    get refLength() {
        return this.__refs.length;
    }
}

/**
 * 资源地址转唯一KEY
 * @param url
 * @returns
 */
function url2Key(url) {
    return ResURLUtils.url2Key(url);
}
/**
 * 唯一key转URL
 * @param key
 * @returns
 */
function key2URL(key) {
    return ResURLUtils.key2Url(key);
}
/**
 * 获取全路径
 * @param url
 * @returns
 */
function fullURL(url) {
    if (typeof url == "string") {
        return url;
    }
    if (url.type == Texture2D) {
        return url.url + "/texture";
    }
    if (url.type == SpriteFrame) {
        return url.url + "/spriteFrame";
    }
    return url.url;
}
class ResURLUtils {
    static getAssetType(key) {
        if (!this.__assetTypes.has(key)) {
            throw new Error("未找到对应资源类型：" + key);
        }
        return this.__assetTypes.get(key);
    }
    /**
     * 获取全路径
     * @param url
     * @returns
     */
    static _getURL(key) {
        let len = key.length;
        let end = len - 8;
        //texture
        let t = key.substring(end);
        if (t === "/texture") {
            return key.substring(0, end);
        }
        //spriteFrame
        end = len - 12;
        t = key.substring(end);
        if (t === "/spriteFrame") {
            return key.substring(0, end);
        }
        return key;
    }
    /**
     * 唯一key转URL
     * @param key
     * @returns
     */
    static key2Url(key) {
        if (key.indexOf("|")) {
            let arr = key.split("|");
            return { url: this._getURL(arr[0]), bundle: arr[1], type: this.getAssetType(arr[2]) };
        }
        return key;
    }
    /**
     * 资源地址转唯一KEY
     * @param url
     * @returns
     */
    static url2Key(url) {
        if (url == null || url == undefined) {
            return "";
        }
        if (typeof url == "string") {
            return url;
        }
        if (url.type == SpriteFrame) {
            return url.url + "/spriteFrame" + "|" + url.bundle + "|" + this.getClassName(url.type);
        }
        if (url.type == Texture2D) {
            return url.url + "/texture" + "|" + url.bundle + "|" + this.getClassName(url.type);
        }
        return url.url + "|" + url.bundle + "|" + this.getClassName(url.type);
    }
    static getClassName(clazz) {
        let className;
        if (typeof clazz != "string") {
            className = clazz.toString();
            className = className.replace("function ", "");
            let index = className.indexOf("()");
            if (index < 0) {
                throw new Error("获取类型名称错误：" + className);
            }
            className = className.substring(0, index);
        }
        else {
            className = clazz;
        }
        if (!this.__assetTypes.has(className)) {
            this.__assetTypes.set(className, clazz);
        }
        return className;
    }
}
ResURLUtils.__assetTypes = new Map();

var __awaiter$2 = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
class Res {
    static setResLoader(key, loader) {
        this.__loaders.set(key, loader);
    }
    static getResLoader(key) {
        if (!this.__loaders.has(key)) {
            throw new Error("未注册的加载器：" + key);
        }
        return this.__loaders.get(key);
    }
    /**
     * 获取资源引用
     * @param url
     * @param refKey    谁持有该引用
     * @param progress  进度汇报函数
     * @returns
     */
    static getResRef(url, refKey, progress) {
        return __awaiter$2(this, void 0, void 0, function* () {
            if (Array.isArray(url)) {
                throw new Error("获取资源列表请调用getResRefList或getResRefMap");
            }
            //已加载完成
            let urlKey = url2Key(url);
            if (ResManager.hasRes(urlKey)) {
                return Promise.resolve(ResManager.addResRef(urlKey, refKey));
            }
            return yield this.loadAsset(url, refKey, (childProgress) => { if (progress)
                progress(childProgress); });
        });
    }
    /**
     * 获取资源引用列表
     * @param urls
     * @param refKey
     * @param progress
     * @returns
     */
    static getResRefList(urls, refKey, progress) {
        return __awaiter$2(this, void 0, void 0, function* () {
            let tasks = [];
            let loaded = 0;
            for (let index = 0; index < urls.length; index++) {
                const url = urls[index];
                const task = yield this.loadAsset(url, refKey, (childProgress) => {
                    if (progress) {
                        progress((loaded + childProgress) / urls.length);
                    }
                });
                tasks.push(task);
            }
            return yield Promise.all(tasks);
        });
    }
    /**
     * 获取资源引用字典
     * @param urls
     * @param refKey
     * @param result
     * @param progress
     * @returns
     */
    static getResRefMap(urls, refKey, result, progress) {
        return __awaiter$2(this, void 0, void 0, function* () {
            result = result || new Map();
            let resRefs = yield this.getResRefList(urls, refKey, progress);
            for (let index = 0; index < resRefs.length; index++) {
                const element = resRefs[index];
                result.set(element.key, element);
            }
            return Promise.resolve(result);
        });
    }
    static loadAsset(url, refKey, progress) {
        return __awaiter$2(this, void 0, void 0, function* () {
            //已加载完成
            const urlKey = url2Key(url);
            if (ResManager.hasRes(urlKey)) {
                return Promise.resolve(ResManager.addResRef(urlKey, refKey));
            }
            let promise = new Promise((resolve, reject) => {
                if (typeof url == "string") {
                    throw new Error("未实现！");
                }
                let bundle = assetManager.getBundle(url.bundle);
                let loader;
                if (!bundle) {
                    assetManager.loadBundle(url.bundle, (err, bundle) => {
                        if (err) {
                            reject(err);
                            return;
                        }
                        if (typeof url.type == "string") {
                            loader = this.getResLoader(url.type);
                        }
                        else {
                            loader = this.defaultAssetLoader;
                        }
                        loader(url, bundle, refKey, progress, (err, resRef) => {
                            if (err) {
                                reject(err);
                                return;
                            }
                            resolve(resRef);
                        });
                    });
                }
                else {
                    if (typeof url.type == "string") {
                        loader = this.getResLoader(url.type);
                    }
                    else {
                        loader = this.defaultAssetLoader;
                    }
                    loader(url, bundle, refKey, progress, (err, resRef) => {
                        if (err) {
                            reject(err);
                            return;
                        }
                        resolve(resRef);
                    });
                }
            });
            return promise;
        });
    }
    /**
     * 默认加载器
     * @param url
     * @param bundle
     * @param progress
     * @param cb
     */
    static defaultAssetLoader(url, bundle, refKey, progress, cb) {
        if (typeof url == "string") {
            throw new Error("url不能为字符串" + url);
        }
        if (typeof url.type == "string") {
            throw new Error("url.type不能为字符串" + url);
        }
        bundle.load(fullURL(url), url.type, progress, (err, asset) => {
            if (err) {
                cb && cb(err);
                return;
            }
            const urlKey = url2Key(url);
            //如果已经存在
            if (ResManager.hasRes(urlKey)) {
                cb && cb(undefined, ResManager.addResRef(urlKey, refKey));
                return;
            }
            else {
                let res = new Resource();
                res.key = urlKey;
                res.content = asset;
                ResManager.addRes(res);
                cb && cb(undefined, ResManager.addResRef(urlKey, refKey));
            }
        });
    }
}
Res.__loaders = new Map();

class AudioChannel {
    constructor(node, source) {
        if (source == null) {
            source = node.addComponent(AudioSource);
        }
        this.__node = node;
        this.__source = source;
    }
    get url() {
        return this.__url;
    }
    get mute() {
        return this.__mute;
    }
    set mute(value) {
        if (this.__mute == value) {
            return;
        }
        this.__mute = value;
        if (this.__mute) {
            //记录下来
            this.__volume = this.__source.volume;
            this.__source.volume = 0;
        }
        else {
            //根据记录设置
            this.__source.volume = this.__volume;
        }
    }
    play(url, playedComplete, volume, fade, loop = false, speed = 1) {
        this.__reset();
        this.__url = url;
        this.__playedComplete = playedComplete;
        this.__isPlaying = true;
        this.__speed = speed;
        this.__loop = loop;
        if (fade) {
            if (fade.time <= 0) {
                if (this.mute) {
                    this.__volume = volume;
                }
                else {
                    this.__source.volume = volume;
                }
            }
            if (this.__fadeData == null) {
                this.__fadeData = new FadeData();
            }
            this.__fadeData.startTime = director.getTotalTime();
            this.__fadeData.startValue = fade.startVolume == undefined ? this.__source.volume : fade.startVolume;
            this.__fadeData.time = fade.time;
            this.__fadeData.endValue = volume;
            this.__fadeData.complete = fade.complete;
            this.__fadeData.completeStop = fade.completeStop;
        }
        else {
            this.__volume = volume;
        }
        //未加载完成前，音频的结束时间为无穷大
        this.__startTime = director.getTotalTime();
        this.__time = Number.MAX_VALUE;
        Res.getResRef(this.url, "AudioChannel").then((value) => {
            if (value instanceof ResRef) {
                if (this.__isPlaying == false) {
                    value.dispose();
                    return;
                }
                let resKey = url2Key(this.url);
                if (resKey != value.key) {
                    value.dispose();
                    return;
                }
                this.__ref = value;
                this.__play();
            }
        }, (reason) => {
            console.error(reason);
            this.__isPlaying = false;
            this.__source.stop();
            return;
        });
    }
    stop() {
        if (this.__source.playing) {
            this.__source.stop();
        }
        this.__isPlaying = false;
        this.__reset();
    }
    get isPlaying() {
        return this.__isPlaying || this.__source.playing;
    }
    /**
     *
     * @param time
     * @param endVolume
     * @param startVolume
     * @param complete
     * @param completeStop
     * @returns
     */
    fade(time, endVolume, startVolume, complete, completeStop) {
        if (!this.isPlaying) {
            return;
        }
        this.__paused = false;
        //立刻
        if (time <= 0) {
            if (this.mute) {
                this.__volume = endVolume;
            }
            else {
                this.__source.volume = endVolume;
            }
            if (completeStop) {
                this.stop();
                if (complete) {
                    complete();
                }
            }
        }
        else {
            if (this.__fadeData == null) {
                this.__fadeData = new FadeData();
            }
            this.__fadeData.startTime = director.getTotalTime();
            this.__fadeData.startValue = startVolume == undefined ? this.__source.volume : startVolume;
            this.__fadeData.time = time;
            this.__fadeData.endValue = endVolume;
            this.__fadeData.complete = complete;
            this.__fadeData.completeStop = completeStop;
        }
    }
    __reset() {
        this.__url = null;
        if (this.__ref) {
            this.__ref.dispose();
            this.__ref = null;
        }
        this.__isPlaying = false;
        this.__paused = false;
        this.__fadeData = null;
    }
    __clipLoaded(err, result) {
        if (err) {
            console.error(err.message);
            this.__isPlaying = false;
            this.__source.stop();
            return;
        }
        if (this.__isPlaying == false) {
            result.dispose();
            return;
        }
        let resKey = url2Key(this.url);
        if (resKey != result.key) {
            result.dispose();
            return;
        }
        this.__ref = result;
        this.__play();
    }
    __play() {
        this.__source.clip = this.__ref.content;
        this.__source.loop = this.__loop;
        this.__source.play();
        let currentTime = director.getTotalTime();
        if (this.__fadeData) {
            this.__fadeData.startTime = currentTime;
            if (this.mute) {
                this.__volume = this.__fadeData.startValue;
            }
            else {
                this.__source.volume = this.__fadeData.startValue;
            }
        }
        else {
            if (!this.mute) {
                this.__source.volume = this.__volume;
            }
            else {
                this.__source.volume = 0;
            }
        }
        this.__startTime = director.getTotalTime();
        this.__time = this.__source.duration * 1000;
        // let audio = this.__source["audio"];
        // if (audio) {
        //     if ("_element" in audio) {
        //         let element = audio["_element"];
        //         if ("_currentSource" in element) {
        //             let currentSource = element["_currentSource"];
        //             if ("playbackRate" in currentSource) {
        //                 let playbackRate = currentSource["playbackRate"];
        //                 if ("value" in playbackRate) {
        //                     playbackRate["value"] = this.__speed;
        //                 }
        //             }
        //         }
        //     }
        // }
    }
    tick(dt) {
        if (this.__paused || this.__isPlaying == false || this.__url == null) {
            return;
        }
        let currentTime = director.getTotalTime();
        let passTime;
        if (this.__fadeData) {
            passTime = currentTime - this.__fadeData.startTime;
            let value = passTime / this.__fadeData.time;
            value = value > 1 ? 1 : value;
            //音量设置
            if (!this.mute) {
                this.__source.volume = this.__fadeData.startValue + (this.__fadeData.endValue - this.__fadeData.startValue) * value;
            }
            else {
                this.__volume = this.__fadeData.startValue + (this.__fadeData.endValue - this.__fadeData.startValue) * value;
            }
            if (value == 1) {
                let complete = this.__fadeData.complete;
                if (this.__fadeData.completeStop) {
                    this.__source.stop();
                    this.__isPlaying = false;
                    this.__reset();
                }
                if (complete) {
                    complete();
                }
                this.__fadeData = null;
            }
        }
        //循环播放
        if (this.__loop) {
            return;
        }
        //检测是否结束
        passTime = currentTime - this.__startTime;
        let value = passTime / this.__time;
        if (value >= 1) {
            //播放完成
            // console.log("播放完成！"+this.__url);
            this.__source.stop();
            this.__isPlaying = false;
            if (this.__playedComplete) {
                this.__playedComplete();
            }
            this.__reset();
        }
    }
    resume() {
        if (this.__paused == false) {
            return;
        }
        let pTime = director.getTotalTime() - this.__pauseTime;
        if (this.__fadeData) {
            this.__fadeData.startTime += pTime;
        }
        this.__startTime += pTime;
        this.__source.play();
        this.__paused = false;
    }
    pause() {
        if (this.__paused) {
            return;
        }
        this.__paused = true;
        this.__pauseTime = director.getTotalTime();
        this.__source.pause();
    }
    get curVolume() {
        return this.__source.volume;
    }
}
class FadeData {
}

/**
 * cocos 音频播放管理器
 */
class AudioManagerImpl {
    constructor() {
        this.__musicChannelIndex = 0;
        this.__volume = 1;
        this.__musicVolume = 1;
        this.__musicChannels = [];
        this.__soundChannels = [];
        TickerManager.addTicker(this);
        this.__audioRoot = find("AudioManager");
        if (this.__audioRoot == null) {
            this.__audioRoot = new Node("AudioManager");
            director.getScene().addChild(this.__audioRoot);
        }
        //音乐用两个轨道来做淡入和淡出
        let channel;
        for (let index = 0; index < 2; index++) {
            channel = new AudioChannel(this.__audioRoot);
            this.__musicChannels.push(channel);
        }
    }
    /**
     * 总音量
     */
    get volume() {
        return this.__volume;
    }
    set volume(value) {
        if (this.__volume == value) {
            return;
        }
        this.__volume = value;
        let channelVolume;
        let channel;
        for (let index = 0; index < this.__musicChannels.length; index++) {
            channel = this.__musicChannels[index];
            if (channel.isPlaying) {
                channelVolume = channel.volume * this.__musicVolume * this.__volume;
                channel.fade(100, channelVolume, channel.curVolume);
            }
        }
        for (let index = 0; index < this.__soundChannels.length; index++) {
            channel = this.__soundChannels[index];
            if (channel.isPlaying) {
                channelVolume = channel.volume * this.__soundVolume * this.__volume;
                channel.fade(100, channelVolume, channel.curVolume);
            }
        }
    }
    /**
     * 音乐总音量控制
     */
    set musicVolume(value) {
        if (this.__musicVolume == value) {
            return;
        }
        this.__musicVolume = value;
        if (this.muteMusic) {
            return;
        }
        let current = this.__musicChannels[this.__musicChannelIndex];
        if (current && current.isPlaying) {
            let channelVolume = current.volume * this.__musicVolume * this.__volume;
            current.fade(100, channelVolume, current.curVolume);
        }
    }
    get musicVolume() {
        return this.__musicVolume;
    }
    /**
     * 声音总音量
     */
    get soundVolume() {
        return this.__soundVolume;
    }
    set soundVolume(value) {
        if (this.__soundVolume == value) {
            return;
        }
        this.__soundVolume = value;
        let channel;
        for (let index = 0; index < this.__soundChannels.length; index++) {
            channel = this.__soundChannels[index];
            if (channel.isPlaying) {
                let channelVolume = channel.volume * this.__soundVolume * this.__volume;
                channel.fade(100, channelVolume, channel.curVolume);
            }
        }
    }
    set mute(value) {
        if (this.__mute == value) {
            return;
        }
        this.__mute = value;
        this.__changedMutes();
    }
    get mute() {
        return this.__mute;
    }
    get muteMusic() {
        return this.__muteMusic;
    }
    set muteMusic(value) {
        if (this.__muteMusic == value) {
            return;
        }
        this.__muteMusic = value;
        this.__changedMutes();
    }
    get muteSound() {
        return this.__muteSound;
    }
    set muteSound(value) {
        if (this.__muteSound == value) {
            return;
        }
        this.__muteSound = value;
        this.__changedMutes();
    }
    __changedMutes() {
        for (let index = 0; index < this.__musicChannels.length; index++) {
            const element = this.__musicChannels[index];
            element.mute = this.muteMusic || this.mute;
        }
        for (let index = 0; index < this.__soundChannels.length; index++) {
            const element = this.__soundChannels[index];
            element.mute = this.muteSound || this.mute;
        }
    }
    playMusic(url, volume, speed, loop) {
        let playVolume;
        if (this.muteMusic || this.mute) {
            playVolume = 0;
        }
        else {
            //音量=轨道音量*音乐音量*总音量
            playVolume = volume * this.__musicVolume * this.__volume;
        }
        //正在播放的轨道
        let current = this.__musicChannels[this.__musicChannelIndex];
        if (current && current.isPlaying) {
            if (url2Key(current.url) == url2Key(url)) {
                //播放相同的音乐
                return;
            }
        }
        this.__musicChannelIndex++;
        this.__musicChannelIndex = this.__musicChannelIndex % 2;
        let last;
        if (this.__musicChannelIndex == 0) {
            current = this.__musicChannels[0];
            last = this.__musicChannels[1];
        }
        else {
            current = this.__musicChannels[1];
            last = this.__musicChannels[0];
        }
        if (last.isPlaying) {
            last.fade(500, 0, undefined, null, true);
        }
        current.volume = volume;
        current.play(url, null, playVolume, { time: 500, startVolume: 0 }, true, speed);
    }
    stopMusic() {
        let current = this.__musicChannels[this.__musicChannelIndex];
        if (current && current.isPlaying) {
            current.stop();
        }
    }
    pauseMusic() {
        let current = this.__musicChannels[this.__musicChannelIndex];
        if (current) {
            current.pause();
        }
    }
    resumeMusic() {
        let current = this.__musicChannels[this.__musicChannelIndex];
        if (current) {
            current.resume();
        }
    }
    playSound(url, playedCallBack, volume, speed, loop) {
        let playVolume;
        if (this.muteSound || this.mute) {
            playVolume = 0;
        }
        else {
            playVolume = this.soundVolume * volume * this.__volume;
        }
        let channel = this.getIdleChannel();
        if (channel) {
            channel.volume = volume;
            channel.play(url, playedCallBack, playVolume, null, loop, speed);
        }
    }
    getPlaying(url) {
        for (let index = 0; index < this.__soundChannels.length; index++) {
            const element = this.__soundChannels[index];
            if (element.isPlaying && url2Key(element.url) == url2Key(url)) {
                return element;
            }
        }
        return null;
    }
    getIdleChannel() {
        let index;
        let channel;
        for (index = 0; index < this.__soundChannels.length; index++) {
            channel = this.__soundChannels[index];
            if (channel.isPlaying == false) {
                return channel;
            }
        }
        if (index < AudioManager.MAX_SOUND_CHANNEL_COUNT) {
            channel = new AudioChannel(this.__audioRoot);
            this.__soundChannels.push(channel);
            return channel;
        }
        return null;
    }
    tick(dt) {
        for (let index = 0; index < this.__musicChannels.length; index++) {
            const element = this.__musicChannels[index];
            if (element.isPlaying) {
                element.tick(dt);
            }
        }
        for (let index = 0; index < this.__soundChannels.length; index++) {
            const element = this.__soundChannels[index];
            if (element.isPlaying) {
                element.tick(dt);
            }
        }
    }
}

/**
 * 音频管理器
 */
class AudioManager {
    /**
     * 总音量
     */
    static get volume() {
        return this.impl.volume;
    }
    static set volume(value) {
        this.impl.volume = value;
    }
    /**
     * 音乐音量
     */
    static get musicVolume() {
        return this.impl.musicVolume;
    }
    static set musicVolume(value) {
        this.impl.musicVolume = value;
    }
    /**
     * 声音音量
     */
    static get soundVolume() {
        return this.impl.soundVolume;
    }
    static set soundVolume(value) {
        this.impl.soundVolume = value;
    }
    /**
     * 静音总开关
     */
    static get mute() {
        return this.impl.mute;
    }
    static set mute(value) {
        this.impl.mute = value;
    }
    /**
     * 音乐静音开关
     */
    static get muteMusic() {
        return this.impl.muteMusic;
    }
    static set muteMusic(value) {
        this.impl.muteMusic = value;
    }
    /**
     * 声音静音开关
     */
    static get muteSound() {
        return this.impl.muteSound;
    }
    static set muteSound(value) {
        this.impl.muteSound = value;
    }
    /**
     * 播放音乐
     * @param value
     */
    static playMusic(url, volume = 1, speed = 1, loop = false) {
        this.impl.playMusic(url, volume, speed, loop);
    }
    /**
     * 停止音乐
     */
    static stopMusic() {
        this.impl.stopMusic();
    }
    /**
     * 暂停
     */
    static pauseMusic() {
        this.impl.pauseMusic();
    }
    /**
     * 继续播放
     */
    static resumeMusic() {
        this.impl.resumeMusic();
    }
    /**
     * 播放声音
     * @param value
     */
    static playSound(url, playedCallBack, volume, speed, loop) {
        this.impl.playSound(url, playedCallBack, volume, speed, loop);
    }
    /**
     * 获取正在播放指定音频的轨道
     * @param url
     */
    static getPlaying(url) {
        return this.impl.getPlaying(url);
    }
    static get impl() {
        if (this.__impl == null) {
            this.__impl = Injector.getInject(this.KEY);
        }
        if (this.__impl == null) {
            this.__impl = new AudioManagerImpl();
        }
        return this.__impl;
    }
}
/**
 * 全局唯一注入KEY
 */
AudioManager.KEY = "drongo.AudioManager";
/**
 * 最大音频轨道数量
 */
AudioManager.MAX_SOUND_CHANNEL_COUNT = 30;

/**
 * 任务队列
 */
class TaskQueue extends EventDispatcher {
    constructor() {
        super();
        this.__index = 0;
        this.__taskList = [];
    }
    addTask(value) {
        if (this.__taskList.indexOf(value) >= 0) {
            throw new Error("重复添加！");
        }
        this.__taskList.push(value);
    }
    removeTask(value) {
        let index = this.__taskList.indexOf(value);
        if (index < 0) {
            throw new Error("未找到要删除的内容！");
        }
        this.__taskList.splice(index, 1);
    }
    start(data) {
        this.__index = 0;
        this.__tryNext();
    }
    __tryNext() {
        if (this.__index < this.__taskList.length) {
            let task = this.__taskList[this.__index];
            task.on(Event.COMPLETE, this.__subTaskEventHandler, this);
            task.on(Event.PROGRESS, this.__subTaskEventHandler, this);
            task.on(Event.ERROR, this.__subTaskEventHandler, this);
            task.start();
        }
        else {
            //结束
            this.emit(Event.COMPLETE);
        }
    }
    __subTaskEventHandler(key, target, data) {
        if (key == Event.PROGRESS) {
            let dataValue = Number(data) == undefined ? 0 : Number(data);
            let progress = (this.__index + dataValue) / this.__taskList.length;
            this.emit(Event.PROGRESS, progress);
            return;
        }
        target.offAllEvent();
        if (key == Event.ERROR) {
            this.emit(Event.ERROR, data);
            return;
        }
        target.destroy();
        this.__index++;
        this.__tryNext();
    }
    destroy() {
        super.destroy();
        this.__taskList.length = 0;
        this.__index = 0;
    }
}

/**
 * 任务序列（并行）
 */
class TaskSequence extends EventDispatcher {
    constructor() {
        super();
        this.__taskList = new Array();
        this.__index = 0;
    }
    addTask(value) {
        if (this.__taskList.indexOf(value) >= 0) {
            throw new Error("重复添加！");
        }
        this.__taskList.push(value);
    }
    removeTask(value) {
        let index = this.__taskList.indexOf(value);
        if (index < 0) {
            throw new Error("找不到要删除的内容!");
        }
        this.__taskList.splice(index, 1);
    }
    start(data) {
        for (let index = 0; index < this.__taskList.length; index++) {
            const element = this.__taskList[index];
            element.on(Event.COMPLETE, this.__subTaskEventHandler, this);
            element.on(Event.ERROR, this.__subTaskEventHandler, this);
            element.on(Event.PROGRESS, this.__subTaskEventHandler, this);
            element.start();
        }
    }
    __subTaskEventHandler(type, target, data) {
        if (type == Event.PROGRESS) {
            this.emit(Event.PROGRESS, this.__index / this.__taskList.length);
            return;
        }
        target.offAllEvent();
        if (type == Event.ERROR) {
            this.emit(Event.ERROR, data);
            return;
        }
        this.__index++;
        if (this.__index < this.__taskList.length) {
            return;
        }
        target.destroy();
        //完成
        this.emit(Event.COMPLETE);
    }
    destroy() {
        super.destroy();
        this.__taskList.length = 0;
        this.__index = 0;
    }
}

class Matcher extends BitFlag {
    constructor(flags) {
        super();
        for (let index = 0; index < flags.length; index++) {
            this.add(flags[index]);
        }
    }
}

/**
 * 必须所有成立
 */
class MatcherAllOf extends Matcher {
}

/**
 * 任意一个成立
 */
class MatcherAnyOf extends Matcher {
}

/**
 * 不能包含
 */
class MatcherNoneOf extends Matcher {
}

class Component {
    /**
     * 类型
     */
    get type() {
        return 0;
    }
    dispose() {
    }
}

class Entity {
    constructor(id, world) {
        this.__id = id;
        this.__world = world;
        this.__components = new Dictionary();
        this.__componentFlags = new BitFlag();
    }
    /**
     * 添加组件
     * @param value
     */
    addComponent(value) {
        let list = this.__components.get(value.type);
        if (list) {
            let index = list.indexOf(value);
            if (index >= 0) {
                throw new Error("重复添加Component到Entity");
            }
        }
        else {
            list = [];
            this.__components.set(value.type, list);
        }
        let world = true;
        //如果已经在实体上
        if (value.entity) {
            value.entity.__removeComponent(value, false);
            world = false;
        }
        value.entity = this;
        list.push(value);
        this.__componentFlags.add(value.type);
        if (world) {
            this.__world._addComponent(value);
        }
        return value;
    }
    /**
     * 删除组件
     * @param id
     */
    removeComponent(value) {
        this.__removeComponent(value, true);
    }
    /**
     * 获取组件
     * @param type
     */
    getComponent(type) {
        let list = this.__components.get(type);
        if (list && list.length > 0) {
            return list[0];
        }
        return null;
    }
    /**
     * 获取组件列表
     * @param type
     * @returns
     */
    getComponents(type) {
        return this.__components.get(type);
    }
    __removeComponent(value, world) {
        let list = this.__components.get(value.type);
        if (list == null && list.length == 0) {
            throw new Error("该组件不是属于Entity:" + this.__id);
        }
        let index = list.indexOf(value);
        if (index < 0) {
            throw new Error("该组件不是属于Entity:" + this.__id);
        }
        this.__componentFlags.remove(value.type);
        if (world) {
            this.__world._removeComponent(value);
        }
        list.splice(index, 1);
        value.entity = null;
    }
    /**
     * 唯一ID
     */
    get id() {
        return this.__id;
    }
    /**
     * 销毁
     */
    dispose() {
        //从世界中删除组件记录
        let components = this.__components.elements;
        let comList;
        let com;
        for (let index = 0; index < components.length; index++) {
            comList = components[index];
            for (let index = 0; index < comList.length; index++) {
                com = comList[index];
                this.__world._removeComponent(com);
            }
        }
        this.__world._removeEntity(this);
        this.__components = null;
        this.__world = null;
        this.__componentFlags.destroy();
        this.__componentFlags = null;
    }
    /**
     * 是否符合匹配规则
     * @param group
     */
    _matcherGroup(group) {
        let mainMatcher = false;
        if (group.matcher instanceof MatcherAllOf) {
            if (this.__componentFlags.has(group.matcher.flags)) {
                mainMatcher = true;
            }
        }
        else {
            if (this.__componentFlags.flags & group.matcher.flags) {
                mainMatcher = true;
            }
        }
        let noneMatcher = true;
        if (group.matcherNoneOf) {
            if (this.__componentFlags.flags & group.matcherNoneOf.flags) {
                noneMatcher = false;
            }
        }
        return mainMatcher && noneMatcher;
    }
}

class Group {
    constructor() {
        /**
         * 编组所匹配的元素(内部接口)
         */
        this._entitys = new Dictionary();
    }
    init(allOrAny, none) {
        this.matcher = allOrAny;
        this.matcherNoneOf = none;
        if (none) {
            this.__id = "id:" + this.matcher.flags + "|" + none.flags;
        }
        else {
            this.__id = "id:" + this.matcher.flags;
        }
    }
    get id() {
        return this.__id;
    }
    static create(allOrAny, none) {
        let result;
        if (this.__pool.length) {
            result = this.__pool.shift();
        }
        else {
            result = new Group();
        }
        result.init(allOrAny, none);
        return result;
    }
    static recycle(value) {
        let index = this.__pool.indexOf(value);
        if (index >= 0) {
            throw new Error("重复回收!");
        }
        this.__pool.push(value);
    }
}
Group.__pool = [];

class System {
    /**
     * 系统
     * @param allOrAny  所有或任意一个包含
     * @param none      不能包含
     */
    constructor(allOrAny, none) {
        this._group = Group.create(allOrAny, none);
    }
    tick(time) {
    }
}

class World {
    constructor() {
        this.__components = new Dictionary();
        this.__entitys = new Dictionary();
        this.__systems = [];
    }
    /**
     * 心跳驱动
     * @param time
     */
    tick(time) {
        for (var system of this.__systems) {
            system.tick(time);
        }
    }
    /**
     * 创建一个实体
     */
    createEntity(id) {
        let entity = new Entity(id, this);
        this.__entitys.set(entity.id, entity);
        return entity;
    }
    /**
     * 通过ID获取实体
     * @param id
     */
    getEntity(id) {
        return this.__entitys.get(id);
    }
    /**
     * 添加系统
     */
    addSystem(value) {
        let index = this.__systems.indexOf(value);
        if (index >= 0) {
            throw new Error("重复添加系统");
        }
        this.__systems.push(value);
        //按照编组规则匹配
        this._matcherGroup(value._group);
    }
    /**
     * 删除系统
     * @param value
     */
    removeSystem(value) {
        let index = this.__systems.indexOf(value);
        if (index < 0) {
            throw new Error("找不到要删除的系统");
        }
        this.__systems.splice(index, 1);
        //回收
        Group.recycle(value._group);
    }
    /**
     * 根据类型获取组件列表
     * @param type
     */
    getComponent(type) {
        return this.__components.get(type);
    }
    //=====================================内部接口=======================================================//
    _matcherGroup(group) {
        //通过主匹配规则筛选出最短的
        for (let index = 0; index < group.matcher.elements.length; index++) {
            group.matcher.elements[index];
            {
                continue;
            }
        }
        {
            return;
        }
    }
    /**
     * 内部接口，请勿调用
     * @param com
     */
    _addComponent(com) {
        let list = this.__components.get(com.type);
        if (list == null) {
            list = [];
            this.__components.set(com.type, list);
        }
        let index = list.indexOf(com);
        if (index >= 0) {
            throw new Error("重复添加组件！");
        }
        list.push(com);
        for (let index = 0; index < this.__systems.length; index++) {
            const system = this.__systems[index];
            //已经在里面了，就不管这个组了
            if (system._group._entitys.has(com.entity.id)) {
                continue;
            }
            if (com.entity._matcherGroup(system._group)) {
                system._group._entitys.set(com.entity.id, com.entity);
            }
        }
    }
    /**
     * 内部接口，请勿调用
     * @param com
     */
    _removeComponent(com) {
        let list = this.__components.get(com.type);
        if (list == null) {
            return;
        }
        let index = list.indexOf(com);
        if (index < 0) {
            throw new Error("找不到要删除的组件");
        }
        list.splice(index, 0);
        for (let index = 0; index < this.__systems.length; index++) {
            const system = this.__systems[index];
            if (system._group._entitys.has(com.entity.id)) {
                system._group._entitys.delete(com.entity.id);
            }
        }
    }
    /**
     * 内部接口，请勿调用
     * @param value
     */
    _removeEntity(value) {
        if (!this.__entitys.has(value.id)) {
            throw new Error("找不到要删除的entity:" + value.id);
        }
        this.__entitys.delete(value.id);
    }
}

/**
 * 状态机
 */
class FSM extends EventDispatcher {
    constructor(owner, name) {
        super();
        this.owner = owner;
        this.__name = name;
        this.__states = new Map();
    }
    tick(dt) {
        if (this.__current) {
            this.__current.tick(dt);
        }
    }
    /**
     * 添加
     * @param key
     * @param v
     */
    addState(key, v) {
        this.__states.set(key, v);
        v.init(this);
    }
    /**
     * 切换状态
     * @param value
     * @param data
     * @returns
     */
    switchState(value, data) {
        if (this.__state == value) {
            return;
        }
        let oldKey = this.__state;
        let old = this.__current;
        if (old) {
            if (this.debug) {
                Debuger.log("FSM", this.__name + " 所属:" + this.owner.name + " 退出状态==>" + this.__current.name);
            }
            old.exit();
        }
        this.__current = null;
        if (!this.__states.has(value)) {
            throw new Error("状态机:" + this.__name + " 所属:" + this.owner.name + "未找到状态==>" + value);
        }
        this.__state = value;
        this.__current = this.__states.get(value);
        if (this.debug) {
            Debuger.log("FSM", this.__name + " 所属:" + this.owner.name + " 进入状态==>" + this.__current.name);
        }
        this.__current.enter(data);
        this.emit(Event.State_Changed, oldKey);
    }
    get state() {
        return this.__state;
    }
    get current() {
        return this.__current;
    }
    destroy() {
        if (this.__current) {
            this.__current.exit();
        }
        this.__states.forEach(element => {
            element.destroy();
        });
        this.__states.clear();
    }
}

/**
 * 层管理器
 */
class LayerManager {
    /**
     * 添加一个层
     * @param key
     * @param layer
     */
    static addLayer(key, layer) {
        this.impl.addLayer(key, layer);
    }
    /**
     * 删除层
     * @param key
     */
    static removeLayer(key) {
        this.impl.removeLayer(key);
    }
    /**
     * 获取层对象
     * @param key
     */
    static getLayer(key) {
        return this.impl.getLayer(key);
    }
    /**
     * 获得所有层
     */
    static getAllLayer() {
        return this.impl.getAllLayer();
    }
    static get impl() {
        if (this.__impl == null) {
            this.__impl = Injector.getInject(this.KEY);
        }
        if (this.__impl == null) {
            throw new Error(this.KEY + "未注入！");
        }
        return this.__impl;
    }
}
LayerManager.KEY = "drongo.LayerManager";

var GUIState;
(function (GUIState) {
    /**
     * 未使用状态
     */
    GUIState[GUIState["Null"] = 0] = "Null";
    /**
     * 显示处理中
     */
    GUIState[GUIState["Showing"] = 1] = "Showing";
    /**
     * 已显示
     */
    GUIState[GUIState["Showed"] = 2] = "Showed";
    /**
     * 关闭处理中
     */
    GUIState[GUIState["Closeing"] = 3] = "Closeing";
    /**
     * 已关闭
     */
    GUIState[GUIState["Closed"] = 4] = "Closed";
})(GUIState || (GUIState = {}));

/**
     * GUI 管理器
     */
class GUIManager {
    /**
     * 注册
     * @param info
     * @returns
     */
    static register(info) {
        return this.impl.register(info);
    }
    /**
     * 注销
     * @param key
     * @returns
     */
    static unregister(key) {
        return this.impl.unregister(key);
    }
    static open(key, data) {
        this.impl.open(key, data);
    }
    /**
     * 关闭
     * @param key
     * @param checkLayer 是否检查全屏记录
     */
    static close(key, checkLayer = true) {
        this.impl.close(key, checkLayer);
    }
    static closeAll() {
        this.impl.closeAll();
    }
    /**
     * 获取界面状态
     * @param key
     * @returns  0 未显示  1显示中
     */
    static getGUIState(key) {
        return this.impl.getGUIState(key);
    }
    /**
     * 是否已打开或再打开中
     * @param key
     * @returns
     */
    static isOpen(key) {
        return this.impl.isOpen(key);
    }
    /**
     * 获取GUI中的某个组件
     * @param key    界面全局唯一KEY
     * @param path   组件名称/路径
     */
    static getUIComponent(key, path) {
        return this.impl.getUIComponent(key, path);
    }
    /**
     * 获取界面的mediator
     */
    static getMediatorByKey(key) {
        return this.impl.getMediatorByKey(key);
    }
    /**
     * 获得前一个打开的全屏界面
     * @param curLayerKey 当前打开的全屏界面
     */
    static getPrevLayer() {
        return this.impl.getPrevLayer();
    }
    static get impl() {
        if (this.__impl == null) {
            this.__impl = Injector.getInject(this.KEY);
        }
        if (this.__impl == null) {
            throw new Error("未注入：" + GUIManager.KEY);
        }
        return this.__impl;
    }
}
GUIManager.KEY = "drongo.GUIManager";
/**
 * 在界面关闭后多长时间不使用则销毁(秒)
 */
GUIManager.GUI_GC_INTERVAL = 30;

/**
* GUI 关联关系
*/
class RelationManager {
    constructor() {
    }
    static addRelation(key, value) {
        if (DEBUG) {
            this.__checkValidity(key, value);
        }
        if (this.__map.has(key)) {
            throw new Error("重复注册！");
        }
        this.__map.set(key, value);
    }
    static removeRelation(key) {
        if (!this.__map.has(key)) {
            throw new Error("找不到要删除的内容！");
        }
        this.__map.delete(key);
    }
    /**
     * 检测合法性
     * @param value
     */
    static __checkValidity(key, value) {
        let guiKey = key;
        let showList = value.show;
        let hideList = value.hide;
        let findex;
        findex = showList.show.indexOf(guiKey);
        if (findex >= 0) {
            throw new Error("GuiRelation.config配置错误：gui:" + guiKey + " show.show:中不能包含自身！");
        }
        findex = showList.hide.indexOf(guiKey);
        if (findex >= 0) {
            throw new Error("GuiRelation.config配置错误：gui:" + guiKey + " show.hide:中不能包含自身！");
        }
        findex = hideList.show.indexOf(guiKey);
        if (findex >= 0) {
            throw new Error("GuiRelation.config配置错误：gui:" + guiKey + " hide.show:中不能包含自身！");
        }
        findex = hideList.hide.indexOf(guiKey);
        if (findex >= 0) {
            throw new Error("GuiRelation.config配置错误：gui:" + guiKey + " hide.hide:中不能包含自身！");
        }
        for (let index = 0; index < showList.show.length; index++) {
            const showkey = showList.show[index];
            const findex = showList.hide.indexOf(showkey);
            if (findex >= 0) {
                throw new Error("GuiRelation.config配置错误：gui:" + guiKey + " show.show和show.hide中包含相同的guikey:" + showkey);
            }
        }
        for (let index = 0; index < hideList.show.length; index++) {
            const showkey = hideList.show[index];
            const findex = hideList.hide.indexOf(showkey);
            if (findex >= 0) {
                throw new Error("GuiRelation.config配置错误：gui:" + guiKey + " hide.show和hide.hide中包含相同的guikey:" + showkey);
            }
        }
    }
    static getRelation(key) {
        return this.__map.get(key);
    }
}
RelationManager.__map = new Map();

/**
 * 加载界面
 */
class LoadingView {
    static show() {
        if (!this.impl) {
            return;
        }
        this.impl.show();
    }
    static hide() {
        if (!this.impl) {
            return;
        }
        this.impl.hide();
    }
    static changeData(data) {
        if (!this.impl) {
            return;
        }
        this.impl.changeData(data);
    }
    static get impl() {
        if (this.__impl == null) {
            this.__impl = Injector.getInject(this.KEY);
        }
        if (this.__impl == null) {
            console.warn(this.KEY + "未注入");
        }
        return this.__impl;
    }
}
LoadingView.KEY = "drongo.LoadingView";

/**
 *  服务基类
 *  1.  如果有依赖的资源请在子类构造函数中给this.$configs和this.$assets进行赋值
 *  2.  重写$configAndAssetReady函数，并在完成初始化后调用this.initComplete()
 */
class BaseService {
    constructor() {
    }
    init(callback) {
        this.__initCallback = callback;
        if (this.$configs == null || this.$configs.length <= 0) {
            this.__configLoaded();
        }
        else {
            this.__loadConfigs();
        }
    }
    __loadConfigs() {
        ConfigManager.load(this.$configs, this.__configLoaded.bind(this));
    }
    __configLoaded(err) {
        if (err) {
            throw new Error("配置加载错误：" + err.message);
        }
        if (this.$assets == null || this.$assets.length <= 0) {
            this.$configAndAssetReady();
        }
        else {
            this.__loadAssets();
        }
    }
    __loadAssets() {
        Res.getResRefList(this.$assets, this.name).then((value) => {
            this.$assetRefs = value;
            this.$configAndAssetReady();
        }, (reason) => {
            throw new Error(this.name + "依赖资源加载出错:" + reason);
        });
    }
    /**
     * 依赖的配置与资源准备完毕
     */
    $configAndAssetReady() {
    }
    /**
     * 初始化完成时调用
     */
    $initComplete() {
        if (this.__initCallback) {
            this.__initCallback(null, this);
            this.__initCallback = null;
        }
    }
    destroy() {
        this.name = undefined;
        this.$configs = null;
        this.__initCallback = null;
    }
}

var __awaiter$1 = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
class ServiceStarter {
    constructor(name, serviceClass) {
        this.__name = name;
        this.__serviceClass = serviceClass;
    }
    /**
     * 启动
     */
    start() {
        return __awaiter$1(this, void 0, void 0, function* () {
            if (this.__result) {
                return this.__result;
            }
            this.__result = new Promise((resolve, reject) => {
                //创建服务
                let service = new this.__serviceClass();
                service.name = this.__name;
                //初始化服务
                service.init((err, result) => {
                    if (err) {
                        reject(err);
                    }
                    else {
                        resolve(result);
                    }
                });
            });
            return this.__result;
        });
    }
    destroy() {
        this.__name = undefined;
        this.__serviceClass = undefined;
        this.__result = undefined;
    }
}

var __awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
class ServiceManager {
    constructor() {
        this.__registered = new Map();
        this.__starters = new Map();
    }
    /**
     * 注册服务
     * @param key
     * @param value
     */
    register(key, value) {
        if (this.__registered.has(key)) {
            throw new Error("重复注册服务：" + key);
        }
        this.__registered.set(key, value);
    }
    /**
     * 获取服务
     * @param key
     * @returns
     */
    getService(key) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.__registered.has(key)) {
                throw new Error("未注册服务：" + key);
            }
            //如果启动器存在
            if (this.__starters.has(key)) {
                return this.__starters.get(key).start();
            }
            let starter = new ServiceStarter(key, this.__registered.get(key));
            this.__starters.set(key, starter);
            return starter.start();
        });
    }
    /**
     * 卸载服务
     * @param key
     */
    uninstall(key) {
        if (!this.__starters.has(key)) {
            return;
        }
        let starter = this.__starters.get(key);
        starter.destroy();
        this.__starters.delete(key);
    }
}
var serviceManager = new ServiceManager();

/**
 * 配置存取器基类
 */
class BaseConfigAccessor {
    constructor() {
    }
    save(value) {
        if (this.__configs.includes(value)) {
            return false;
        }
        this.__configs.push(value);
    }
    get() {
        return this.__configs;
    }
}

class ConfigUtils {
    /**
     * 解析配置
     * @param titleList
     * @param typeList
     * @param byte
     * @returns
     */
    static parseConfig(titleList, typeList, byte) {
        let title;
        let type;
        let result = {};
        for (let index = 0; index < typeList.length; index++) {
            title = titleList[index];
            type = typeList[index];
            switch (type) {
                case 0: //byte
                case 1: //ubyte
                case 2: //short
                case 3: //ushort
                case 4: //int
                case 5: //uint
                case 6: //float
                case 7: //number
                    this.__readNumber(title, type, result, byte);
                    break;
                case 8: //string
                    result[title] = byte.readUTF();
                    break;
                case 9: //[byte]
                case 10: //[ubyte]
                case 11: //[short]
                case 12: //[ushort]
                case 13: //[int]
                case 14: //[uint]
                case 15: //[float]
                case 16: //[number]
                case 17: //[string]
                    this.__readArray(title, type, result, byte);
                    break;
            }
        }
        return result;
    }
    static __readNumber(title, type, data, byte) {
        switch (type) {
            case 0: //byte
                data[title] = byte.readByte();
                break;
            case 1: //ubyte
                data[title] = byte.readUnsignedByte();
                break;
            case 2: //short
                data[title] = byte.readShort();
                break;
            case 3: //ushort
                data[title] = byte.readUnsignedShort();
                break;
            case 4: //int
                data[title] = byte.readInt();
                break;
            case 5: //uint
                data[title] = byte.readUnsignedInt();
                break;
            case 6: //float
                data[title] = byte.readFloat();
                break;
            case 7: //number
                data[title] = byte.readDouble();
                break;
            default:
                throw new Error(title + ' 未知类型:' + type);
        }
    }
    static __readArray(title, type, data, byte) {
        let len = byte.readUnsignedInt();
        let list = [];
        for (let index = 0; index < len; index++) {
            switch (type) {
                case 9: //byte
                    list.push(byte.readByte());
                    break;
                case 10: //ubyte
                    list.push(byte.readUnsignedByte());
                    break;
                case 11: //short
                    list.push(byte.readShort());
                    break;
                case 12: //ushort
                    list.push(byte.readUnsignedShort());
                    break;
                case 13:
                    list.push(byte.readInt());
                    break;
                case 14:
                    list.push(byte.readUnsignedInt());
                    break;
                case 15:
                    list.push(byte.readFloat());
                    break;
                case 16:
                    list.push(byte.readDouble());
                    break;
                case 17:
                    list.push(byte.readUTF());
                    break;
                default:
                    throw new Error(title + ' 未知类型:' + type);
            }
        }
        data[title] = list;
    }
}

class ConfigManagerImpl {
    constructor() {
        this.__accessors = new Map();
        this.__loaded = new Map();
    }
    /**
     * 加载配置表
     * @param sheets
     * @param callback
     */
    load(sheets, callback) {
        if (Array.isArray(sheets)) {
            let loadIndex = 0;
            let loadTotal = sheets.length;
            for (let index = 0; index < sheets.length; index++) {
                const sheet = sheets[index];
                this.__load(sheet, (err) => {
                    loadIndex++;
                    if (loadIndex >= loadTotal) {
                        if (callback) {
                            callback(err);
                        }
                    }
                });
            }
        }
        else {
            this.__load(sheets, callback);
        }
    }
    __load(sheet, callback) {
        if (this.__loaded.has(sheet)) {
            if (callback) {
                callback();
            }
            return;
        }
        if (!ConfigManager.configPath) {
            throw new Error("ConfigManager.configPath函数未设置！");
        }
        let url = ConfigManager.configPath(sheet);
        Res.getResRef(url, "ConfigManagerImpl").then(value => {
            if (!this.__loaded.has(sheet)) {
                let buffer = value.content['_buffer'];
                //解析
                this.__parseConfig(sheet, buffer);
                this.__loaded.set(sheet, true);
                //原始资源可以销毁了
                value.dispose();
            }
            if (callback)
                callback();
        }, reason => {
            if (callback)
                callback(reason);
        });
    }
    __parseConfig(sheet, buffer) {
        let byte = new ByteArray(buffer);
        //解析表头
        let len = byte.readUnsignedInt();
        let titleList = [];
        for (let index = 0; index < len; index++) {
            titleList.push(byte.readUTF());
        }
        //类型
        let typeList = [];
        len = byte.readUnsignedInt();
        for (let index = 0; index < len; index++) {
            typeList.push(byte.readByte());
        }
        //数据数量
        len = byte.readUnsignedInt();
        let data;
        let accessor;
        for (let dataIndex = 0; dataIndex < len; dataIndex++) {
            data = ConfigUtils.parseConfig(titleList, typeList, byte);
            //存取器
            accessor = this.__accessors.get(sheet);
            if (!accessor) {
                console.warn("配置表：" + sheet + "未注册存取器！");
                continue;
            }
            accessor.save(data);
        }
    }
    /**
     * 注册存取器
     * @param sheet
     * @param accessors
     */
    register(sheet, accessors) {
        if (!this.__accessors.has(sheet)) {
            throw new Error("配置表：" + sheet + "未注册存取器！");
        }
        this.__accessors.set(sheet, accessors);
    }
    /**
     * 获取存取器
     * @param sheet
     * @returns
     */
    getAccessor(sheet) {
        if (!this.__accessors.has(sheet)) {
            throw new Error("配置表：" + sheet + "未注册存取器");
        }
        return this.__accessors.get(sheet);
    }
}

/**
 * 配置表管理器
 */
class ConfigManager {
    static set configPath(value) {
        this.__configPath = value;
    }
    /**
     * 路径转化器
     */
    static get configPath() {
        if (this.__configPath == null) {
            return this.defaultConfigPath;
        }
        return this.__configPath;
    }
    /**
     * 默认路径转换器
     * @param sheet
     * @returns
     */
    static defaultConfigPath(sheet) {
        let result = {
            url: "configs/" + sheet,
            bundle: "Res",
            type: BufferAsset
        };
        return result;
    }
    /**
     * 注册存取器
     * @param sheet
     * @param accessors
     */
    static register(sheet, accessors) {
        this.impl.register(sheet, accessors);
    }
    /**
     * 加载配置文件
     * @param sheet
     * @param callback
     */
    static load(sheet, callback) {
        this.impl.load(sheet, callback);
    }
    /**
     * 获取配置存取器
     * @param sheet
     */
    static getAccessor(sheet) {
        return this.impl.getAccessor(sheet);
    }
    static get impl() {
        if (this.__impl == null) {
            this.__impl = Injector.getInject(this.KEY);
        }
        if (this.__impl == null) {
            this.__impl = new ConfigManagerImpl();
        }
        return this.__impl;
    }
}
ConfigManager.KEY = "drongo.ConfigManager";

export { AudioChannel, AudioManager, BaseConfigAccessor, BaseService, BinderUtils, BindingUtils, BitFlag, ByteArray, Component, ConfigManager, Debuger, Dictionary, Entity, Event, EventDispatcher, FSM, FindPosition, FunctionHook, GUIManager, GUIState, Group, Handler, Injector, LayerManager, List, LoadingView, LocalStorage, Matcher, MatcherAllOf, MatcherAnyOf, MatcherNoneOf, MaxRectBinPack, Pool, PropertyBinder, RGBA8888Texture, Rect, RelationManager, Res, ResManager, ResRef, Resource, ServiceManager, ServiceStarter, StringUtils, System, TaskQueue, TaskSequence, TickerManager, Timer, World, fullURL, key2URL, serviceManager, url2Key };
