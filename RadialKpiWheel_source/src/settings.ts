"use strict";

import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";

import FormattingSettingsCard = formattingSettings.SimpleCard;
import FormattingSettingsSlice = formattingSettings.Slice;
import FormattingSettingsModel = formattingSettings.Model;

const DEFAULT_SLICE_COLORS = [
    "#1F3B5C", "#2E5077", "#3D6591", "#4C7AAB", "#6690BC", "#7FA6CC",
    "#98BBDB", "#2A4B70", "#3A6088", "#5578A0", "#7090B4", "#8CA6C4", "#A8BFD3"
];

class RingCardSettings extends FormattingSettingsCard {
    targetValue = new formattingSettings.NumUpDown({ name: "targetValue", displayName: "Target value (= 100% fill)", displayNameKey: "Ring_TargetValue", value: 1 });
    startValue = new formattingSettings.NumUpDown({ name: "startValue", displayName: "Start value (= 0% fill)", displayNameKey: "Ring_StartValue", value: 0 });
    scaleType = new formattingSettings.ItemDropdown({
        name: "scaleType",
        displayName: "Scale type",
        displayNameKey: "Ring_ScaleType",
        items: [
            { displayName: "Linear", value: "linear" },
            { displayName: "Power (emphasize high values)", value: "power" },
            { displayName: "Logarithmic (emphasize high values)", value: "log" }
        ],
        value: { displayName: "Linear", value: "linear" }
    });
    scaleIntensity = new formattingSettings.NumUpDown({ name: "scaleIntensity", displayName: "Scale intensity", displayNameKey: "Ring_ScaleIntensity", value: 2 });
    showScaleLabel = new formattingSettings.ToggleSwitch({ name: "showScaleLabel", displayName: "Show scale range label (recommended when start value > 0)", displayNameKey: "Ring_ShowScaleLabel", value: true });
    innerRadiusPercent = new formattingSettings.NumUpDown({ name: "innerRadiusPercent", displayName: "Center hole size (%)", displayNameKey: "Ring_InnerRadiusPercent", value: 32 });
    gapPixels = new formattingSettings.NumUpDown({ name: "gapPixels", displayName: "Gap between slices (px, constant width)", displayNameKey: "Ring_GapPixels", value: 4 });
    showOutline = new formattingSettings.ToggleSwitch({ name: "showOutline", displayName: "Show outer outline", displayNameKey: "Ring_ShowOutline", value: true });
    outlineColor = new formattingSettings.ColorPicker({ name: "outlineColor", displayName: "Outer outline color", displayNameKey: "Ring_OutlineColor", value: { value: "#3A5A85" } });
    outlineWidth = new formattingSettings.NumUpDown({ name: "outlineWidth", displayName: "Outer outline width (px)", displayNameKey: "Ring_OutlineWidth", value: 1 });

    name: string = "ring";
    displayName: string = "Ring layout";
    displayNameKey: string = "Ring_Card";
    slices: Array<FormattingSettingsSlice> = [
        this.targetValue, this.startValue, this.scaleType, this.scaleIntensity, this.showScaleLabel,
        this.innerRadiusPercent, this.gapPixels, this.showOutline, this.outlineColor, this.outlineWidth
    ];
}

class ReferenceRingsCardSettings extends FormattingSettingsCard {
    ring1Enabled = new formattingSettings.ToggleSwitch({ name: "ring1Enabled", displayName: "Ring 1 - enable", displayNameKey: "RefRings_1Enabled", value: false });
    ring1Value = new formattingSettings.NumUpDown({ name: "ring1Value", displayName: "Ring 1 - value", displayNameKey: "RefRings_1Value", value: 0.5 });
    ring1Color = new formattingSettings.ColorPicker({ name: "ring1Color", displayName: "Ring 1 - color", displayNameKey: "RefRings_1Color", value: { value: "#A6A6A6" } });
    ring1Width = new formattingSettings.NumUpDown({ name: "ring1Width", displayName: "Ring 1 - width (px)", displayNameKey: "RefRings_1Width", value: 1 });

    ring2Enabled = new formattingSettings.ToggleSwitch({ name: "ring2Enabled", displayName: "Ring 2 - enable", displayNameKey: "RefRings_2Enabled", value: false });
    ring2Value = new formattingSettings.NumUpDown({ name: "ring2Value", displayName: "Ring 2 - value", displayNameKey: "RefRings_2Value", value: 0.75 });
    ring2Color = new formattingSettings.ColorPicker({ name: "ring2Color", displayName: "Ring 2 - color", displayNameKey: "RefRings_2Color", value: { value: "#A6A6A6" } });
    ring2Width = new formattingSettings.NumUpDown({ name: "ring2Width", displayName: "Ring 2 - width (px)", displayNameKey: "RefRings_2Width", value: 1 });

