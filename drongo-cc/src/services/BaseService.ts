import { Res, ResRef, ResURL } from "../drongo-cc";
import { IService } from "./IService";

/**
 *  服务基类
 *  1.  如果有依赖的资源请在子类构造函数中给this.$assets进行赋值
 *  2.  重写$assetsLoaded函数，并在完成初始化后调用this.initComplete()
 */
export class BaseService implements IService {

    /**名称 */
    name: string;
    /**
     * 依赖资源URL
     */
    protected $assets: Array<ResURL>;
    /**
     * 依赖资源引用
     */
    protected $assetRefs: Map<string, ResRef>;

    protected __initCallback: (err: Error, result: IService) => void;

    constructor() {

    }

    init(callback: (err: Error, result: IService) => void): void {
        this.__initCallback = callback;
        if (this.$assets && this.$assets.length <= 0) {

        } else {
            Res.getResRefMap(this.$assets, this.name).then(value => {
                this.$assetRefs = value;
                this.$assetsLoaded();
            }, reason => {
                throw new Error(this.name + "依赖资源加载出错：" + reason.toString());
            })
        }
    }

    /**
     * 依赖资源加载完成
     */
    protected $assetsLoaded(): void {
        
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
        this.$assets = null;
        if (this.$assetRefs) {
            this.$assetRefs.forEach(ref => {
                ref.dispose();
            });
            this.$assetRefs = null;
        }
        this.__initCallback = null;
    }
}