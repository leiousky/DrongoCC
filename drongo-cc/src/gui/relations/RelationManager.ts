import { DEBUG } from "cc/env";
import { IRelationInfo } from "./IRelationInfo";
import { IRelationList } from "./IRelationList";

/**
* GUI 关联关系
*/
export class RelationManager {

    private static __map: Map<string, IRelationInfo> = new Map<string, IRelationInfo>();

    constructor() {

    }

    static addRelation(key: string, value: IRelationInfo): void {
        if (DEBUG) {
            this.__checkValidity(key, value);
        }
        if (this.__map.has(key)) {
            throw new Error("重复注册！");
        }
        this.__map.set(key, value);
    }

    static removeRelation(key: string): void {
        if (!this.__map.has(key)) {
            throw new Error("找不到要删除的内容！");
        }
        this.__map.delete(key);
    }

    /**
     * 检测合法性
     * @param value 
     */
    private static __checkValidity(key: string, value: IRelationInfo): void {
        let guiKey: string = key;
        let showList: IRelationList = value.show;
        let hideList: IRelationList = value.hide;
        let findex: number;

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
            const findex: number = showList.hide.indexOf(showkey);
            if (findex >= 0) {
                throw new Error("GuiRelation.config配置错误：gui:" + guiKey + " show.show和show.hide中包含相同的guikey:" + showkey);
            }
        }
        for (let index = 0; index < hideList.show.length; index++) {
            const showkey = hideList.show[index];
            const findex: number = hideList.hide.indexOf(showkey);
            if (findex >= 0) {
                throw new Error("GuiRelation.config配置错误：gui:" + guiKey + " hide.show和hide.hide中包含相同的guikey:" + showkey);
            }
        }
    }

    static getRelation(key: string): IRelationInfo {
        return this.__map.get(key);
    }
}