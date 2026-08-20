export const CARD_WIDTH     = 5.2;
export const CARD_DEPTH     = 2.7;
export const CARD_THICKNESS = 0.22; // box body height

export const NODE_COLORS = {
    NodeAggregate:      new BABYLON.Color3(0.12, 0.82, 0.54),
    NodeCompositeGroup: new BABYLON.Color3(0.67, 0.42, 1.0),
    NodeConditional:    new BABYLON.Color3(1.0,  0.58, 0.2),
    NodeConstantInput:  new BABYLON.Color3(0.2,  0.85, 0.63),
    NodeFieldSpec:      new BABYLON.Color3(0.32, 0.58, 1.0),
    NodeFilter:         new BABYLON.Color3(0.96, 0.68, 0.18),
    NodeGrouping:       new BABYLON.Color3(0.62, 0.46, 1.0),
    NodeMathOperation:  new BABYLON.Color3(0.95, 0.76, 0.22),
    NodeOutput:         new BABYLON.Color3(0.12, 0.85, 0.52),
    NodeParameterInput: new BABYLON.Color3(0.57, 0.34, 1.0),
    NodeQuantitySpec:   new BABYLON.Color3(0.95, 0.42, 0.2),
    NodeVariableInput:  new BABYLON.Color3(0.32, 0.78, 0.45)
};

export const TYPE_META = {
    NodeAggregate:      { abbr: "AG",  label: "AGGREGATION" },
    NodeCompositeGroup: { abbr: "CG",  label: "COMPOSITE" },
    NodeConditional:    { abbr: "IF",  label: "CONDITIONAL" },
    NodeConstantInput:  { abbr: "CT",  label: "CONSTANT" },
    NodeFieldSpec:      { abbr: "FS",  label: "FIELD SPEC" },
    NodeFilter:         { abbr: "FL",  label: "FILTER" },
    NodeGrouping:       { abbr: "GR",  label: "GROUPING" },
    NodeMathOperation:  { abbr: "MT",  label: "MATH OP" },
    NodeOutput:         { abbr: "OUT", label: "OUTPUT" },
    NodeParameterInput: { abbr: "PRM", label: "PARAMETER" },
    NodeQuantitySpec:   { abbr: "QS",  label: "QUANTITY" },
    NodeVariableInput:  { abbr: "VAR", label: "VARIABLE" }
};
