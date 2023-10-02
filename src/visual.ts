/*
*  Power BI Visual CLI
*
*  Copyright (c) Microsoft Corporation
*  All rights reserved. *  MIT License
*
*  Permission is hereby granted, free of charge, to any person obtaining a copy
*  of this software and associated documentation files (the ""Software""), to deal
*  in the Software without restriction, including without limitation the rights
*  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
*  copies of the Software, and to permit persons to whom the Software is
*  furnished to do so, subject to the following conditions:
*
*  The above copyright notice and this permission notice shall be included in
*  all copies or substantial portions of the Software.
*
*  THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
*  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
*  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
*  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
*  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
*  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
*  THE SOFTWARE.
*/
"use strict";

import "core-js/stable";
import "./../style/visual.less";
import powerbi from "powerbi-visuals-api";
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import VisualObjectInstance = powerbi.VisualObjectInstance;
import DataView = powerbi.DataView;
import VisualObjectInstanceEnumerationObject = powerbi.VisualObjectInstanceEnumerationObject;
import ISelectionManager = powerbi.extensibility.ISelectionManager;

import DataViewCategoryColumn = powerbi.DataViewCategoryColumn;
import DataViewCategoricalColumn = powerbi.DataViewCategoricalColumn

import { VisualSettings } from "./settings";
import VisualObjectInstanceEnumeration = powerbi.VisualObjectInstanceEnumeration;
import EnumerateVisualObjectInstancesOptions = powerbi.EnumerateVisualObjectInstancesOptions;

import FilterAction = powerbi.FilterAction;
import {
    IFilter,
    IFilterColumnTarget,
    IAdvancedFilter,
    Filter,
    PrimitiveValueType,
    IAdvancedFilterCondition
} from "powerbi-models"

import converter from "./converter";
import { Select } from "./components";
import { ViewModel, DataPoints, Callbacks } from "./interface";
import { IDS, CLASSNAME, PATH } from './constants'
import { thresholdFreedmanDiaconis } from "d3";

export class Visual implements IVisual {
    private target: HTMLElement;
    private host: IVisualHost;
    private dropdown: HTMLElement;
    private outerDiv: HTMLElement;
    private dropImage: HTMLElement;
    private dropButtonText: HTMLElement;
    private dropButton: HTMLElement;
    private settings: VisualSettings;
    private viewmodelData: ViewModel;
    private selectionManager: ISelectionManager;
    private dataview;
    private ViewPortRender: Boolean; // might be used in future to decider wheather to render or not
    private enableMultiSelect: Boolean;
    private iconColor: string;
    private iconBackground: string;
    private checkboxOutline: string;
    private checkboxBackground: string;

    private visualSettings: VisualSettings;

    private static getLengthOptional(identity: any[]): number {
        if (identity) {
            return identity.length;
        }
        return 0;
    }


    /**
     * Compare if the data has changed 
     * @param dataView1 
     * @param dataView2 
     */
    private static hasSameCategoryIdentity(dataView1: DataView, dataView2: DataView): boolean {
        if (!dataView1 ||
            !dataView2 ||
            !dataView1.categorical ||
            !dataView2.categorical) {
            return false;
        }

        let dv1Categories: DataViewCategoricalColumn[] = dataView1.categorical.categories;
        let dv2Categories: DataViewCategoricalColumn[] = dataView2.categorical.categories;

        if (!dv1Categories ||
            !dv2Categories ||
            dv1Categories.length !== dv2Categories.length) {
            return false;
        }

        for (let i: number = 0, len: number = dv1Categories.length; i < len; i++) {
            let dv1Identity: any[] = (<DataViewCategoryColumn>dv1Categories[i]).identity;
            let dv2Identity: any[] = (<DataViewCategoryColumn>dv2Categories[i]).identity;

            let dv1Length: number = this.getLengthOptional(dv1Identity);
            if ((dv1Length < 1) || dv1Length !== this.getLengthOptional(dv2Identity)) {
                return false;
            }

            for (let j: number = 0; j < dv1Length; j++) {
                // if (!isEqual(dv1Identity[j].key, dv2Identity[j].key)) {
                //     return false;
                // }
                if (dv1Identity[j].key != dv2Identity[j].key) {
                    return false;
                }
            }
        }

        return true;
    }


