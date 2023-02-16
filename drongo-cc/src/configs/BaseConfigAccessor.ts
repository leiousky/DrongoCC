import { IConfigAccessor } from "./core/IConfigAccessor";



/**
 * 配置存取器基类
 */
export class BaseConfigAccessor implements IConfigAccessor {

    private __configs: Array<any>;

    constructor() {

    }
    
    save(value: any): boolean {
        if(this.__configs.includes(value)){
            return false;
        }
        this.__configs.push(value);
    }

    get<T>(): Array<T> {
        return this.__configs;
    }
}