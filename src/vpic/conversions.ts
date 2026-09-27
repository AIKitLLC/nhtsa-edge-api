/**
 * Conversion step of vpic.spvindecode_core: derives missing units (e.g. DisplacementL
 * from DisplacementCC) by evaluating vpic.Conversion formulas with '#x#' replaced by
 * the source item's AttributeId, as `select (<formula>)::varchar(500)`.
 */

import { ItemList, nullsFirstDesc } from "./items";
import { evaluateDecimalExpression } from "./tsql-decimal";
import type { ConversionDef } from "./types";

export function applyConversions(list: ItemList, conversions: readonly ConversionDef[]): void {
  // The cursor is evaluated once: items inserted by conversions are not converted again
  const cursor = list.items
    .flatMap((item) => conversions.filter((c) => c.fromElementId === item.elementId).map((c) => ({ item, c })))
    .sort(
      (x, y) =>
        y.item.priority - x.item.priority || nullsFirstDesc(x.item.createdOn, y.item.createdOn) || x.c.id - y.c.id
    );

  for (const { item, c } of cursor) {
    if (list.hasElement(c.toElementId)) continue;

    const formula = c.formula.split("#x#").join(item.attributeId ?? "");
    let result: string;
    try {
      result = evaluateDecimalExpression(formula);
    } catch {
      result = "0"; // the source catches any SQL error and stores '0'
    }

    list.add({
      createdOn: null,
      patternId: item.patternId,
      keys: item.keys,
      vinSchemaId: item.vinSchemaId,
      wmiId: item.wmiId,
      elementId: c.toElementId,
      attributeId: result,
      value: result,
      source: `Conversion ${c.id}: ${formula}`.substring(0, 50),
      priority: 100,
      toBeQCed: null,
      resolved: null,
    });
  }
}
