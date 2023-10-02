import {
    IFilter,
    IFilterColumnTarget,
    IAdvancedFilter,
    Filter,
    AdvancedFilter,
    PrimitiveValueType,
    IAdvancedFilterCondition,
    BasicFilter
} from "powerbi-models";
import powerbi from "powerbi-visuals-api";
import FilterAction = powerbi.FilterAction;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import ISelectionManager = powerbi.extensibility.ISelectionManager;


import { IDS, CLASSNAME, SVG } from './constants';
import { ViewModel, DataPoints, Callbacks } from './interface';


export class Select {
    private data: ViewModel;
    private target: HTMLElement;
    private innerDiv: HTMLElement;
    private selectionManager: ISelectionManager;
    private host: IVisualHost;
    private getCallbacks: Callbacks;
    private selectedValues: any[];
    private radioIndex: Number;
    private radioButton: HTMLElement;
    private ViewPortRender: Boolean;
    private enableMultiSelect: Boolean;
    private iconcolor: string;
    private iconBackground: string;
    private checkboxBackground: string;
    private dropButtonText: HTMLElement;

    constructor(data: ViewModel, target: HTMLElement, selectionManager: ISelectionManager, host: IVisualHost, getCallbacks: Callbacks, enableMultiselect: boolean, iconcolor: string, iconBackground: string, checkboxBackground: string, dropButtonText: HTMLElement) {
        this.data = data;
        this.target = target;
        this.host = host;
        this.selectionManager = selectionManager;
        this.getCallbacks = getCallbacks;
        this.selectedValues = [];
        this.radioIndex = null;
        this.radioButton = null;
        this.enableMultiSelect = enableMultiselect;
        this.iconcolor = iconcolor;
        this.iconBackground = iconBackground;
        this.checkboxBackground = checkboxBackground;
        this.dropButtonText = dropButtonText;
    }

    /**
     * 
     * Clean up before draw
     */
    private preDraw() {
        // Remove first
        let prevDiv = document.getElementById(IDS.innerDiv)
        if (prevDiv) {
            prevDiv.remove()
        }
        let prevSS = document.getElementById('csvg')

        if (prevSS) {
            prevSS.remove()
        }


        // Add again
        this.innerDiv = document.createElement('div');
        this.innerDiv.setAttribute('id', IDS.innerDiv);
        this.innerDiv.setAttribute('class', CLASSNAME.innerDiv);
    }

    /**
     * 
     * Draw the componeents
     * 
     */
    public draw() {
        this.preDraw()
        this.data.events.forEach((d, k) => {
            const new_div: HTMLElement = document.createElement('div');
            new_div.setAttribute('class', CLASSNAME.lableWrapper);

            const new_label: HTMLElement = document.createElement('label');
            new_label.setAttribute('for', `{d.category}-{k}`)
            new_label.setAttribute('class', CLASSNAME.lableclass)
            const span: HTMLElement = document.createElement('span');

            let li_elment: HTMLElement
            if (this.enableMultiSelect) {
                span.setAttribute('class', 'tickmark')
                li_elment = this.insertCheckbox(d, k, span)
            } else {
                span.setAttribute('class', 'checkmark')
                li_elment = this.insertRadioButton(d, k, 'group', span)
            }

            new_label.appendChild(li_elment)
            new_label.appendChild(span)
            new_label.appendChild(document.createTextNode(d.category))

            new_div.appendChild(new_label)
            this.innerDiv.appendChild(new_div)
        })

        this.postDraw()
    }

    private postDraw() {
        this.target.appendChild(this.innerDiv)

    }

