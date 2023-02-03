import { Asset } from "cc";

export type CCURL = string | { url: string, bundle: string, type: string | typeof Asset };
export type TooltipsData = string | { type: string, data: any };

export { GGroup } from "./GGroup";
export { GObject } from "./GObject";
export { GGraph } from "./GGraph";
export { GImage } from "./GImage";
export { GMovieClip } from "./GMovieClip";
export { GRoot } from "./GRoot";
export { GTextField } from "./GTextField";
export { GRichTextField } from "./GRichTextField";
export { GTextInput } from "./GTextInput";
export { GLoader } from "./GLoader";
export { GLoader3D } from "./GLoader3D";
export { GComponent } from "./GComponent";
export { GLabel } from "./GLabel";
export { GButton } from "./GButton";
export { GComboBox } from "./GComboBox";
export { GSlider } from "./GSlider";
export { GProgressBar } from "./GProgressBar";
export { GScrollBar } from "./GScrollBar";
export { GList, ListItemRenderer } from "./GList";
export { GTree } from "./GTree";
export { GTreeNode } from "./GTreeNode";
export { Window } from "./Window";
export { PopupMenu } from "./PopupMenu";
export { Controller } from "./Controller";
export { Transition } from "./Transition";
export { ScrollPane } from "./ScrollPane";
export { RelationType } from "./FieldTypes";
export { UIPackage } from "./UIPackage";
export { PackageItem } from "./PackageItem";
export { GObjectPool } from "./GObjectPool";
export { UIObjectFactory } from "./UIObjectFactory";
export { UIConfig, registerFont } from "./UIConfig";
export { DragDropManager } from "./DragDropManager";
export { AsyncOperation } from "./AsyncOperation";
export { TranslationHelper } from "./TranslationHelper";
export { GearAnimation } from "./gears/GearAnimation";
export { GearBase } from "./gears/GearBase";
export { GearColor } from "./gears/GearColor";
export { GearDisplay } from "./gears/GearDisplay";
export { GearDisplay2 } from "./gears/GearDisplay2";
export { GearFontSize } from "./gears/GearFontSize";
export { GearIcon } from "./gears/GearIcon";
export { GearLook } from "./gears/GearLook";
export { GearSize } from "./gears/GearSize";
export { GearText } from "./gears/GearText";
export { GearXY } from "./gears/GearXY";
export * from "./FieldTypes"

export { BlendMode } from "./display/BlendMode";
export { Image } from "./display/Image";
export { MovieClip, Frame } from "./display/MovieClip";

export { Event } from "./event/Event";

export { GTween } from "./tween/GTween";
export { GTweener } from "./tween/GTweener";
export { EaseType } from "./tween/EaseType";

export { UBBParser } from "./utils/UBBParser";
export { ByteBuffer } from "./utils/ByteBuffer";