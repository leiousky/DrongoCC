import { IService } from "./IService";


export class ServiceStarter<T extends IService> {
    private __name: string;
    private __serviceClass: { new(): IService };
    private __result: Promise<T>;
    constructor(name: string, serviceClass: { new(): IService }) {
        this.__name = name;
        this.__serviceClass = serviceClass;
    }

    /**
     * 启动
     */
    async start(): Promise<T> {
        if (this.__result) {
            return this.__result;
        }
        this.__result = new Promise<T>((resolve, reject) => {
            //创建服务
            let service = new this.__serviceClass();
            service.name = this.__name;
            //初始化服务
            service.init((err: Error, result) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result as T);
                }
            });
        })
        return this.__result;
    }

    destroy(): void {
        this.__name = undefined;
        this.__serviceClass = undefined;
        this.__result = undefined;
    }
}