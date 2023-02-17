
import { GUIManager, Injector, LayerManager, Res, ResRef, ResURL, url2Key } from "drongo-cc";
import { Layer } from "./layer/Layer";
import { GUIManagerImpl } from "./gui/GUIManagerImpl";
import { LayerManagerImpl } from "./layer/LayerManagerImpl";
import { fguiResLoader } from "./drongo-gui";

export class Drongo {


    /**
     * 初始化
     * @param guiconfig 
     * @param layers 
     * @param fullScrene 
     */
    static init(guiconfig: ResURL, layers: Array<string>, fullScrene: Array<string>, callback: () => void): void {
        Res.setResLoader("fgui", fguiResLoader);
        Injector.inject(GUIManager.KEY, GUIManagerImpl);
        Injector.inject(LayerManager.KEY, LayerManagerImpl);

        //创建层级
        if (layers && layers.length > 0) {
            for (let index = 0; index < layers.length; index++) {
                const layerKey = layers[index];
                if (fullScrene) {
                    LayerManager.addLayer(layerKey, new Layer(layerKey))
                } else {
                    LayerManager.addLayer(layerKey, new Layer(layerKey, fullScrene.indexOf(layerKey) >= 0));
                }
            }
        }

        //加载guiconfig.json
        Res.getResRef(guiconfig, "Main").then(
            (result: ResRef) => {
                let list = result.content.json;
                for (let index = 0; index < list.length; index++) {
                    const element = list[index];
                    GUIManager.register(element);
                }
                callback();
            }, (reason) => {
                throw new Error("初始化引擎出错,gui配置加载错误:" + url2Key(guiconfig));
            }
        )
    }
}