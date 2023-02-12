import { Injector } from "../utils/Injector";
import { ResURL } from "../res/ResURL";
import { ConfigManagerImpl } from "./ConfigManagerImpl";
import { IConfigAccessor } from "./core/IConfigAccessor";
import { IConfigManager } from "./core/IConfigManager";
import { BufferAsset } from "cc";


/**
 * 配置表管理器
 */
export class ConfigManager {

    static KEY: string = "drongo.ConfigManager"


    private static __configPath: (sheet: string) => ResURL;
    static set configPath(value: (sheet: string) => ResURL) {
        this.__configPath = value;
    }

    /**
     * 路径转化器
     */
    static get configPath(): (sheet: string) => ResURL {
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
    private static defaultConfigPath(sheet: string): ResURL {
        let result: ResURL = {
            url: "configs/" + sheet,
            bundle: "Res",
            type: BufferAsset
        }
        return result;
    }

    /**
     * 注册存取器
     * @param sheet 
     * @param accessors 
     */
    static register(sheet: string, accessors?: IConfigAccessor): void {
        this.impl.register(sheet, accessors);
    }


    /**
     * 加载配置文件
     * @param sheet 
     * @param callback 
     */
    static load(sheet: string | Array<string>, callback: (err: Error) => void): void {
        this.impl.load(sheet, callback);
    }

    /**
     * 获取配置存取器
     * @param sheet
     */
    static getAccessor(sheet: string): IConfigAccessor {
        return this.impl.getAccessor(sheet);
    }

    private static __impl: IConfigManager;
    private static get impl(): IConfigManager {
        if (this.__impl == null) {
            this.__impl = Injector.getInject(this.KEY);
        }
        if (this.__impl == null) {
            this.__impl = new ConfigManagerImpl();
        }
        return this.__impl;
    }
}