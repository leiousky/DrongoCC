import { Asset } from "cc";



export type ResURL = string | { url: string, bundle: string, type: string|typeof Asset };

/**
 * 资源地址转唯一KEY
 * @param url 
 * @returns 
 */
export function resURL2Key(url: ResURL): string {
    return ResURLUtils.resURL2Key(url);
}

/**
 * 唯一key转URL
 * @param key 
 * @returns 
 */
export function key2ResURL(key: string): ResURL {
    return ResURLUtils.key2ResURL(key);
}


class ResURLUtils {

    static __assetTypes = new Map<string, typeof Asset>();
    

    private static getAssetType(key: string): typeof Asset {
        if (!this.__assetTypes.has(key)) {
            throw new Error("未找到对应资源类型：" + key);
        }
        return this.__assetTypes.get(key);
    }

    /**
     * 唯一key转URL
     * @param key 
     * @returns 
     */
    static key2ResURL(key: string): ResURL {
        if (key.indexOf("|")) {
            let arr: Array<string> = key.split("|");
            return { url: arr[0], bundle: arr[1], type: this.getAssetType(arr[2]) };
        }
        return key;
    }

    /**
     * 资源地址转唯一KEY
     * @param url 
     * @returns 
     */
    static resURL2Key(url: ResURL): string {
        if (url == null || url == undefined) {
            return "";
        }
        if (typeof url == "string") {
            return url;
        }
        return url.url + "|" + url.bundle + "|" + this.getClassName(url.type);
    }

    private static getClassName(clazz: any): string {
        let className: string;
        if (typeof clazz != "string") {
            className = clazz.toString();
        } else {
            className = clazz;
        }
        className = className.replace("function ", "");
        let index: number = className.indexOf("()");
        if (index < 0) {
            throw new Error("获取类型名称错误：" + className);
        }
        className = className.substring(0, index);
        if (!this.__assetTypes.has(className)) {
            this.__assetTypes.set(className, clazz);
        }
        return className;
    }
}