import { Fragment as div, FunctionComponent, h, JSX, createContext, Component } from 'preact';
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import '../styles.css';
import styles from './assembly.module.css';
import { classes } from '../util';
import { Scrollable } from "../scrollable";

import { IProfileModel } from '../model';
import { VsCodeApi } from '../vscodeApi';
import { IOpenDocumentMessage } from '../types';
declare const MODELS: IProfileModel[];

interface Location {
	file: string;
	line: number;
}

const integerFormat = new Intl.NumberFormat(undefined, {
	maximumFractionDigits: 0
});

interface Line {
	pc?: number;
	hits?: number;
	cycles?: number;
	text: string;
	loc?: Location;
}

interface AssemblyProps {
	frame: number; 
	time: number;
}

export class AssemblyView extends Component<AssemblyProps> {
	private scroller: Scrollable;
	private oldSel: HTMLDivElement;

	constructor() {
		super();
	}

	private updateSelection() {
		if(!this.scroller)
			this.scroller = new Scrollable(this.base.parentElement, 135);

		const pcTrace = MODELS[this.props.frame].amiga.pcTrace;
		let time = 0;
		let pc = 0;
		for(let i = 0; i < pcTrace.length; i += 2) {
			pc = pcTrace[i];
			time += pcTrace[i + 1];
			if(time > this.props.time)
				break;
		}
		if(this.oldSel) {
			this.oldSel.classList.remove(styles.cur);
			this.oldSel = undefined;
		}
		if(pc >= 0 && pc < 0x7fffffff) {
			const xx = (this.base as ParentNode).querySelector(`[data-pc='${pc}']`) as HTMLDivElement;
			if(xx) {
				xx.classList.add(styles.cur);
				this.oldSel = xx;
				this.scroller.setScrollPositionSmooth(xx.offsetTop - this.base.parentElement.clientHeight / 2);
			}
		}
	}

	public shouldComponentUpdate(nextProps: AssemblyProps) {
		// we render just once and update the selection via direct DOM manipulation (performance!)
		if(nextProps.frame !== this.props.frame)
			return true;
		this.updateSelection();
		return false;
	}

	private onClick(evt: MouseEvent) {
		VsCodeApi.postMessage<IOpenDocumentMessage>({
			type: 'openDocument',
			location: {
				lineNumber: (evt.srcElement as HTMLElement).attributes['data-line'].value,
				columnNumber: 0,
				source: { path: (evt.srcElement as HTMLElement).attributes['data-file'].value }
			},
			toSide: true,
		});
	}

	public render() {
		const textSection = MODELS[0].amiga.sections.find((section) => section.name === '.text');
		const hits = new Array<number>(textSection.size >> 1).fill(0);
		const cycles = new Array<number>(textSection.size >> 1).fill(0);
		const pcTrace = MODELS[this.props.frame].amiga.pcTrace;
		for(let i = 0; i < pcTrace.length; i += 2) {
			if(pcTrace[i] >= 0 && pcTrace[i] < textSection.size) {
				hits[pcTrace[i] >> 1]++;
				cycles[pcTrace[i] >> 1] += pcTrace[i + 1];
			}
		}

		const lines = MODELS[0].amiga.objdump.replace(/\r/g, '').split('\n');
		const content: Line[] = [];
		let loc;
		for(const line of lines) {
			const locMatch = line.match(/^(\S.+):([0-9]+)( \(discriminator [0-9]+\))?$/);
			if(locMatch) {
				loc = { file: locMatch[1], line: parseInt(locMatch[2]) };
				continue;
			}

			const insnMatch = line.match(/^ *([0-9a-f]+):\t/);
			if(insnMatch) {
				const pc = parseInt(insnMatch[1], 16);
				content.push({
					pc,
					hits: hits[pc >> 1],
					cycles: cycles[pc >> 1],
					text: line,
					loc
				});
				loc = undefined;
			} else {
				content.push({ text: line });
			}
		}
		return (<div class={styles.container}>
			{content.map((c) => c.pc === undefined
			? <div>{c.text + '\n'}</div>
			: <div data-pc={c.pc} class={c.cycles === 0 ? styles.zero : ''}>
				<span class={styles.duration}>{integerFormat.format(c.cycles).padStart(8) + 'cy (' + integerFormat.format(c.hits).padStart(6) + ') '}</span>
				{c.text}
				{c.loc !== undefined ? <a href='#' data-file={c.loc.file} data-line={c.loc.line} onClick={this.onClick} class={styles.file}>{c.loc.file}:{c.loc.line}</a> : ''}
				{'\n'}
			</div>)}
		</div>);
	}
/*
	//						<ImpactBar impact={node.selfTime / root.aggregateTime} />
	//						{formatValue(node.selfTime, root.aggregateTime, displayUnit)}

	useEffect(() => {
		console.log("time", time);
	}, [time]);

	return Content;
*/	
};
