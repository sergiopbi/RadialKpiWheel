"use strict";

import powerbi from "powerbi-visuals-api";
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import "./../style/visual.less";

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import ISelectionManager = powerbi.extensibility.ISelectionManager;
import DataView = powerbi.DataView;
import DataViewValueColumn = powerbi.DataViewValueColumn;

import { VisualFormattingSettingsModel } from "./settings";

const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * Extracts the literal prefix/suffix text and decimal precision directly from a Power BI number
 * format string's positive section (e.g. "€ #,0.00;€ -#,0.00 ;€ #,0.00" -> prefix "€ ", 2 decimals).
 * This replaces relying on the powerbi-visuals-utils-formattingutils valueFormatter, which proved
 * unreliable across several real dynamic/multi-section format strings (wrong scale unit, dropped
 * decimals, dropped currency symbol) - fully manual parsing is slower to write but deterministic.
 */
function parseFormatSection(section: string): { prefix: string; suffix: string; decimals: number } {
    const match = /[#0][#0,. ]*[#0]|[#0]/.exec(section || "");
    if (!match) {
        return { prefix: (section || "").trim(), suffix: "", decimals: 0 };
    }
    const numPattern = match[0];
    const prefix = section.slice(0, match.index);
    const suffix = section.slice(match.index + numPattern.length);
    const decimalMatch = /\.([0#]+)/.exec(numPattern);
    const decimals = decimalMatch ? decimalMatch[1].length : 0;
    return { prefix, suffix, decimals };
}

/** Formats a number using our own magnitude-based K/M/bn scaling and the prefix/suffix/decimals
 * parsed directly from the measure's format string (see parseFormatSection above). */
function formatValueSafeScale(value: number, formatString: string): string {
    if (/%/.test(formatString || "")) {
        return (value * 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%";
    }

    const sections = (formatString || "").split(";");
    const { prefix, suffix, decimals } = parseFormatSection(sections[0]);

    const abs = Math.abs(value);
    let divisor = 1;
    let unitLetter = "";
    if (abs >= 1e9) { divisor = 1e9; unitLetter = "bn"; }
    else if (abs >= 1e6) { divisor = 1e6; unitLetter = "M"; }
    else if (abs >= 1e3) { divisor = 1e3; unitLetter = "K"; }

    const scaled = value / divisor;
    const numberText = scaled.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    return `${prefix}${numberText}${unitLetter}${suffix}`;
}
const MAX_SLICES = 13;

function orderKey(displayName: string, naturalIndex: number): [number, number] {
    const match = /^\s*(\d+)/.exec(displayName || "");
    const prefix = match ? parseInt(match[1], 10) : Number.MAX_SAFE_INTEGER;
    return [prefix, naturalIndex];
}

function compareOrderKeys(a: [number, number], b: [number, number]): number {
    return a[0] !== b[0] ? a[0] - b[0] : a[1] - b[1];
}

function toRad(deg: number): number {
    return (deg * Math.PI) / 180;
}

function polarPoint(cx: number, cy: number, r: number, angleDeg: number) {
    const rad = toRad(angleDeg);
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/**
 * Wedge (annular sector) whose gap to its neighbors is a CONSTANT PIXEL WIDTH rather than a
 * constant angle. A pure angular gap looks much wider at the outer edge than at the inner edge
 * (arc length = radius * angle); to keep it visually constant we widen the angular offset at the
 * inner radius and narrow it at the outer radius so both trace the same physical distance.
 */
function constantGapWedgePath(cx: number, cy: number, innerR: number, outerR: number, idealStart: number, idealEnd: number, gapPx: number): string {
    const halfGap = gapPx / 2;
    const safeOuterR = Math.max(1, outerR);
    const safeInnerR = Math.max(1, innerR);
    const outerOffsetDeg = (halfGap / safeOuterR) * (180 / Math.PI);
    const innerOffsetDeg = (halfGap / safeInnerR) * (180 / Math.PI);

    const outerStart = idealStart + outerOffsetDeg;
    const outerEnd = idealEnd - outerOffsetDeg;
    const innerStart = idealStart + innerOffsetDeg;
    const innerEnd = idealEnd - innerOffsetDeg;

    const largeArc = (outerEnd - outerStart) % 360 > 180 ? 1 : 0;

    const p1 = polarPoint(cx, cy, outerR, outerStart);
    const p2 = polarPoint(cx, cy, outerR, outerEnd);
    const p3 = polarPoint(cx, cy, innerR, innerEnd);
    const p4 = polarPoint(cx, cy, innerR, innerStart);

    return [
        `M ${p1.x} ${p1.y}`,
        `A ${outerR} ${outerR} 0 ${largeArc} 1 ${p2.x} ${p2.y}`,
        `L ${p3.x} ${p3.y}`,
        `A ${innerR} ${innerR} 0 ${largeArc} 0 ${p4.x} ${p4.y}`,
        "Z"
    ].join(" ");
}

/**
 * Remaps a linear 0..1 completion ratio onto a power or log curve that stretches the
 * differences among HIGH values (close to 1) - useful when a "start value" already zooms
 * into a narrow high-percentage band and small differences still need to stand out more.
 */
function applyScale(t: number, scaleType: string, intensity: number): number {
    const clamped = Math.max(0, Math.min(1, t));
    const k = Math.max(0.01, intensity);
    if (scaleType === "power") {
        return Math.pow(clamped, k);
    }
    if (scaleType === "log") {
        return 1 - Math.log(1 + k * (1 - clamped)) / Math.log(1 + k);
    }
    return clamped;
}

function hexToRgb(hex: string): [number, number, number] {
    const clean = (hex || "#000000").replace("#", "");
    const full = clean.length === 3 ? clean.split("").map(c => c + c).join("") : clean;
    const num = parseInt(full, 16);
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
    const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
    return `#${c(r)}${c(g)}${c(b)}`;
}

function lerpColor(colorA: string, colorB: string, t: number): string {
    const a = hexToRgb(colorA);
    const b = hexToRgb(colorB);
    return rgbToHex(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t);
}

/** 5-stop interpolation across 0%, 25%, 50%, 75%, 100% */
function lerpColor5(c0: string, c25: string, c50: string, c75: string, c100: string, t: number): string {
    const clamped = Math.max(0, Math.min(1, t));
    if (clamped <= 0.25) return lerpColor(c0, c25, clamped / 0.25);
    if (clamped <= 0.5) return lerpColor(c25, c50, (clamped - 0.25) / 0.25);
    if (clamped <= 0.75) return lerpColor(c50, c75, (clamped - 0.5) / 0.25);
    return lerpColor(c75, c100, (clamped - 0.75) / 0.25);
}

let measureCanvas: HTMLCanvasElement | null = null;
function measureTextWidth(text: string, fontSize: number, fontFamily: string, bold: boolean): number {
    if (!measureCanvas) {
        measureCanvas = document.createElement("canvas");
    }
    const ctx = measureCanvas.getContext("2d");
    if (!ctx) {
        return text.length * fontSize * 0.55; // rough fallback
    }
    ctx.font = `${bold ? "bold " : ""}${fontSize}px ${fontFamily}`;
    return ctx.measureText(text).width;
}

/** Greedy word-wrap: fits words into lines no wider than maxWidth, capped at maxLines (last line gets an ellipsis if truncated). */
function wrapText(text: string, maxWidth: number, fontSize: number, fontFamily: string, bold: boolean, maxLines: number): string[] {
    const words = (text || "").split(/\s+/).filter(Boolean);
    if (words.length === 0) {
        return [];
    }

    const lines: string[] = [];
    let current = "";

    for (const word of words) {
        const candidate = current ? `${current} ${word}` : word;
        if (measureTextWidth(candidate, fontSize, fontFamily, bold) <= maxWidth || !current) {
            current = candidate;
        } else {
            lines.push(current);
            current = word;
            if (lines.length >= maxLines) {
                break;
            }
        }
    }
    if (current && lines.length < maxLines) {
        lines.push(current);
    }

    if (lines.length >= maxLines) {
        // Truncate the last line with an ellipsis if the full text didn't fit
        const consumed = lines.slice(0, maxLines).join(" ");
        if (consumed.length < text.length) {
            let last = lines[maxLines - 1];
            while (last.length > 1 && measureTextWidth(last + "…", fontSize, fontFamily, bold) > maxWidth) {
                last = last.slice(0, -1);
            }
            lines[maxLines - 1] = last + "…";
        }
        return lines.slice(0, maxLines);
    }

    return lines;
}

export class Visual implements IVisual {
    private target: HTMLElement;
    private svg: SVGSVGElement;
    private host: IVisualHost;
    private selectionManager: ISelectionManager;
    private fileInputEl: HTMLInputElement;
    private uploadBtnEl: HTMLDivElement;
    private landingPageEl: HTMLDivElement;
    private formattingSettings: VisualFormattingSettingsModel;
    private formattingSettingsService: FormattingSettingsService;

    constructor(options: VisualConstructorOptions) {
        this.target = options.element;
        this.host = options.host;
        this.formattingSettingsService = new FormattingSettingsService(options.host.createLocalizationManager());
        this.selectionManager = options.host.createSelectionManager();
        this.target.style.overflow = "hidden";
        this.target.style.backgroundColor = "transparent";
        this.target.style.position = "relative";

        this.svg = document.createElementNS(SVG_NS, "svg") as SVGSVGElement;
        this.svg.setAttribute("class", "radialKpiWheelSvg");
        this.svg.style.backgroundColor = "transparent";
        this.target.appendChild(this.svg);

        // Whole-visual context menu. There's no per-slice identity in this visual (no category
        // role - every slice is an independent measure), so there's nothing more granular to
        // right-click on than "the visual" - use an empty selection ID bound to the whole thing.
        this.svg.addEventListener("contextmenu", (e: MouseEvent) => {
            e.preventDefault();
            if (this.host.hostCapabilities.allowInteractions === false) {
                return;
            }
            this.selectionManager.showContextMenu(
                this.host.createSelectionIdBuilder().createSelectionId(),
                { x: e.clientX, y: e.clientY }
            );
        });

        this.fileInputEl = document.createElement("input");
        this.fileInputEl.type = "file";
        this.fileInputEl.accept = "image/*";
        this.fileInputEl.style.display = "none";
        this.fileInputEl.addEventListener("change", this.onFileSelected);
        this.target.appendChild(this.fileInputEl);

        this.uploadBtnEl = document.createElement("div");
        this.uploadBtnEl.className = "radialKpiWheelUploadBtn";
        this.uploadBtnEl.textContent = "+ Icon";
        this.uploadBtnEl.style.position = "absolute";
        this.uploadBtnEl.setAttribute("tabindex", "0");
        this.uploadBtnEl.setAttribute("role", "button");
        this.uploadBtnEl.setAttribute("aria-label", "Upload a center icon image");
        this.uploadBtnEl.addEventListener("click", () => this.fileInputEl.click());
        this.uploadBtnEl.addEventListener("keydown", (e: KeyboardEvent) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                this.fileInputEl.click();
            }
        });
        this.target.appendChild(this.uploadBtnEl);

        this.landingPageEl = document.createElement("div");
        this.landingPageEl.className = "radialKpiWheelLandingPage";
        this.landingPageEl.style.display = "none";
        this.target.appendChild(this.landingPageEl);
    }

    private onFileSelected = (e: Event): void => {
        const input = e.target as HTMLInputElement;
        if (!input.files || input.files.length === 0) {
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            const dataUri = reader.result as string;
            this.host.persistProperties({
                merge: [{
                    objectName: "center",
                    selector: undefined,
                    properties: { icon: dataUri }
                }]
            });
        };
        reader.readAsDataURL(input.files[0]);
    };

    public update(options: VisualUpdateOptions) {
        this.host.eventService.renderingStarted(options);
        try {
            this.render(options);
            this.host.eventService.renderingFinished(options);
        } catch (err) {
            this.host.eventService.renderingFailed(options, String(err));
            throw err;
        }
    }

    private render(options: VisualUpdateOptions) {
        const dataView: DataView = options.dataViews && options.dataViews[0];
        this.formattingSettings = this.formattingSettingsService.populateFormattingSettingsModel(VisualFormattingSettingsModel, dataView);

        while (this.svg.firstChild) {
            this.svg.removeChild(this.svg.firstChild);
        }

        const width = options.viewport.width;
        const height = options.viewport.height;
        this.svg.setAttribute("width", String(width));
        this.svg.setAttribute("height", String(height));
        this.svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

        const hasValues = !!(dataView && dataView.categorical && dataView.categorical.values &&
            (dataView.categorical.values as unknown as DataViewValueColumn[]).some(c => c.source.roles && c.source.roles["values"]));

        if (!hasValues) {
            this.showLandingPage(width, height);
            return;
        }
        this.hideLandingPage();

        const allValueColumns: DataViewValueColumn[] = dataView.categorical.values as unknown as DataViewValueColumn[];
        let valueColumns: DataViewValueColumn[] = allValueColumns.filter(c => c.source.roles && c.source.roles["values"]);

        valueColumns = valueColumns
            .map((col, i) => ({ col, key: orderKey(col.source.displayName, i) }))
            .sort((a, b) => compareOrderKeys(a.key, b.key))
            .map(x => x.col)
            .slice(0, MAX_SLICES);

        const n = valueColumns.length;
        if (n === 0) {
            return;
        }

        const ring = this.formattingSettings.ringCard;
        const refRings = this.formattingSettings.referenceRingsCard;
        const coloring = this.formattingSettings.coloringCard;
        const sliceColors = this.formattingSettings.sliceColorsCard;
        const label = this.formattingSettings.valueLabelCard;
        const center = this.formattingSettings.centerCard;

        const isHighContrast = !!(this.host.colorPalette && this.host.colorPalette.isHighContrast);
        const hcForeground = isHighContrast ? this.host.colorPalette.foreground.value : null;
        const hcBackground = isHighContrast ? this.host.colorPalette.background.value : null;

        const sliceColorList = isHighContrast
            ? new Array(MAX_SLICES).fill(hcForeground)
            : [
                sliceColors.slice1.value.value, sliceColors.slice2.value.value, sliceColors.slice3.value.value,
                sliceColors.slice4.value.value, sliceColors.slice5.value.value, sliceColors.slice6.value.value,
                sliceColors.slice7.value.value, sliceColors.slice8.value.value, sliceColors.slice9.value.value,
                sliceColors.slice10.value.value, sliceColors.slice11.value.value, sliceColors.slice12.value.value,
                sliceColors.slice13.value.value
            ];

        const targetValue = ring.targetValue.value || 1;
        const startValue = ring.startValue.value || 0;
        const scaleType = ring.scaleType.value.value as string;
        const scaleIntensity = ring.scaleIntensity.value;
        const scaleRange = (targetValue - startValue) || 1;
        const cx = width / 2;
        const cy = height / 2;
        const margin = 12 + (ring.showOutline.value ? ring.outlineWidth.value : 0);
        const outerMaxRadius = Math.max(10, Math.min(width, height) / 2 - margin);
        const innerRadius = outerMaxRadius * Math.max(0, Math.min(90, ring.innerRadiusPercent.value)) / 100;

        const anglePerSlice = 360 / n;
        const startOffset = -90; // start at 12 o'clock
        const gapPx = Math.max(0, ring.gapPixels.value);

        const defs = document.createElementNS(SVG_NS, "defs");
        this.svg.appendChild(defs);

        // Outer outline
        if (ring.showOutline.value) {
            const outline = document.createElementNS(SVG_NS, "circle");
            outline.setAttribute("cx", String(cx));
            outline.setAttribute("cy", String(cy));
            outline.setAttribute("r", String(outerMaxRadius + ring.outlineWidth.value / 2 + 3));
            outline.setAttribute("fill", "none");
            outline.setAttribute("stroke", isHighContrast ? hcForeground : ring.outlineColor.value.value);
            outline.setAttribute("stroke-width", String(ring.outlineWidth.value));
            this.svg.appendChild(outline);
        }

        // Reference rings (constant target lines, native-style "add a reference line")
        const refRingDefs: Array<{ enabled: boolean; value: number; color: string; width: number }> = [
            { enabled: refRings.ring1Enabled.value, value: refRings.ring1Value.value, color: refRings.ring1Color.value.value, width: refRings.ring1Width.value },
            { enabled: refRings.ring2Enabled.value, value: refRings.ring2Value.value, color: refRings.ring2Color.value.value, width: refRings.ring2Width.value },
            { enabled: refRings.ring3Enabled.value, value: refRings.ring3Value.value, color: refRings.ring3Color.value.value, width: refRings.ring3Width.value },
            { enabled: refRings.ring4Enabled.value, value: refRings.ring4Value.value, color: refRings.ring4Color.value.value, width: refRings.ring4Width.value }
        ];
        refRingDefs.forEach(r => {
            if (!r.enabled) return;
            const ringLinearRatio = (r.value - startValue) / scaleRange;
            const ringRatio = applyScale(ringLinearRatio, scaleType, scaleIntensity);
            const ringRadius = innerRadius + (outerMaxRadius - innerRadius) * ringRatio;
            const circle = document.createElementNS(SVG_NS, "circle");
            circle.setAttribute("cx", String(cx));
            circle.setAttribute("cy", String(cy));
            circle.setAttribute("r", String(Math.max(0, ringRadius)));
            circle.setAttribute("fill", "none");
            circle.setAttribute("stroke", isHighContrast ? hcForeground : r.color);
            circle.setAttribute("stroke-width", String(r.width));
            circle.setAttribute("stroke-dasharray", "4 3");
            this.svg.appendChild(circle);
        });

        const colorMode = coloring.colorMode.value.value as string;
        const useGradient = coloring.useGradient.value;

        valueColumns.forEach((col, i) => {
            const rawValue = col.values && col.values[0];
            if (typeof rawValue !== "number") {
                return;
            }

            const ratio = (rawValue - startValue) / scaleRange;
            const cappedRatio = applyScale(ratio, scaleType, scaleIntensity);
            const overTarget = ratio >= 1;

            const idealStart = startOffset + i * anglePerSlice;
            const idealEnd = startOffset + (i + 1) * anglePerSlice;

            let baseColor: string;
            if (isHighContrast) {
                baseColor = hcForeground;
            } else if (colorMode === "redgreen") {
                baseColor = overTarget ? coloring.colorAchieved.value.value : coloring.colorNotAchieved.value.value;
            } else if (colorMode === "completion") {
                baseColor = lerpColor5(coloring.startColor.value.value, coloring.quarterColor.value.value, coloring.midColor.value.value, coloring.threeQuarterColor.value.value, coloring.endColor.value.value, cappedRatio);
            } else {
                baseColor = sliceColorList[i % sliceColorList.length];
            }

            const fillOuterRadius = overTarget ? outerMaxRadius : innerRadius + (outerMaxRadius - innerRadius) * cappedRatio;
            const path = constantGapWedgePath(cx, cy, innerRadius, Math.max(innerRadius + 0.5, fillOuterRadius), idealStart, idealEnd, gapPx);

            const fillEl = document.createElementNS(SVG_NS, "path");
            fillEl.setAttribute("d", path);

            if (isHighContrast) {
                // High contrast: solid foreground only, distinguished by opacity (no gradients/hues)
                fillEl.setAttribute("fill", baseColor);
                fillEl.setAttribute("fill-opacity", String(0.35 + 0.65 * cappedRatio));
            } else if (overTarget || !useGradient) {
                fillEl.setAttribute("fill", baseColor);
            } else {
                const gradId = `rkw-grad-${i}`;
                const gradient = document.createElementNS(SVG_NS, "radialGradient");
                gradient.setAttribute("id", gradId);
                gradient.setAttribute("gradientUnits", "userSpaceOnUse");
                gradient.setAttribute("cx", String(cx));
                gradient.setAttribute("cy", String(cy));
                gradient.setAttribute("r", String(Math.max(1, fillOuterRadius)));

                const stop1 = document.createElementNS(SVG_NS, "stop");
                stop1.setAttribute("offset", `${(innerRadius / Math.max(1, fillOuterRadius)) * 100}%`);
                stop1.setAttribute("stop-color", coloring.startColor.value.value);
                stop1.setAttribute("stop-opacity", "1");

                const stop2 = document.createElementNS(SVG_NS, "stop");
                stop2.setAttribute("offset", "100%");
                stop2.setAttribute("stop-color", baseColor);
                stop2.setAttribute("stop-opacity", "1");

                gradient.appendChild(stop1);
                gradient.appendChild(stop2);
                defs.appendChild(gradient);

                fillEl.setAttribute("fill", `url(#${gradId})`);
            }
            this.svg.appendChild(fillEl);

            const formatString = (col.objects && col.objects[0] && (col.objects[0] as any).general && (col.objects[0] as any).general.formatString) || col.source.format;
            const valueText = formatValueSafeScale(rawValue, formatString);

            if (label.show.value) {
                const showName = label.content.value.value === "valueAndName";

                const labelRadius = innerRadius + (fillOuterRadius - innerRadius) * 0.55;
                const midAngle = (idealStart + idealEnd) / 2;
                const labelPos = polarPoint(cx, cy, labelRadius, midAngle);

                let textColor = label.manualColor.value.value;
                if (label.autoContrast.value) {
                    textColor = (cappedRatio >= 0.5 || overTarget) ? label.lightColor.value.value : label.darkColor.value.value;
                }
                if (isHighContrast) {
                    textColor = hcBackground;
                }

                const text = document.createElementNS(SVG_NS, "text");
                text.setAttribute("x", String(labelPos.x));
                text.setAttribute("text-anchor", "middle");
                text.setAttribute("fill", textColor);
                text.setAttribute("font-family", label.fontFamily.value);
                text.setAttribute("font-size", String(label.fontSize.value));
                if (label.bold.value) {
                    text.setAttribute("font-weight", "bold");
                }

                if (showName) {
                    const nameFontSize = label.fontSize.value * 0.78;
                    // Approximate available width at this radius: chord length of the slice angle, with a safety margin
                    const chordWidth = 2 * labelRadius * Math.sin(toRad(anglePerSlice / 2)) * 0.85;

                    const nameLines = label.wrapName.value
                        ? wrapText(col.source.displayName, chordWidth, nameFontSize, label.fontFamily.value, label.bold.value, Math.max(1, Math.round(label.maxNameLines.value)))
                        : [col.source.displayName];

                    const lineGap = nameFontSize * 1.15;
                    const totalNameHeight = (nameLines.length - 1) * lineGap;
                    const firstNameY = labelPos.y - totalNameHeight - label.fontSize.value * 0.35;

                    nameLines.forEach((line, li) => {
                        const nameTspan = document.createElementNS(SVG_NS, "tspan");
                        nameTspan.setAttribute("x", String(labelPos.x));
                        nameTspan.setAttribute("y", String(firstNameY + li * lineGap));
                        nameTspan.setAttribute("font-size", String(nameFontSize));
                        nameTspan.textContent = line;
                        text.appendChild(nameTspan);
                    });

                    const valueTspan = document.createElementNS(SVG_NS, "tspan");
                    valueTspan.setAttribute("x", String(labelPos.x));
                    valueTspan.setAttribute("y", String(firstNameY + nameLines.length * lineGap + label.fontSize.value * 0.15));
                    valueTspan.textContent = valueText;
                    text.appendChild(valueTspan);
                } else {
                    text.setAttribute("y", String(labelPos.y));
                    text.setAttribute("dominant-baseline", "central");
                    text.textContent = valueText;
                }

                this.svg.appendChild(text);
            }

            // Invisible hit area spanning the FULL slice (not just the filled portion) so
            // hovering the empty remainder of a partially-filled slice still shows the tooltip.
            const hitPath = constantGapWedgePath(cx, cy, innerRadius, outerMaxRadius, idealStart, idealEnd, gapPx);
            const hitEl = document.createElementNS(SVG_NS, "path");
            hitEl.setAttribute("d", hitPath);
            hitEl.setAttribute("fill", "transparent");
            hitEl.setAttribute("stroke", "none");

            const exactValue = valueText;
            const tooltipItems: powerbi.extensibility.VisualTooltipDataItem[] = [
                { displayName: col.source.displayName, value: exactValue }
            ];
            hitEl.addEventListener("mouseover", (e: MouseEvent) => {
                if (this.host.hostCapabilities.allowInteractions === false) {
                    return;
                }
                this.host.tooltipService.show({
                    dataItems: tooltipItems,
                    identities: [],
                    coordinates: [e.clientX, e.clientY],
                    isTouchEvent: false
                });
            });
            hitEl.addEventListener("mousemove", (e: MouseEvent) => {
                if (this.host.hostCapabilities.allowInteractions === false) {
                    return;
                }
                this.host.tooltipService.move({
                    dataItems: tooltipItems,
                    identities: [],
                    coordinates: [e.clientX, e.clientY],
                    isTouchEvent: false
                });
            });
            hitEl.addEventListener("mouseleave", () => {
                this.host.tooltipService.hide({ isTouchEvent: false, immediately: true });
            });
            this.svg.appendChild(hitEl);
        });

        // ---- Center circle + icon ----
        const centerRadius = Math.max(0, innerRadius - 2);
        const centerCircle = document.createElementNS(SVG_NS, "circle");
        centerCircle.setAttribute("cx", String(cx));
        centerCircle.setAttribute("cy", String(cy));
        centerCircle.setAttribute("r", String(centerRadius));
        centerCircle.setAttribute("fill", isHighContrast ? hcBackground : center.backgroundColor.value.value);
        centerCircle.setAttribute("fill-opacity", isHighContrast ? "1" : String(1 - Math.max(0, Math.min(100, center.backgroundTransparency.value)) / 100));
        if (center.showBorder.value || isHighContrast) {
            centerCircle.setAttribute("stroke", isHighContrast ? hcForeground : center.borderColor.value.value);
            centerCircle.setAttribute("stroke-width", String(isHighContrast ? Math.max(1, center.borderWidth.value) : center.borderWidth.value));
        }
        this.svg.appendChild(centerCircle);

        const iconUrl: string = center.showIcon.value ? center.icon.value : "";
        if (iconUrl) {
            const iconWidth = Math.max(1, innerRadius * 2 * (Math.max(5, Math.min(100, center.iconWidthPercent.value)) / 100));
            const iconHeight = Math.max(1, innerRadius * 2 * (Math.max(5, Math.min(100, center.iconHeightPercent.value)) / 100));
            const clipRadius = Math.max(1, innerRadius - 1);

            const clipId = "rkw-center-clip";
            const clipPath = document.createElementNS(SVG_NS, "clipPath");
            clipPath.setAttribute("id", clipId);
            const clipCircle = document.createElementNS(SVG_NS, "circle");
            clipCircle.setAttribute("cx", String(cx));
            clipCircle.setAttribute("cy", String(cy));
            clipCircle.setAttribute("r", String(clipRadius));
            clipPath.appendChild(clipCircle);
            defs.appendChild(clipPath);

            const image = document.createElementNS(SVG_NS, "image");
            image.setAttribute("x", String(cx - iconWidth / 2));
            image.setAttribute("y", String(cy - iconHeight / 2));
            image.setAttribute("width", String(iconWidth));
            image.setAttribute("height", String(iconHeight));
            const fitMode = center.iconFitMode.value.value as string;
            const preserveAspectRatio = fitMode === "stretch" ? "none" : fitMode === "cover" ? "xMidYMid slice" : "xMidYMid meet";
            image.setAttribute("preserveAspectRatio", preserveAspectRatio);
            image.setAttribute("clip-path", `url(#${clipId})`);
            image.setAttribute("href", iconUrl);
            this.svg.appendChild(image);
        }

        // Upload affordance: only shown when icon is enabled but not yet set
        if (!center.showIcon.value || iconUrl) {
            this.uploadBtnEl.style.display = "none";
        } else {
            const btnSize = Math.max(24, Math.min(centerRadius * 1.2, 90));
            this.uploadBtnEl.style.display = "flex";
            this.uploadBtnEl.style.left = `${cx - btnSize / 2}px`;
            this.uploadBtnEl.style.top = `${cy - btnSize / 2}px`;
            this.uploadBtnEl.style.width = `${btnSize}px`;
            this.uploadBtnEl.style.height = `${btnSize}px`;
        }

        // Scale range label - important for honest reading when the scale doesn't start at 0
        if (ring.showScaleLabel.value && startValue !== 0) {
            const scaleText = `Scale: ${(startValue * 100).toFixed(0)}% – ${(targetValue * 100).toFixed(0)}%`;
            const scaleLabel = document.createElementNS(SVG_NS, "text");
            scaleLabel.setAttribute("x", String(cx));
            scaleLabel.setAttribute("y", String(Math.min(height - 6, cy + outerMaxRadius + 16)));
            scaleLabel.setAttribute("text-anchor", "middle");
            scaleLabel.setAttribute("font-family", "Segoe UI, sans-serif");
            scaleLabel.setAttribute("font-size", "10");
            scaleLabel.setAttribute("fill", isHighContrast ? hcForeground : "#A6A6A6");
            scaleLabel.textContent = scaleText;
            this.svg.appendChild(scaleLabel);
        }
    }

    private showLandingPage(width: number, height: number): void {
        this.svg.style.display = "none";
        this.uploadBtnEl.style.display = "none";
        this.landingPageEl.style.display = "flex";
        this.landingPageEl.style.width = `${width}px`;
        this.landingPageEl.style.height = `${height}px`;

        const isHighContrast = this.host.colorPalette && this.host.colorPalette.isHighContrast;
        const fg = isHighContrast ? this.host.colorPalette.foreground.value : "#605E5C";

        while (this.landingPageEl.firstChild) {
            this.landingPageEl.removeChild(this.landingPageEl.firstChild);
        }
        const title = document.createElement("div");
        title.className = "radialKpiWheelLandingTitle";
        title.style.color = fg;
        title.textContent = this.host.locale && this.host.locale.startsWith("pt") ? "Radial KPI Wheel" : "Radial KPI Wheel";

        const message = document.createElement("div");
        message.className = "radialKpiWheelLandingMessage";
        message.style.color = fg;
        message.textContent = this.host.locale && this.host.locale.startsWith("pt")
            ? "Arraste uma ou mais métricas de percentagem para o campo 'Values' para começar."
            : "Drag one or more percentage metrics into the 'Values' field to get started.";

        this.landingPageEl.appendChild(title);
        this.landingPageEl.appendChild(message);
    }

    private hideLandingPage(): void {
        this.landingPageEl.style.display = "none";
        this.svg.style.display = "block";
    }

    public getFormattingModel(): powerbi.visuals.FormattingModel {
        return this.formattingSettingsService.buildFormattingModel(this.formattingSettings);
    }
}