    ring3Enabled = new formattingSettings.ToggleSwitch({ name: "ring3Enabled", displayName: "Ring 3 - enable", displayNameKey: "RefRings_3Enabled", value: false });
    ring3Value = new formattingSettings.NumUpDown({ name: "ring3Value", displayName: "Ring 3 - value", displayNameKey: "RefRings_3Value", value: 0.9 });
    ring3Color = new formattingSettings.ColorPicker({ name: "ring3Color", displayName: "Ring 3 - color", displayNameKey: "RefRings_3Color", value: { value: "#A6A6A6" } });
    ring3Width = new formattingSettings.NumUpDown({ name: "ring3Width", displayName: "Ring 3 - width (px)", displayNameKey: "RefRings_3Width", value: 1 });

    ring4Enabled = new formattingSettings.ToggleSwitch({ name: "ring4Enabled", displayName: "Ring 4 - enable", displayNameKey: "RefRings_4Enabled", value: false });
    ring4Value = new formattingSettings.NumUpDown({ name: "ring4Value", displayName: "Ring 4 - value", displayNameKey: "RefRings_4Value", value: 1.1 });
    ring4Color = new formattingSettings.ColorPicker({ name: "ring4Color", displayName: "Ring 4 - color", displayNameKey: "RefRings_4Color", value: { value: "#A6A6A6" } });
    ring4Width = new formattingSettings.NumUpDown({ name: "ring4Width", displayName: "Ring 4 - width (px)", displayNameKey: "RefRings_4Width", value: 1 });

    name: string = "referenceRings";
    displayName: string = "Reference rings";
    displayNameKey: string = "RefRings_Card";
    slices: Array<FormattingSettingsSlice> = [
        this.ring1Enabled, this.ring1Value, this.ring1Color, this.ring1Width,
        this.ring2Enabled, this.ring2Value, this.ring2Color, this.ring2Width,
        this.ring3Enabled, this.ring3Value, this.ring3Color, this.ring3Width,
        this.ring4Enabled, this.ring4Value, this.ring4Color, this.ring4Width
    ];
}

class ColoringCardSettings extends FormattingSettingsCard {
    colorMode = new formattingSettings.ItemDropdown({
        name: "colorMode",
        displayName: "Color mode",
        displayNameKey: "Coloring_ColorMode",
        items: [
            { displayName: "Fixed per slice", value: "fixed" },
            { displayName: "Red / Green (target achieved)", value: "redgreen" },
            { displayName: "By completion (start/mid/end)", value: "completion" }
        ],
        value: { displayName: "Fixed per slice", value: "fixed" }
    });

    useGradient = new formattingSettings.ToggleSwitch({ name: "useGradient", displayName: "Use gradient fade (center to edge)", displayNameKey: "Coloring_UseGradient", value: true });

    colorAchieved = new formattingSettings.ColorPicker({ name: "colorAchieved", displayName: "Red/Green - achieved color", displayNameKey: "Coloring_ColorAchieved", value: { value: "#2E9E5B" } });
    colorNotAchieved = new formattingSettings.ColorPicker({ name: "colorNotAchieved", displayName: "Red/Green - not achieved color", displayNameKey: "Coloring_ColorNotAchieved", value: { value: "#D9534F" } });

    startColor = new formattingSettings.ColorPicker({ name: "startColor", displayName: "Gradient start / Completion color at 0%", displayNameKey: "Coloring_StartColor", value: { value: "#C9D6E3" } });
    quarterColor = new formattingSettings.ColorPicker({ name: "quarterColor", displayName: "Completion - color at 25%", displayNameKey: "Coloring_QuarterColor", value: { value: "#9BB4CC" } });
    midColor = new formattingSettings.ColorPicker({ name: "midColor", displayName: "Completion - color at 50%", displayNameKey: "Coloring_MidColor", value: { value: "#6690BC" } });
    threeQuarterColor = new formattingSettings.ColorPicker({ name: "threeQuarterColor", displayName: "Completion - color at 75%", displayNameKey: "Coloring_ThreeQuarterColor", value: { value: "#3D6591" } });
    endColor = new formattingSettings.ColorPicker({ name: "endColor", displayName: "Completion - color at 100%", displayNameKey: "Coloring_EndColor", value: { value: "#1F3B5C" } });

    name: string = "coloring";
    displayName: string = "Coloring";
    displayNameKey: string = "Coloring_Card";
    slices: Array<FormattingSettingsSlice> = [
        this.colorMode, this.useGradient,
        this.colorAchieved, this.colorNotAchieved,
        this.startColor, this.quarterColor, this.midColor, this.threeQuarterColor, this.endColor
    ];
}