    constructor(options: VisualConstructorOptions) {
        this.host = options.host;
        this.target = options.element;
        this.ViewPortRender = false;
        if (document) {
            this.dropdown = document.createElement('div');
            this.dropdown.className = 'dropdown';

            this.dropButton = document.createElement('div');
            this.dropButtonText = document.createElement('span')
            this.dropButtonText.innerHTML='Select'
            this.dropButton.appendChild(this.dropButtonText)

            this.dropButton.setAttribute('id', IDS.button);
            this.dropButton.setAttribute('class', CLASSNAME.dropdownbutton);

            this.dropImage = document.createElement('img');
            this.dropImage.setAttribute('src', PATH.droparrow);
            this.dropImage.setAttribute('id', IDS.droparrow);
            this.dropImage.setAttribute('class', CLASSNAME.droparrow);
            this.dropButton.appendChild(this.dropImage);

            this.dropdown.appendChild(this.dropButton);


            this.outerDiv = document.createElement('div');
            this.outerDiv.setAttribute('id', IDS.outerDiv);
            this.outerDiv.setAttribute('class', CLASSNAME.outerDiv);

            this.dropdown.append(this.outerDiv)

            this.target.appendChild(this.dropdown);
            this.dropButton.onclick = ()=>this.showDropdown()
            this.target.innerHTML = `<select name="cars" id="cars">
            <option value="volvo">Volvo</option>
            <option value="saab">Saab</option>
            <option value="mercedes">Mercedes</option>
            <option value="audi">Audi</option>
          </select>`;


        }

        this.selectionManager = options.host.createSelectionManager();
    }
    public showDropdown() {
        // const div: HTMLElement = document.getElementById(IDS.innerDiv)
        if(this.outerDiv){
            if(this.outerDiv.style.display === 'none'){
                this.outerDiv.style.display = 'block';
            }else{
                this.outerDiv.style.display = 'none';
            }
        }
        console.log('show dropdown')
    }

    private loadData(options: VisualUpdateOptions) {
        this.viewmodelData = converter(options, this.host)

    }


