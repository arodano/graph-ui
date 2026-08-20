export function getGraphData() {
    const nodes = [
        {
            id: "n1", type: "NodeParameterInput", name: "ConceptFilter",
            property: "Param name", value: "ConceptFilter",
            description: "Concept name to filter by",
            metadata: { group: "const:POLYGON", conceptos: "Concept", adInfo: "input:string" },
            position: new BABYLON.Vector3(-13, 0.35, 4)
        },
        {
            id: "n2", type: "NodeFilter", name: "FilterByConcept",
            property: "Expression", value: "item.Concept == param.ConceptFilter",
            description: "",
            metadata: { group: "field", conceptos: "Concept", adInfo: "output:count" },
            position: new BABYLON.Vector3(-5, 0.35, 4)
        },
        {
            id: "n3", type: "NodeAggregate", name: "GroupByPolygon",
            property: "Group by", value: "PolygonCodeH3R12",
            description: "",
            metadata: { group: "const:POLYGON", conceptos: "field:PolygonCodeH3R12", adInfo: "output:count" },
            position: new BABYLON.Vector3(4, 0.35, 4)
        },
        {
            id: "n4", type: "NodeConditional", name: "IsDelivered",
            property: "Condition", value: "status == Delivered",
            description: "",
            metadata: { group: "Shipment", conceptos: "Delivery", adInfo: "boolean" },
            position: new BABYLON.Vector3(-5, 0.35, -4)
        },
        {
            id: "n5", type: "NodeMathOperation", name: "CalculateAmount",
            property: "Operation", value: "quantity × rate",
            description: "",
            metadata: { group: "Pricing", conceptos: "Amount", adInfo: "decimal" },
            position: new BABYLON.Vector3(4, 0.35, -4)
        },
        {
            id: "n6", type: "NodeOutput", name: "Settlement",
            property: "Output", value: "settlementAmount",
            description: "",
            metadata: { group: "Settlement", conceptos: "Settlement", adInfo: "ARS" },
            position: new BABYLON.Vector3(13, 0.35, 4)
        }
    ];

    const edges = [
        ["n1", "n2"], ["n2", "n3"], ["n2", "n4"],
        ["n4", "n5"], ["n3", "n5"], ["n5", "n6"]
    ];

    return { nodes, edges };
}
