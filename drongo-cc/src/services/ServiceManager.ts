

import { IService } from "./IService";
import { ServiceStarter } from "./ServiceStarter";


export class ServiceManager {

    /**已注册服务 */
    private __registered: Map<string, { new(): IService }>;
    /**启动器 */
    private __starters: Map<string, ServiceStarter<any>>;

    constructor() {
        this.__registered = new Map<string, { new(): IService }>();
        this.__starters = new Map<string, ServiceStarter<any>>();
    }

    /**
     * 注册服务
     * @param key 
     * @param value 
     */
    register(key: string, value: { new(): IService }): void {
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
    async getService<T extends IService>(key: string): Promise<T> {
        if (!this.__registered.has(key)) {
            throw new Error("未注册服务：" + key);
        }
        //如果启动器存在
        if (this.__starters.has(key)) {
            return this.__starters.get(key).start();
        }
        let starter = new ServiceStarter<T>(key, this.__registered.get(key));
        this.__starters.set(key, starter);
        return starter.start();
    }

    /**
     * 卸载服务
     * @param key 
     */
    uninstall(key: string): void {
        if (!this.__starters.has(key)) {
            return;
        }
        let starter = this.__starters.get(key);
        starter.destroy();
        this.__starters.delete(key);
    }
}

export var  serviceManager=new ServiceManager();