    /**
     * Checkbox item li element add 
     * @param d 
     * @param k 
     * @param span 
     */
     private insertCheckbox(d, k, span: HTMLElement): HTMLElement {
        const new_checkbox: HTMLElement = document.createElement('input');
        new_checkbox.setAttribute('type', 'checkbox');
        new_checkbox.setAttribute('id', `{d.category}-{k}`);
        new_checkbox.setAttribute('name', `{d.category}-{k}`);
        new_checkbox.addEventListener("change", (event) => {
            // handle click event to apply correspond selection
            // this.selectionManager.select(d.selectionId);
            let value: boolean = false;
            const target = event.target as HTMLInputElement
            if (target.checked) {

                span.style.background = this.iconBackground;

                let doc = new DOMParser().parseFromString(SVG.tick_1 + this.iconcolor + SVG.tick_2, 'application/xml');
                span.appendChild(span.ownerDocument.importNode(doc.documentElement, true));

            } else {
                span.firstChild.remove()
                span.style.background = this.checkboxBackground;

            }
            this.applySelectionFilter(d, target.checked);
        })

        return new_checkbox;
    }

    /**
     * RadioButton Li elements adding 
     * @param d 
     * @param k 
     * @param groupName 
     * @param span 
     */
    private insertRadioButton(d, k, groupName, span: HTMLElement): HTMLElement {
        const new_checkbox: HTMLElement = document.createElement('input');
        new_checkbox.setAttribute('type', 'radio');
        new_checkbox.setAttribute('id', `{d.category}-{k}`);
        new_checkbox.setAttribute('name', groupName);
        if (this.radioIndex === k) {
            new_checkbox.setAttribute('checked', 'true');

        }
        new_checkbox.addEventListener("change", (event) => {
            // handle click event to apply correspond selection
            // this.selectionManager.select(d.selectionId);
            // const innerdot: HTMLElement = document.createElement('span');
            // innerdot.className = 'inner-dot';
            // span.appendChild(innerdot);
            let prevSS = document.getElementById('csvg')

            if (prevSS) {
                prevSS.parentElement.style.backgroundColor = this.checkboxBackground
                prevSS.remove()
            }

            span.style.background = this.iconBackground;


            // if(this.radioButton){
            //     this.radioButton.classList.remove('dot') // remove previous dot
            // }

            let doc = new DOMParser().parseFromString(
                '<svg id ="csvg" xmlns="http://www.w3.org/2000/svg" width="12" height="12"><circle cx="6" cy="6" r="4" fill=" ' + this.iconcolor + '"  /></svg>',
                'application/xml');
            span.appendChild(
                span.ownerDocument.importNode(doc.documentElement, true));

            // span.classList.add('dot')
            this.radioButton = span
            this.radioIndex = k
            this.applyFilter(d)
        })

        return new_checkbox

    }


    private applyFilter(value) {
        let conditions: IAdvancedFilterCondition[] = [];
        let target: IFilterColumnTarget = this.getCallbacks.getAdvancedFilterColumnTarget();

        conditions.push({
            operator: "Is",
            value: value.category
        });
        this.dropButtonText.innerHTML =  value.category; 

        let filter = new AdvancedFilter(target, "And", conditions);

        // invoke the filter
        this.host.applyJsonFilter(filter, "general", "filter", FilterAction.merge);

    }

    private applySelectionFilter(value, checked: boolean) {


        if (checked) {
            this.selectedValues.push(value.category);
        } else {
            this.selectedValues = this.selectedValues.filter(obj => obj !== value.category);
        }
        if(this.selectedValues.length > 0){
            if(this.selectedValues.length> 1){
                this.dropButtonText.innerHTML = "Multiple Selected"
            }else{
                this.dropButtonText.innerHTML = value.category; 
            }

            let target: IFilterColumnTarget = this.getCallbacks.getAdvancedFilterColumnTarget(); 
            let filter = new BasicFilter(target, "In", this.selectedValues);

            // invoke the filter
            this.host.applyJsonFilter(filter, "general", "filter", FilterAction.merge);
        }else{
            this.dropButtonText.innerHTML = "All Selected"
            this.host.applyJsonFilter(null, "general", "filter", FilterAction.merge);


        }


    }


}