class SliceColorsCardSettings extends FormattingSettingsCard {
    slice1 = new formattingSettings.ColorPicker({ name: "slice1", displayName: "Slice 1", displayNameKey: "SliceColors_1", value: { value: DEFAULT_SLICE_COLORS[0] } });
    slice2 = new formattingSettings.ColorPicker({ name: "slice2", displayName: "Slice 2", displayNameKey: "SliceColors_2", value: { value: DEFAULT_SLICE_COLORS[1] } });
    slice3 = new formattingSettings.ColorPicker({ name: "slice3", displayName: "Slice 3", displayNameKey: "SliceColors_3", value: { value: DEFAULT_SLICE_COLORS[2] } });
    slice4 = new formattingSettings.ColorPicker({ name: "slice4", displayName: "Slice 4", displayNameKey: "SliceColors_4", value: { value: DEFAULT_SLICE_COLORS[3] } });
    slice5 = new formattingSettings.ColorPicker({ name: "slice5", displayName: "Slice 5", displayNameKey: "SliceColors_5", value: { value: DEFAULT_SLICE_COLORS[4] } });
    slice6 = new formattingSettings.ColorPicker({ name: "slice6", displayName: "Slice 6", displayNameKey: "SliceColors_6", value: { value: DEFAULT_SLICE_COLORS[5] } });
    slice7 = new formattingSettings.ColorPicker({ name: "slice7", displayName: "Slice 7", displayNameKey: "SliceColors_7", value: { value: DEFAULT_SLICE_COLORS[6] } });
    slice8 = new formattingSettings.ColorPicker({ name: "slice8", displayName: "Slice 8", displayNameKey: "SliceColors_8", value: { value: DEFAULT_SLICE_COLORS[7] } });
    slice9 = new formattingSettings.ColorPicker({ name: "slice9", displayName: "Slice 9", displayNameKey: "SliceColors_9", value: { value: DEFAULT_SLICE_COLORS[8] } });
    slice10 = new formattingSettings.ColorPicker({ name: "slice10", displayName: "Slice 10", displayNameKey: "SliceColors_10", value: { value: DEFAULT_SLICE_COLORS[9] } });
    slice11 = new formattingSettings.ColorPicker({ name: "slice11", displayName: "Slice 11", displayNameKey: "SliceColors_11", value: { value: DEFAULT_SLICE_COLORS[10] } });
    slice12 = new formattingSettings.ColorPicker({ name: "slice12", displayName: "Slice 12", displayNameKey: "SliceColors_12", value: { value: DEFAULT_SLICE_COLORS[11] } });
    slice13 = new formattingSettings.ColorPicker({ name: "slice13", displayName: "Slice 13", displayNameKey: "SliceColors_13", value: { value: DEFAULT_SLICE_COLORS[12] } });

    name: string = "sliceColors";
    displayName: string = "Slice colors (fixed mode)";
    displayNameKey: string = "SliceColors_Card";
    slices: Array<FormattingSettingsSlice> = [
        this.slice1, this.slice2, this.slice3, this.slice4, this.slice5, this.slice6, this.slice7,
        this.slice8, this.slice9, this.slice10, this.slice11, this.slice12, this.slice13
    ];
}

class ValueLabelCardSettings extends FormattingSettingsCard {
    show = new formattingSettings.ToggleSwitch({ name: "show", displayName: "Show labels", displayNameKey: "ValueLabel_Show", value: true });
    content = new formattingSettings.ItemDropdown({
        name: "content",
        displayName: "Label content",
        displayNameKey: "ValueLabel_Content",
        items: [
            { displayName: "Percentage only", value: "valueOnly" },
            { displayName: "Percentage + metric name", value: "valueAndName" }
        ],
        value: { displayName: "Percentage only", value: "valueOnly" }
    });
    wrapName = new formattingSettings.ToggleSwitch({ name: "wrapName", displayName: "Wrap metric name to fit slice", displayNameKey: "ValueLabel_WrapName", value: true });
    maxNameLines = new formattingSettings.NumUpDown({ name: "maxNameLines", displayName: "Max lines for metric name", displayNameKey: "ValueLabel_MaxNameLines", value: 2 });
    fontFamily = new formattingSettings.FontPicker({ name: "fontFamily", displayName: "Font family", displayNameKey: "ValueLabel_FontFamily", value: "Segoe UI" });
    fontSize = new formattingSettings.NumUpDown({ name: "fontSize", displayName: "Font size", displayNameKey: "ValueLabel_FontSize", value: 14 });
    bold = new formattingSettings.ToggleSwitch({ name: "bold", displayName: "Bold", displayNameKey: "ValueLabel_Bold", value: false });
    autoContrast = new formattingSettings.ToggleSwitch({ name: "autoContrast", displayName: "Automatic text color (light/dark by fill)", displayNameKey: "ValueLabel_AutoContrast", value: true });
    manualColor = new formattingSettings.ColorPicker({ name: "manualColor", displayName: "Text color (when automatic is off)", displayNameKey: "ValueLabel_ManualColor", value: { value: "#FFFFFF" } });
    lightColor = new formattingSettings.ColorPicker({ name: "lightColor", displayName: "Text color on dark fill", displayNameKey: "ValueLabel_LightColor", value: { value: "#FFFFFF" } });
    darkColor = new formattingSettings.ColorPicker({ name: "darkColor", displayName: "Text color on light fill", displayNameKey: "ValueLabel_DarkColor", value: { value: "#5B6672" } });

