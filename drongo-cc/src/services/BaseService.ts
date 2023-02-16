import { ConfigManager } from "../drongo-cc";
import { Res } from "../res/Res";
import { ResRef } from "../res/ResRef";
import { ResURL } from "../res/ResURL";
import { IService } from "./IService";

/**
 *  服务基类
 *  1.  如果有依赖的资源请在子类构造函数中给this.$configs和this.$assets进行赋值
 *  2.  重写$configAndAssetReady函数，并在完成初始化后调用this.initComplete()
 */
export class BaseService implements IService {

    /**名称 */
    name: string;
    /**
     * 依赖的配置表名称
     */
    protected $configs: Array<string>;
    /**
     * 依赖的资源
     */
    protected $assets: Array<ResURL>;

    protected $assetRefs: Array<ResRef>;

    protected __initCallback: (err: Error, result: IService) => void;

    constructor() {

    }

    init(callback: (err: Error, result: IService) => void): void {
        this.__initCallback = callback;
        if (this.$configs == null || this.$configs.length <= 0) {
            this.__configLoaded();
        } else {
            this.__loadConfigs();
        }
    }

    private __loadConfigs(): void {
        ConfigManager.load(this.$configs, this.__configLoaded.bind(this));
    }

    private __configLoaded(err?: Error): void {
        if (err) {
            throw new Error("配置加载错误：" + err.message);
        }
        if (this.$assets == null || this.$assets.length <= 0) {
            this.$configAndAssetReady();
        } else {
            this.__loadAssets();
        }
    }

    private __loadAssets(): void {
        Res.getResRefList(this.$assets, this.name).then(
            (value) => {
                this.$assetRefs = value;
                this.$configAndAssetReady();
            }, (reason) => {
                throw new Error(this.name + "依赖资源加载出错:" + reason);
            });
    }

    /**
     * 依赖的配置与资源准备完毕
     */
    protected $configAndAssetReady(): void {

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