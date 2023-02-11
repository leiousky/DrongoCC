import { ResURL } from "../res/ResURL";
import { ResRef } from "../res/ResRef";
import { Res } from "../res/Res";
import { IService } from "./IService";
import { ConfigManager } from "../drongo-cc";

/**
 *  服务基类
 *  1.  如果有依赖的资源请在子类构造函数中给this.$assets进行赋值
 *  2.  重写$configsLoaded函数，并在完成初始化后调用this.initComplete()
 */
export class BaseService implements IService {

    /**名称 */
    name: string;
    /**
     * 依赖的配置表名称
     */
    protected $configs: Array<string>;

    protected __initCallback: (err: Error, result: IService) => void;

    constructor() {

    }

    init(callback: (err: Error, result: IService) => void): void {
        this.__initCallback = callback;
        if (this.$configs == null || this.$configs.length <= 0) {
            this.$configsLoaded();
        } else {
            ConfigManager.load(this.$configs, (err: Error) => {
                this.$configsLoaded();
            });
        }
    }

    /**
     * 依赖配置加载完成
     */
    protected $configsLoaded(): void {

    }

    /**
     * 初始化完成时调用
     */
    protected $initComplete(): void {
        if (this.__initCallback) {
            this.__initCallback(null, this);
            this.__initCallback = null;
        }
    }

    destroy(): void {
        this.name = undefined;
        this.$configs = null;
        this.__initCallback = null;
    }
}