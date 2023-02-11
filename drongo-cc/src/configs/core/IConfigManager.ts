import { IConfigAccessor } from "./IConfigAccessor";




/**
 * 配置管理器接口
 */
export interface IConfigManager {
    
    /**
     * 注册存取器
     * @param sheet 
     * @param accessors 
     */
    register(sheet: string, accessors?: IConfigAccessor): void;


    /**
     * 加载配置文件
     * @param sheet 
     * @param callback 
     */
    load(sheet:string|Array<string>,callback:(err:Error)=>void):void;
    
    /**
     * 获取配置存取器
     * @param sheet
     */
    getAccessor(sheet: string): IConfigAccessor;
}