    public update(options: VisualUpdateOptions) {

        console.log('this.target', this.target.parentElement.parentElement.parentElement)
        const existingDataview = this.dataview
        this.dataview = options.dataViews[0]
        let width = options.viewport.width;
        let height = options.viewport.height;

        this.dropdown.style.width =  String(options.viewport.width - 5) +'px';
        this.dropdown.style.height =  String(options.viewport.height) + 'px';

        let categoryIdentityChanged: boolean = true;
        if (existingDataview) {
            categoryIdentityChanged = !Visual.hasSameCategoryIdentity(existingDataview, this.dataview);

        }

        this.visualSettings = VisualSettings.parse<VisualSettings>(this.dataview);

        let dropUrl = this.visualSettings.dataPoint.dropUrl;
        let imageSize: number = this.visualSettings.dataPoint.imageSize;
        let fontSize: number = this.visualSettings.dataPoint.fontSize;
        let fontName = this.visualSettings.dataPoint.fontName;
        let dropBackground = this.visualSettings.dataPoint.dropdownBackground;
        let dropOutline = this.visualSettings.dataPoint.dropdownOutline;
        let checkboxOutline = this.visualSettings.dataPoint.checkboxOutline;
        let checkboxBackground = this.visualSettings.dataPoint.checkboxBackground;
        let enableMultiSelect = this.visualSettings.dataPoint.multiselect;
        let iconColor = this.visualSettings.dataPoint.checkboxicon;
        let iconBackground = this.visualSettings.dataPoint.iconBackground;

        this.dropImage.style.width = String(imageSize) + 'px';
        this.dropImage.style.height = String(imageSize) + 'px';
        this.dropButton.style.fontSize = String(fontSize) + 'px';

        this.dropdown.style.fontFamily = String(fontName) ; 

        let dropButtonHeight: number =  imageSize > fontSize ? imageSize : fontSize;

        this.dropImage.style.marginTop = String((dropButtonHeight - imageSize +10 ) /2) +'px';
        this.dropButton.style.height = String(dropButtonHeight+ 10) + 'px';
        this.dropButton.style.lineHeight = String(dropButtonHeight + 10) + 'px';
        this.outerDiv.style.height = String(height - imageSize) + 'px';


        // console.log('DropBackgound', dropBackground)
        // console.log('checkBoxoutline', checkboxOutline)
        // console.log('checkboxBackground', checkboxBackground)
        // console.log('iconCOlor', this.iconColor, iconColor)

        let button = document.getElementById(IDS.button)
        button.style.backgroundColor = dropBackground;
        button.style.borderColor = dropOutline;

        // let inputTag as HTMLCollection<HTMLLIElement> = document.getElementsByClassName('checkmark') 
        let inputTag = document.getElementsByClassName('tick') as HTMLCollectionOf<HTMLElement>
        for (let i = 0; i < inputTag.length; i++) {
            inputTag[i].style.backgroundColor = checkboxBackground;
            inputTag[i].style.borderColor = checkboxOutline;
        }


        let img = document.getElementById(IDS.droparrow)
        img.setAttribute('src', dropUrl)

        if (categoryIdentityChanged
            || enableMultiSelect !== this.enableMultiSelect
            || this.iconColor !== iconColor
            || this.iconBackground !== iconBackground
            || this.checkboxBackground !== checkboxBackground
            || this.checkboxOutline !== checkboxOutline
        ) {

            this.enableMultiSelect = enableMultiSelect;
            this.iconColor = iconColor;
            this.iconBackground = iconBackground;
            this.checkboxBackground = checkboxBackground;
            this.checkboxOutline = checkboxOutline;
            this.loadData(options)

            let select_elem = new Select(this.viewmodelData, this.outerDiv, this.selectionManager, this.host, this.getCallbacks(), enableMultiSelect, iconColor, iconBackground, checkboxBackground, this.dropButtonText)

            select_elem.draw()

            let checked = document.getElementsByClassName('checkmark') as HTMLCollectionOf<HTMLElement>
            for (let i = 0; i < checked.length; i++) {
                checked[i].style.backgroundColor = checkboxBackground;
                checked[i].style.borderColor = checkboxOutline;
            }
            checked = document.getElementsByClassName('tickmark') as HTMLCollectionOf<HTMLElement>
            for (let i = 0; i < checked.length; i++) {
                checked[i].style.backgroundColor = checkboxBackground;
                checked[i].style.borderColor = checkboxOutline;
            }

            // if(!this.ViewPortRender){
            //     this.ViewPortRender = true;

            // }

            this.settings = Visual.parseSettings(options && options.dataViews && options.dataViews[0]);
        }

    }

    /**
     * options.viewport.width
     *  Callbacks consumed by the SelectionBehavior class
     */
    private getCallbacks(): Callbacks {
        let callbacks: Callbacks = {};
        callbacks.applyAdvancedFilter = (filter: IAdvancedFilter): void => {
            this.host.applyJsonFilter(filter, "general", "filter", FilterAction.merge);
        };

        callbacks.getAdvancedFilterColumnTarget = (): IFilterColumnTarget => {
            let categories: DataViewCategoricalColumn = this.dataview.categorical.categories[0];

            let target: IFilterColumnTarget = {
                table: categories.source.queryName.substr(0, categories.source.queryName.indexOf('.')),
                column: categories.source.displayName
            }

            return target;
        };

        return callbacks;
    }


    private static parseSettings(dataView: DataView): VisualSettings {
        return <VisualSettings>VisualSettings.parse(dataView);
    }

    /**
     * This function gets called for each of the objects defined in the capabilities files and allows you to select which of the
     * objects and properties you want to expose to the users in the property pane.
     *
     */
    public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): VisualObjectInstanceEnumeration {
        const settings: VisualSettings = this.visualSettings || <VisualSettings>VisualSettings.getDefault();
        return VisualSettings.enumerateObjectInstances(settings, options);
    }
}