    name: string = "valueLabel";
    displayName: string = "Value labels";
    displayNameKey: string = "ValueLabel_Card";
    slices: Array<FormattingSettingsSlice> = [
        this.show, this.content, this.wrapName, this.maxNameLines, this.fontFamily, this.fontSize, this.bold,
        this.autoContrast, this.manualColor, this.lightColor, this.darkColor
    ];
}

class CenterCardSettings extends FormattingSettingsCard {
    icon = new formattingSettings.TextInput({ name: "icon", displayName: "Icon image URL or data URI", displayNameKey: "Center_Icon", value: "", placeholder: "https://... or data:image/png;base64,..." });
    showIcon = new formattingSettings.ToggleSwitch({ name: "showIcon", displayName: "Show icon", displayNameKey: "Center_ShowIcon", value: false });
    iconWidthPercent = new formattingSettings.NumUpDown({ name: "iconWidthPercent", displayName: "Icon width (%)", displayNameKey: "Center_IconWidthPercent", value: 70 });
    iconHeightPercent = new formattingSettings.NumUpDown({ name: "iconHeightPercent", displayName: "Icon height (%)", displayNameKey: "Center_IconHeightPercent", value: 70 });
    iconFitMode = new formattingSettings.ItemDropdown({
        name: "iconFitMode",
        displayName: "Icon fit mode",
        displayNameKey: "Center_IconFitMode",
        items: [
            { displayName: "Fit (contain)", value: "contain" },
            { displayName: "Fill (cover)", value: "cover" },
            { displayName: "Stretch", value: "stretch" }
        ],
        value: { displayName: "Fit (contain)", value: "contain" }
    });
    backgroundColor = new formattingSettings.ColorPicker({ name: "backgroundColor", displayName: "Center background color", displayNameKey: "Center_BackgroundColor", value: { value: "#FFFFFF" } });
    backgroundTransparency = new formattingSettings.NumUpDown({ name: "backgroundTransparency", displayName: "Center background transparency (%)", displayNameKey: "Center_BackgroundTransparency", value: 0 });
    showBorder = new formattingSettings.ToggleSwitch({ name: "showBorder", displayName: "Show center border", displayNameKey: "Center_ShowBorder", value: true });
    borderColor = new formattingSettings.ColorPicker({ name: "borderColor", displayName: "Center border color", displayNameKey: "Center_BorderColor", value: { value: "#C9CDD3" } });
    borderWidth = new formattingSettings.NumUpDown({ name: "borderWidth", displayName: "Center border width (px)", displayNameKey: "Center_BorderWidth", value: 2 });

    name: string = "center";
    displayName: string = "Center icon";
    displayNameKey: string = "Center_Card";
    slices: Array<FormattingSettingsSlice> = [
        this.showIcon, this.icon, this.iconWidthPercent, this.iconHeightPercent, this.iconFitMode,
        this.backgroundColor, this.backgroundTransparency, this.showBorder, this.borderColor, this.borderWidth
    ];

    onPreProcess(): void {
        const showIconOn = this.showIcon.value;
        this.icon.visible = showIconOn;
        this.iconWidthPercent.visible = showIconOn;
        this.iconHeightPercent.visible = showIconOn;
        this.iconFitMode.visible = showIconOn;
    }
}

export class VisualFormattingSettingsModel extends FormattingSettingsModel {
    ringCard = new RingCardSettings();
    referenceRingsCard = new ReferenceRingsCardSettings();
    coloringCard = new ColoringCardSettings();
    sliceColorsCard = new SliceColorsCardSettings();
    valueLabelCard = new ValueLabelCardSettings();
    centerCard = new CenterCardSettings();

    cards = [
        this.ringCard, this.referenceRingsCard, this.coloringCard,
        this.sliceColorsCard, this.valueLabelCard, this.centerCard
    ];
}
